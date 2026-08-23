import { sendOrderStatusChangedNotification, sendUserOrderStatusChangedNotification } from '../../../lib/notification.js';

function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getCurrentUser(context) {
  const cookieString = context.request.headers.get("cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");

  if (!sessionId) return null;

  return await context.env.DB.prepare(`
    SELECT
      id,
      full_name,
      email,
      phone,
      role
    FROM users
    WHERE id = (
      SELECT user_id
      FROM sessions
      WHERE id = ?
      LIMIT 1
    )
    LIMIT 1
  `).bind(sessionId).first();
}

function isAdmin(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "admin" || role === "super_admin";
}

async function getOrderByNumber(db, orderNumber) {
  return await db.prepare(`
    SELECT
      o.id,
      o.user_id,
      o.order_number,
      o.address_id,
      o.status,
      o.payment_status,
      o.subtotal_amount,
      o.shipping_amount,
      o.total_amount,
      COALESCE(o.wallet_used_amount, 0) AS wallet_used_amount,
      COALESCE(o.cashback_amount, 0) AS cashback_amount,
      COALESCE(o.cashback_status, 'none') AS cashback_status,
      o.notes,
      o.created_at,
      o.updated_at,
      u.full_name,
      u.email,
      u.phone,
      a.full_name AS address_full_name,
      a.address_line AS address_line,
      a.postal_code AS postal_code,
      a.phone AS address_phone,
      a.city AS address_city,
      a.state AS address_state
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN addresses a ON a.id = o.address_id
    WHERE o.order_number = ?
    LIMIT 1
  `).bind(orderNumber).first();
}

async function getOrderItems(db, orderId) {
  const result = await db.prepare(`
    SELECT
      id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price
    FROM order_items
    WHERE order_id = ?
    ORDER BY id DESC
  `).bind(orderId).all();

  return Array.isArray(result?.results) ? result.results : [];
}

async function hasCompletedCashbackTx(db, userId, orderId) {
  const row = await db.prepare(`
    SELECT id
    FROM wallet_transactions
    WHERE user_id = ?
      AND order_id = ?
      AND type = 'cashback'
      AND status = 'completed'
    LIMIT 1
  `).bind(userId, orderId).first();

  return !!row;
}

async function hasCashbackReversalTx(db, userId, orderId) {
  const row = await db.prepare(`
    SELECT id
    FROM wallet_transactions
    WHERE user_id = ?
      AND order_id = ?
      AND type = 'debit'
      AND source = 'cashback_reversal'
      AND status = 'completed'
    LIMIT 1
  `).bind(userId, orderId).first();

  return !!row;
}

async function applyCashbackIfNeeded(db, order, actorUserId) {
  const orderId = Number(order?.id || 0);
  const userId = Number(order?.user_id || 0);
  const cashbackAmount = Math.max(0, Math.round(normalizeNumber(order?.cashback_amount)));

  if (!orderId || !userId || cashbackAmount <= 0) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'none',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();

    return { applied: false, reason: "no_cashback" };
  }

  if (String(order.cashback_status || "").toLowerCase() === "completed") {
    return { applied: false, reason: "already_completed" };
  }

  const alreadyDone = await hasCompletedCashbackTx(db, userId, orderId);
  if (alreadyDone) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();

    return { applied: false, reason: "transaction_exists" };
  }

  const user = await db.prepare(`
    SELECT
      id,
      COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();

  if (!user) {
    return { applied: false, reason: "user_not_found" };
  }

  const balanceBefore = Math.max(0, normalizeNumber(user.wallet_balance));
  const balanceAfter = balanceBefore + cashbackAmount;

  await db.batch([
    db.prepare(`
      UPDATE users
      SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(balanceAfter, userId),

    db.prepare(`
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        status,
        source,
        description,
        note,
        order_id,
        order_number,
        reference_type,
        reference_id,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, 'cashback', ?, ?, ?, 'completed', 'order_completion', ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      userId,
      cashbackAmount,
      balanceBefore,
      balanceAfter,
      `Cashback for completed order ${order.order_number}`,
      `کش‌بک سفارش ${order.order_number}`,
      orderId,
      order.order_number,
      String(orderId),
      actorUserId || null
    ),

    db.prepare(`
      UPDATE orders
      SET cashback_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId)
  ]);

  return { applied: true, amount: cashbackAmount };
}

