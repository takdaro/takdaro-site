// ============================================
// API پیگیری سفارش از طریق تلگرام
// ============================================

import { getSessionUser } from '../../../lib/db.js';
import { findTelegramConnectionByUserId } from '../../../lib/db.js';
import { updateTelegramLastUsed } from '../../../lib/db.js';
import { sendUserOrderTrackingNotification } from '../../../lib/notification.js';

function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split('; ');
  const target = cookies.find((item) => item.startsWith(key + '='));
  return target ? target.slice(key.length + 1) : null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestPost(context) {
  try {
    const { env, request } = context;

    // دریافت Session ID از Cookie
    const cookieString = request.headers.get('cookie') || '';
    const sessionId = getCookie(cookieString, 'session_id');

    if (!sessionId) {
      return json({ success: false, error: 'unauthorized' }, 401);
    }

    // دریافت اطلاعات کاربر از Session
    const user = await getSessionUser(env, sessionId);

    if (!user) {
      return json({ success: false, error: 'unauthorized' }, 401);
    }

    // دریافت داده‌های درخواست
    const body = await request.json().catch(() => null);

    if (!body || !body.order_number) {
      return json({
        success: false,
        error: 'شماره سفارش الزامی است.'
      }, 400);
    }

    const orderNumber = String(body.order_number).trim();

    if (!orderNumber) {
      return json({
        success: false,
        error: 'شماره سفارش معتبر نیست.'
      }, 400);
    }

    // دریافت اطلاعات سفارش
    const order = await env.DB
      .prepare(`
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.payment_status,
          o.subtotal_amount,
          o.shipping_amount,
          o.total_amount,
          o.wallet_used_amount,
          o.payable_amount,
          o.cashback_amount,
          o.cashback_status,
          o.created_at,
          o.updated_at,
          o.address_id,
          a.full_name AS shipping_full_name,
          a.address_line AS shipping_address_line,
          a.postal_code AS shipping_postal_code,
          a.phone AS shipping_phone,
          a.city AS shipping_city,
          a.state AS shipping_state
        FROM orders o
        LEFT JOIN addresses a ON a.id = o.address_id
        WHERE o.user_id = ?
          AND o.order_number = ?
        LIMIT 1
      `)
      .bind(user.id, orderNumber)
      .first();

    if (!order) {
      return json({
        success: false,
        error: 'سفارش مورد نظر یافت نشد.'
      }, 404);
    }

    // دریافت آیتم‌های سفارش
    const itemsResult = await env.DB
      .prepare(`
        SELECT
          id,
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price
        FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `)
      .bind(order.id)
      .all();

    const items = Array.isArray(itemsResult?.results)
      ? itemsResult.results.map((item) => ({
          id: Number(item.id || 0),
          product_id: item.product_id == null ? null : Number(item.product_id || 0),
          product_name: item.product_name || '',
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          total_price: Number(item.total_price || 0)
        }))
      : [];

    // بررسی اتصال تلگرام کاربر
    const connection = await findTelegramConnectionByUserId(env, user.id);

    if (!connection) {
      return json({
        success: false,
        error: 'شما به تلگرام متصل نیستید. لطفاً ابتدا اتصال را برقرار کنید.'
      });
    }

    // ساخت داده‌های سفارش
    const orderData = {
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      subtotalAmount: Number(order.subtotal_amount || 0),
      shippingAmount: Number(order.shipping_amount || 0),
      totalAmount: Number(order.total_amount || 0),
      walletUsedAmount: Number(order.wallet_used_amount || 0),
      payableAmount: Number(order.payable_amount || 0),
      cashbackAmount: Number(order.cashback_amount || 0),
      cashbackStatus: order.cashback_status || 'none',
      createdAt: order.created_at,
      updatedAt: order.updated_at
    };

    // ساخت داده‌های کاربر
    const userData = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone
    };

    // دریافت آدرس پایه سایت
    const baseUrl = env.SITE_BASE_URL || 'https://takdaro.com';

    // ارسال پیام پیگیری
    const result = await sendUserOrderTrackingNotification(
      env,
      orderData,
      userData,
      items,
      baseUrl
    );

    // به‌روزرسانی last_used_at
    await updateTelegramLastUsed(env, user.id);

    if (!result.success) {
      return json({
        success: false,
        error: result.error || 'ارسال پیام با خطا مواجه شد.'
      });
    }

    return json({
      success: true,
      message: 'پیام پیگیری سفارش با موفقیت ارسال شد.',
      log_id: result.log_id
    });

  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}