async function reverseCashbackIfNeeded(db, order, actorUserId) {
  const orderId = Number(order?.id || 0);
  const userId = Number(order?.user_id || 0);
  const cashbackAmount = Math.max(0, Math.round(normalizeNumber(order?.cashback_amount)));

  if (!orderId || !userId || cashbackAmount <= 0) {
    return { reversed: false, reason: "no_cashback" };
  }

  if (String(order.cashback_status || "").toLowerCase() !== "completed") {
    return { reversed: false, reason: "not_completed" };
  }

  const alreadyReversed = await hasCashbackReversalTx(db, userId, orderId);
  if (alreadyReversed) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'reversed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();

    return { reversed: false, reason: "already_reversed" };
  }

  const cashbackExists = await hasCompletedCashbackTx(db, userId, orderId);
  if (!cashbackExists) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'none',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();

    return { reversed: false, reason: "cashback_tx_missing" };
  }

  const user = await db.prepare(`
    SELECT
      id,
      COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();

  if (!user) {
    return { reversed: false, reason: "user_not_found" };
  }

  const balanceBefore = Math.max(0, normalizeNumber(user.wallet_balance));
  const reversalAmount = Math.min(balanceBefore, cashbackAmount);
  const balanceAfter = Math.max(0, balanceBefore - reversalAmount);

  await db.batch([
    db.prepare(`
      UPDATE users
      SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(balanceAfter, userId),

    db.prepare(`
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        status,
        source,
        description,
        note,
        order_id,
        order_number,
        reference_type,
        reference_id,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, 'debit', ?, ?, ?, 'completed', 'cashback_reversal', ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      userId,
      reversalAmount,
      balanceBefore,
      balanceAfter,
      `Cashback reversal for order ${order.order_number}`,
      `برگشت کش‌بک سفارش ${order.order_number}`,
      orderId,
      order.order_number,
      String(orderId),
      actorUserId || null
    ),

    db.prepare(`
      UPDATE orders
      SET cashback_status = 'reversed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId)
  ]);

  return { reversed: true, amount: reversalAmount };
}

// ============================================
// ⭐⭐⭐ وضعیت‌های مجاز سیستم (یکپارچه - 16 وضعیت کامل)
// ============================================

const ALLOWED_UNIFIED_STATUSES = [
  "order_created",
  "payment_pending",
  "payment_success",
  "payment_failed",
  "payment_review",
  "order_confirmed",
  "processing",
  "ready_to_ship",
  "courier_delivery",
  "bus_shipping",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "returned",
  "processing_failed"
];

// ============================================
// ⭐⭐⭐ Status Mapping مرکزی
// ============================================

/**
 * تعیین payment_status بر اساس status (وضعیت یکپارچه)
 * @param {string} status - وضعیت یکپارچه سفارش
 * @param {string} currentPaymentStatus - وضعیت پرداخت فعلی (برای وضعیت‌های خاص)
 * @returns {string} - payment_status مناسب
 */
function getPaymentStatusForOrderStatus(status, currentPaymentStatus = 'pending') {
  const statusMap = {
    // وضعیت‌های ابتدایی سفارش
    'order_created': 'pending',
    'payment_pending': 'pending',
    'payment_success': 'paid',
    'payment_failed': 'failed',
    'payment_review': 'payment_review',
    
    // وضعیت‌های تأیید و پردازش
    'order_confirmed': 'paid',
    'processing': 'paid',
    'ready_to_ship': 'paid',
    'courier_delivery': 'paid',
    'bus_shipping': 'paid',
    'shipped': 'paid',
    'delivered': 'paid',
    'completed': 'paid',
    
    // وضعیت‌های خاص - payment_status را تغییر نمی‌دهیم
    'cancelled': currentPaymentStatus,
    'returned': currentPaymentStatus,
    'processing_failed': currentPaymentStatus
  };

  return statusMap[status] || 'pending';
}

// ============================================
// ⭐⭐ نام‌های فارسی وضعیت‌ها (16 وضعیت کامل)
// ============================================

export const UNIFIED_STATUS_LABELS = {
  'order_created': 'سفارش ثبت شد',
  'payment_pending': 'در انتظار پرداخت',
  'payment_success': 'پرداخت موفق',
  'payment_failed': 'پرداخت ناموفق',
  'payment_review': 'بررسی پرداخت',
  'order_confirmed': 'تأیید سفارش',
  'processing': 'در حال پردازش',
  'ready_to_ship': 'آماده ارسال',
  'courier_delivery': 'ارسال با پیک',
  'bus_shipping': 'ارسال با اتوبوس',
  'shipped': 'ارسال شد',
  'delivered': 'تحویل داده شد',
  'completed': 'تکمیل شد',
  'cancelled': 'لغو شد',
  'returned': 'مرجوع شد',
  'processing_failed': 'پردازش ناموفق'
};

// ============================================
// GET - دریافت لیست سفارش‌ها
// ============================================
export async function onRequestGetList(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user || !isAdmin(user)) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const url = new URL(context.request.url);
    const search = normalizeText(url.searchParams.get("search"));
    const status = normalizeText(url.searchParams.get("status")).toLowerCase();

    const conditions = [];
    const bindings = [];

    if (search) {
      conditions.push(`(
        o.order_number LIKE ?
        OR u.full_name LIKE ?
        OR u.email LIKE ?
        OR u.phone LIKE ?
      )`);
      const q = `%${search}%`;
      bindings.push(q, q, q, q);
    }

    if (status) {
      conditions.push(`LOWER(o.status) = ?`);
      bindings.push(status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await context.env.DB.prepare(`
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.payment_status,
        COALESCE(o.subtotal_amount, 0) AS subtotal_amount,
        COALESCE(o.shipping_amount, 0) AS shipping_amount,
        COALESCE(o.total_amount, 0) AS total_amount,
        COALESCE(o.wallet_used_amount, 0) AS wallet_used_amount,
        COALESCE(o.cashback_amount, 0) AS cashback_amount,
        COALESCE(
          MAX(0, COALESCE(o.total_amount, 0) - COALESCE(o.wallet_used_amount, 0)),
          0
        ) AS payable_amount,
        o.created_at,
        u.full_name,
        u.email,
        u.phone AS user_phone,
        a.full_name AS address_full_name,
        a.address_line AS address_line,
        a.postal_code AS postal_code,
        a.phone AS address_phone,
        a.city AS address_city,
        a.state AS address_state
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN addresses a ON a.id = o.address_id
      ${whereClause}
      ORDER BY o.id DESC
      LIMIT 300
    `).bind(...bindings).all();

    const orders = (Array.isArray(result?.results) ? result.results : []).map((order) => {
      const address = order.address_id ? {
        full_name: order.address_full_name || "",
        address_line: order.address_line || "",
        postal_code: order.postal_code || "",
        phone: order.address_phone || "",
        city: order.address_city || "",
        state: order.address_state || ""
      } : null;

      return {
        ...order,
        subtotal_amount: normalizeNumber(order.subtotal_amount),
        shipping_amount: normalizeNumber(order.shipping_amount),
        total_amount: normalizeNumber(order.total_amount),
        wallet_used_amount: normalizeNumber(order.wallet_used_amount),
        cashback_amount: normalizeNumber(order.cashback_amount),
        payable_amount: Math.max(
          0,
          normalizeNumber(
            order.payable_amount != null
              ? order.payable_amount
              : normalizeNumber(order.total_amount) - normalizeNumber(order.wallet_used_amount)
          )
        ),
        address: address,
        shipping_address: address
      };
    });

    return json({ success: true, orders });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

// ============================================
// GET - دریافت جزئیات یک سفارش
// ============================================
export async function onRequestGet(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user || !isAdmin(user)) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const orderNumber = decodeURIComponent(context.params.order || "").trim();

    if (!orderNumber) {
      return json({ success: false, error: "order_number_required" }, 400);
    }

    const order = await getOrderByNumber(context.env.DB, orderNumber);

    if (!order) {
      return json({ success: false, error: "order_not_found" }, 404);
    }

    const items = await getOrderItems(context.env.DB, order.id);

    const shippingAddress = order.address_id ? {
      full_name: order.address_full_name || "",
      address_line: order.address_line || "",
      postal_code: order.postal_code || "",
      phone: order.address_phone || "",
      city: order.address_city || "",
      state: order.address_state || ""
    } : null;

    return json({
      success: true,
      order: {
        id: Number(order.id || 0),
        order_number: order.order_number || "",
        status: order.status || "order_created",
        payment_status: order.payment_status || "pending",
        subtotal_amount: Number(order.subtotal_amount || 0),
        shipping_amount: Number(order.shipping_amount || 0),
        total_amount: Number(order.total_amount || 0),
        wallet_used_amount: Number(order.wallet_used_amount || 0),
        payable_amount: Math.max(0, Number(order.total_amount || 0) - Number(order.wallet_used_amount || 0)),
        cashback_amount: Number(order.cashback_amount || 0),
        cashback_status: order.cashback_status || "none",
        notes: order.notes || "",
        created_at: order.created_at || null,
        updated_at: order.updated_at || null,
        full_name: order.full_name || "",
        email: order.email || "",
        phone: order.phone || "",
        items_count: items.length,
        items: items,
        shipping_address: shippingAddress,
        address: shippingAddress
      }
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}

// ============================================
// POST - به‌روزرسانی سفارش (یکپارچه - 16 وضعیت)
// ============================================
export async function onRequestPost(context) {
  try {
    console.log('🔥🔥🔥 onRequestPost اجرا شد! تاریخ: 2026-08-21');
    
    const user = await getCurrentUser(context);

    if (!user || !isAdmin(user)) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const body = await context.request.json().catch(() => null);
    
    const orderNumber = normalizeText(
      context.params?.order || 
      body?.order_number || 
      ''
    );

    // ⭐ فقط یک فیلد status از UI دریافت می‌شود
    const nextStatus = normalizeText(body?.status).toLowerCase();

    console.log(`📊 وضعیت دریافتی از پنل: "${nextStatus}"`);

    if (!orderNumber) {
      return json({ success: false, error: "order_number_required" }, 400);
    }

    // ⭐ اعتبارسنجی وضعیت یکپارچه
    if (nextStatus && !ALLOWED_UNIFIED_STATUSES.includes(nextStatus)) {
      return json({ 
        success: false, 
        error: "invalid_order_status",
        allowed: ALLOWED_UNIFIED_STATUSES 
      }, 400);
    }

    const currentOrder = await getOrderByNumber(context.env.DB, orderNumber);

    if (!currentOrder) {
      return json({ success: false, error: "order_not_found" }, 404);
    }

    const oldStatus = String(currentOrder.status || "order_created").toLowerCase();
    const oldPaymentStatus = String(currentOrder.payment_status || "pending").toLowerCase();

    const finalStatus = nextStatus || oldStatus;

    // ⭐⭐ تعیین payment_status بر اساس status (از Mapping مرکزی)
    const finalPaymentStatus = getPaymentStatusForOrderStatus(finalStatus, oldPaymentStatus);

    console.log(`📊 وضعیت نهایی سفارش: "${finalStatus}"`);
    console.log(`📊 وضعیت پرداخت تعیین‌شده: "${finalPaymentStatus}"`);
    console.log(`📊 وضعیت قبلی سفارش: "${oldStatus}"`);
    console.log(`📊 وضعیت قبلی پرداخت: "${oldPaymentStatus}"`);

    // ============================================
    // به‌روزرسانی سفارش در دیتابیس (هر دو فیلد)
    // ============================================
    await context.env.DB.prepare(`
      UPDATE orders
      SET
        status = ?,
        payment_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(finalStatus, finalPaymentStatus, currentOrder.id).run();

    const updatedOrder = await getOrderByNumber(context.env.DB, orderNumber);

    let cashbackResult = null;

    // ⭐⭐⭐ منطق کش‌بک برای تمام وضعیت‌ها
    if (finalStatus === "completed") {
      cashbackResult = await applyCashbackIfNeeded(context.env.DB, updatedOrder, user.id);
    } else if (
      ALLOWED_UNIFIED_STATUSES.filter(s => s !== "completed").includes(finalStatus) &&
      String(updatedOrder.cashback_status || "").toLowerCase() === "completed"
    ) {
      cashbackResult = await reverseCashbackIfNeeded(context.env.DB, updatedOrder, user.id);
    }

    const finalOrder = await getOrderByNumber(context.env.DB, orderNumber);
    const items = await getOrderItems(context.env.DB, finalOrder.id);
    const payableAmount = Math.max(
      0,
      normalizeNumber(finalOrder.total_amount) - normalizeNumber(finalOrder.wallet_used_amount)
    );

    // ============================================
    // ⭐⭐ ارسال اعلان‌های Telegram
    // ============================================
    let notificationResults = {
      admin: null,
      user: null,
      adminSuccess: false,
      userSuccess: false
    };

    try {
      let baseUrl = '';
      try {
        const urlResult = await context.env.DB
          .prepare(`SELECT setting_value FROM app_settings WHERE setting_key = 'site_base_url'`)
          .first();
        if (urlResult) {
          baseUrl = urlResult.setting_value || '';
        }
      } catch (_) {
        baseUrl = '';
      }

      if (!baseUrl) {
        const requestUrl = new URL(context.request.url);
        baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
      }

      console.log(`🌐 Base URL: ${baseUrl}`);

      const orderData = {
        orderId: finalOrder.id,
        orderNumber: finalOrder.order_number,
        totalAmount: normalizeNumber(finalOrder.total_amount),
        shippingAmount: normalizeNumber(finalOrder.shipping_amount),
        walletUsedAmount: normalizeNumber(finalOrder.wallet_used_amount),
        payableAmount: payableAmount,
        cashbackAmount: normalizeNumber(finalOrder.cashback_amount),
        status: finalStatus,
        paymentStatus: finalPaymentStatus,
        createdAt: finalOrder.created_at || new Date().toISOString()
      };

      const userData = {
        id: finalOrder.user_id,
        fullName: finalOrder.full_name || '',
        email: finalOrder.email || '',
        phone: finalOrder.phone || ''
      };

      console.log(`📦 Order Data:`, JSON.stringify(orderData, null, 2));

      // ============================================
      // 1️⃣ ارسال به ادمین
      // ============================================
      if (finalStatus !== oldStatus) {
        console.log(`✅ وضعیت تغییر کرده است: ${oldStatus} → ${finalStatus}`);
        
        if (finalStatus === "cancelled") {
          console.log(`🔄 وارد بخش CANCELLED شد!`);
          let refundAmount = 0;
          if (finalPaymentStatus === "paid" || finalPaymentStatus === "completed") {
            refundAmount = payableAmount;
          }
          
          const { sendOrderCancelledNotification, sendUserOrderCancelledNotification } = await import('../../../lib/notification.js');
          
          try {
            notificationResults.admin = await sendOrderCancelledNotification(
              context.env,
              orderData,
              userData,
              refundAmount
            );
            
            if (notificationResults.admin && notificationResults.admin.success) {
              notificationResults.adminSuccess = true;
              console.log(`✅ اعلان لغو سفارش ${orderNumber} با موفقیت به ادمین ارسال شد.`);
            } else {
              const errorMsg = notificationResults.admin?.error || 'خطای ناشناخته';
              notificationResults.adminSuccess = false;
              console.error(`❌ خطا در ارسال اعلان لغو سفارش ${orderNumber} به ادمین:`, errorMsg);
            }
            
            notificationResults.user = await sendUserOrderCancelledNotification(
              context.env,
              orderData,
              userData,
              refundAmount,
              baseUrl
            );
            
            if (notificationResults.user && notificationResults.user.success) {
              notificationResults.userSuccess = true;
              console.log(`✅ اعلان لغو سفارش ${orderNumber} با موفقیت به کاربر ارسال شد.`);
            } else {
              notificationResults.userSuccess = false;
              if (notificationResults.user?.error) {
                console.warn(`⚠️ خطا در ارسال اعلان لغو سفارش به کاربر ${orderNumber}:`, notificationResults.user.error);
              }
            }
            
          } catch (sendError) {
            notificationResults.adminSuccess = false;
            notificationResults.userSuccess = false;
            notificationResults.admin = { success: false, error: String(sendError.message || sendError) };
            console.error(`❌ خطای غیرمنتظره در ارسال اعلان لغو سفارش ${orderNumber}:`, sendError);
          }
        } else {
          console.log(`🔄 وارد بخش OTHER شد! وضعیت: ${finalStatus}`);
          try {
            notificationResults.admin = await sendOrderStatusChangedNotification(
              context.env,
              orderData,
              userData,
              oldStatus,
              finalStatus
            );
            
            if (notificationResults.admin && notificationResults.admin.success) {
              notificationResults.adminSuccess = true;
              console.log(`✅ اعلان تغییر وضعیت سفارش ${orderNumber} با موفقیت ارسال شد.`);
            } else {
              notificationResults.adminSuccess = false;
              console.error(`❌ خطا در ارسال اعلان تغییر وضعیت سفارش ${orderNumber}:`, notificationResults.admin?.error);
            }
          } catch (sendError) {
            notificationResults.adminSuccess = false;
            notificationResults.admin = { success: false, error: String(sendError.message || sendError) };
            console.error(`❌ خطای غیرمنتظره در ارسال اعلان تغییر وضعیت سفارش ${orderNumber}:`, sendError);
          }
        }
      } else {
        console.log(`❌ وضعیت تغییر نکرده است.`);
      }

      // ============================================
      // 2️⃣ ارسال به کاربر (برای وضعیت‌های غیر cancelled)
      // ============================================
      if (finalStatus !== oldStatus && finalStatus !== "cancelled") {
        try {
          notificationResults.user = await sendUserOrderStatusChangedNotification(
            context.env,
            orderData,
            userData,
            oldStatus,
            finalStatus,
            '',
            baseUrl
          );
          
          if (notificationResults.user && notificationResults.user.success) {
            notificationResults.userSuccess = true;
            console.log(`✅ اعلان تغییر وضعیت سفارش ${orderNumber} با موفقیت به کاربر ارسال شد.`);
          } else {
            notificationResults.userSuccess = false;
            if (notificationResults.user?.error) {
              console.warn(`⚠️ خطا در ارسال اعلان به کاربر برای سفارش ${orderNumber}:`, notificationResults.user.error);
            }
          }
        } catch (sendError) {
          notificationResults.userSuccess = false;
          notificationResults.user = { success: false, error: String(sendError.message || sendError) };
          console.error(`❌ خطای غیرمنتظره در ارسال اعلان به کاربر برای سفارش ${orderNumber}:`, sendError);
        }
      }

      // ============================================
      // 3️⃣ ارسال اعلان کش‌بک به کاربر
      // ============================================
      if (finalStatus === "completed" && cashbackResult && cashbackResult.applied) {
        try {
          const { sendCashbackAppliedNotification } = await import('../../../lib/notification.js');
          
          const userWallet = await context.env.DB.prepare(`
            SELECT wallet_balance FROM users WHERE id = ?
          `).bind(finalOrder.user_id).first();
          
          const newBalance = userWallet?.wallet_balance || 0;
          
          const cashbackOrderData = {
            orderId: finalOrder.id,
            orderNumber: finalOrder.order_number,
            status: finalStatus,
            createdAt: finalOrder.created_at || new Date().toISOString()
          };
          
          const cashbackUserData = {
            id: finalOrder.user_id,
            fullName: finalOrder.full_name || '',
            email: finalOrder.email || '',
            phone: finalOrder.phone || ''
          };
          
          const cashbackNotification = await sendCashbackAppliedNotification(
            context.env,
            cashbackOrderData,
            cashbackUserData,
            cashbackResult.amount,
            newBalance
          );
          
          if (cashbackNotification && cashbackNotification.success) {
            console.log(`✅ اعلان کش‌بک سفارش ${orderNumber} با موفقیت به کاربر ارسال شد.`);
          } else {
            console.warn(`⚠️ خطا در ارسال اعلان کش‌بک سفارش ${orderNumber}:`, cashbackNotification?.error);
          }
        } catch (cashbackError) {
          console.error('❌ خطا در ارسال اعلان کش‌بک:', cashbackError);
        }
      }

    } catch (notificationError) {
      console.error('❌ خطای کلی در ارسال اعلان:', notificationError);
      notificationResults.adminSuccess = false;
      notificationResults.userSuccess = false;
    }

    // ============================================
    // پاسخ نهایی با اطلاعات اعلان‌ها
    // ============================================
    return json({
      success: true,
      message: "order_updated",
      cashback_result: cashbackResult,
      notification_results: {
        admin_sent: notificationResults.adminSuccess,
        user_sent: notificationResults.userSuccess,
        admin_details: notificationResults.admin ? {
          success: notificationResults.admin.success || false,
          error: notificationResults.admin.error || null
        } : null,
        user_details: notificationResults.user ? {
          success: notificationResults.user.success || false,
          error: notificationResults.user.error || null
        } : null
      },
      order: {
        ...finalOrder,
        subtotal_amount: normalizeNumber(finalOrder.subtotal_amount),
        shipping_amount: normalizeNumber(finalOrder.shipping_amount),
        total_amount: normalizeNumber(finalOrder.total_amount),
        wallet_used_amount: normalizeNumber(finalOrder.wallet_used_amount),
        cashback_amount: normalizeNumber(finalOrder.cashback_amount),
        payable_amount: payableAmount,
        items
      }
    });
  } catch (error) {
    console.error('❌ خطای کلی در به‌روزرسانی سفارش:', error);
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

// ============================================
// DELETE - حذف سفارش
// ============================================
export async function onRequestDelete(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user || !isAdmin(user)) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const body = await context.request.json().catch(() => null);
    const orderNumber = normalizeText(body?.order_number);

    if (!orderNumber) {
      return json({ success: false, error: "order_number_required" }, 400);
    }

    const order = await getOrderByNumber(context.env.DB, orderNumber);

    if (!order) {
      return json({ success: false, error: "order_not_found" }, 404);
    }

    await context.env.DB.batch([
      context.env.DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(order.id),
      context.env.DB.prepare(`DELETE FROM orders WHERE id = ?`).bind(order.id)
    ]);

    return json({ success: true, message: "order_deleted" });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}