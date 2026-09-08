// ============================================
// Webhook تلگرام - دریافت و پردازش پیام‌ها
// ============================================

import {
  findTelegramTokenByHash,
  markTelegramTokenAsUsed,
  saveTelegramConnection,
  findTelegramConnectionByUserId
} from '../../lib/db.js';

import {
  sendTelegramMessage,
  getTelegramBotInfo,
  formatNumber,
  formatDate,
  getStatusText
} from '../../lib/telegram.js';

import {
  getUserNotificationPreferences,
  updateUserNotificationPreferences
} from '../../lib/notification.js';

/**
 * ایجاد هش از توکن با استفاده از SHA-256
 * @param {string} token - توکن خام
 * @returns {string} - هش توکن
 */
function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  return crypto.subtle.digest('SHA-256', data).then(hash => {
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  });
}

/**
 * دریافت اطلاعات کاربر از دیتابیس
 */
async function getUserInfo(env, userId) {
  return env.DB
    .prepare(`SELECT id, full_name, email, phone FROM users WHERE id = ?`)
    .bind(userId)
    .first();
}

/**
 * دریافت آخرین سفارش کاربر با جزییات کامل
 */
async function getLastOrder(env, userId) {
  // دریافت آخرین سفارش
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
      ORDER BY o.created_at DESC
      LIMIT 1
    `)
    .bind(userId)
    .first();

  if (!order) return null;

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

  return { order, items };
}

/**
 * ساخت پیام جزییات سفارش
 */
function buildOrderDetailsMessage(order, items) {
  let message = `📋 <b>جزییات آخرین سفارش</b>\n\n`;

  message += `🆔 <b>شماره سفارش:</b>\n`;
  message += `  #${order.order_number || '-'}\n\n`;

  message += `📅 <b>تاریخ ثبت:</b>\n`;
  message += `  ${formatDate(order.created_at)}\n\n`;

  message += `📦 <b>وضعیت سفارش:</b>\n`;
  message += `  ${getStatusText(order.status)}\n\n`;

  // حذف وضعیت پرداخت - فقط وضعیت سفارش نمایش داده می‌شود

  // محصولات
  if (items && items.length > 0) {
    message += `🛍️ <b>محصولات:</b>\n`;
    for (const item of items) {
      const total = Number(item.total_price || 0);
      const qty = Number(item.quantity || 0);
      message += `  • ${item.product_name || 'محصول'} × ${qty} - ${formatNumber(total)} تومان\n`;
    }
    message += `\n`;
  }

  // مبالغ
  message += `💰 <b>خلاصه مبالغ:</b>\n`;
  message += `  جمع محصولات: ${formatNumber(order.subtotal_amount || 0)} تومان\n`;
  if (order.shipping_amount > 0) {
    message += `  هزینه ارسال: ${formatNumber(order.shipping_amount)} تومان\n`;
  }
  if (order.wallet_used_amount > 0) {
    message += `  برداشت از کیف پول: -${formatNumber(order.wallet_used_amount)} تومان\n`;
  }
  message += `  ─────────────────\n`;
  message += `  <b>مبلغ قابل پرداخت: ${formatNumber(order.payable_amount || order.total_amount)} تومان</b>\n`;

  if (order.cashback_amount > 0) {
    message += `\n  🎁 <b>کش‌بک این سفارش: ${formatNumber(order.cashback_amount)} تومان</b>`;
  }

  // آدرس
  if (order.shipping_address_line) {
    message += `\n\n📍 <b>آدرس ارسال:</b>\n`;
    message += `  ${order.shipping_address_line || ''}\n`;
    if (order.shipping_city || order.shipping_state) {
      message += `  ${[order.shipping_city, order.shipping_state].filter(Boolean).join(' - ')}\n`;
    }
    if (order.shipping_postal_code) {
      message += `  کد پستی: ${order.shipping_postal_code}\n`;
    }
    if (order.shipping_phone) {
      message += `  📱 ${order.shipping_phone}\n`;
    }
  }

  return message;
}

/**
 * ارسال پیام خوش‌آمدگویی به کاربر
 */
async function sendWelcomeMessage(env, chatId, botToken, userInfo) {
  const message = `✅ <b>اتصال به تلگرام با موفقیت انجام شد!</b>\n\n` +
    `👤 <b>کاربر:</b>\n` +
    `  ${userInfo.full_name || '-'}\n\n` +
    `🔔 <b>اعلان‌های فعال:</b>\n` +
    `  • در انتظار پرداخت\n` +
    `  • پرداخت موفق\n` +
    `  • تغییر وضعیت سفارش\n` +
    `  • ارسال سفارش\n` +
    `  • تکمیل سفارش\n\n` +
    `📌 <b>دستورات مفید:</b>\n` +
    `  /status - مشاهده آخرین سفارش\n` +
    `  /help - راهنمای ربات\n\n` +
    `📌 <b>نکته:</b>\n` +
    `  می‌توانید تنظیمات اعلان‌ها را از حساب کاربری خود مدیریت کنید.\n` +
    `  برای پیگیری سفارش‌ها از دکمه پیگیری استفاده کنید.`;

  return sendTelegramMessage(botToken, chatId, message);
}

/**
 * ارسال پیام خطا به کاربر
 */
async function sendErrorMessage(env, chatId, botToken, errorText) {
  const message = `❌ <b>خطا</b>\n\n` +
    `${errorText}\n\n` +
    `📌 <b>نکته:</b>\n` +
    `  لطفاً مجدداً از طریق سایت اقدام کنید.`;

  return sendTelegramMessage(botToken, chatId, message);
}

/**
 * پردازش دستور /status - نمایش آخرین سفارش
 */
async function handleStatusCommand(env, chatId, botToken) {
  // پیدا کردن کاربر با chat_id
  const connection = await env.DB
    .prepare(`SELECT user_id FROM user_telegram_connections WHERE chat_id = ? AND is_active = 1`)
    .bind(chatId)
    .first();

  if (!connection) {
    await sendErrorMessage(
      env, chatId, botToken,
      'شما به حساب کاربری خود متصل نیستید.\nلطفاً از طریق سایت اقدام به اتصال کنید.'
    );
    return { success: false, error: 'کاربر متصل نیست.' };
  }

  const userId = connection.user_id;

  // دریافت آخرین سفارش
  const data = await getLastOrder(env, userId);

  if (!data || !data.order) {
    await sendErrorMessage(
      env, chatId, botToken,
      'شما هنوز هیچ سفارشی ثبت نکرده‌اید.'
    );
    return { success: false, error: 'سفارشی وجود ندارد.' };
  }

  // ساخت پیام جزییات
  const message = buildOrderDetailsMessage(data.order, data.items);

  // ارسال پیام
  const result = await sendTelegramMessage(botToken, chatId, message);

  return { success: result.success };
}

/**
 * پردازش دستور /help - نمایش راهنما
 */
async function handleHelpCommand(env, chatId, botToken) {
  const message = `🤖 <b>راهنمای ربات تک تجارت</b>\n\n` +
    `📌 <b>دستورات موجود:</b>\n\n` +
    `  /start - اتصال به حساب کاربری\n` +
    `  /status - مشاهده آخرین سفارش با جزییات کامل\n` +
    `  /help - نمایش این راهنما\n\n` +
    `🔔 <b>اعلان‌های خودکار:</b>\n` +
    `  • ثبت سفارش جدید\n` +
    `  • پرداخت موفق\n` +
    `  • تغییر وضعیت سفارش\n` +
    `  • ارسال سفارش\n` +
    `  • تکمیل سفارش\n\n` +
    `📌 <b>نکته:</b>\n` +
    `  برای مدیریت تنظیمات اعلان‌ها به حساب کاربری خود در سایت مراجعه کنید.`;

  return sendTelegramMessage(botToken, chatId, message);
}

/**
 * پردازش دستور /start (اتصال)
 */
async function handleStartCommand(env, chatId, botToken, text, from) {
  // استخراج توکن از متن
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) {
    await sendErrorMessage(
      env, chatId, botToken,
      'لینک اتصال معتبر نیست. لطفاً از طریق سایت اقدام به اتصال کنید.'
    );
    return { success: false, error: 'توکن ارائه نشده است.' };
  }

  const rawToken = parts[1];
  const tokenHash = await hashToken(rawToken);

  // جستجوی توکن در دیتابیس
  const tokenRecord = await findTelegramTokenByHash(env, tokenHash);

  if (!tokenRecord) {
    await sendErrorMessage(
      env, chatId, botToken,
      'لینک اتصال نامعتبر است. لطفاً درخواست جدیدی از سایت ارسال کنید.'
    );
    return { success: false, error: 'توکن یافت نشد.' };
  }

  // بررسی انقضای توکن
  const now = new Date();
  const expiresAt = new Date(tokenRecord.expires_at);
  if (now > expiresAt) {
    await sendErrorMessage(
      env, chatId, botToken,
      'لینک اتصال منقضی شده است. لطفاً درخواست جدیدی از سایت ارسال کنید.'
    );
    return { success: false, error: 'توکن منقضی شده است.' };
  }

  // بررسی استفاده‌شده بودن توکن
  if (tokenRecord.is_used === 1) {
    await sendErrorMessage(
      env, chatId, botToken,
      'این لینک قبلاً استفاده شده است. لطفاً درخواست جدیدی از سایت ارسال کنید.'
    );
    return { success: false, error: 'توکن قبلاً استفاده شده است.' };
  }

  const userId = tokenRecord.user_id;

  // دریافت اطلاعات کاربر
  const userInfo = await getUserInfo(env, userId);
  if (!userInfo) {
    await sendErrorMessage(
      env, chatId, botToken,
      'کاربر مورد نظر یافت نشد.'
    );
    return { success: false, error: 'کاربر یافت نشد.' };
  }

  // بررسی اینکه chat_id قبلاً به کاربر دیگری متصل نشده باشد
  const existingConnection = await env.DB
    .prepare(`SELECT user_id FROM user_telegram_connections WHERE chat_id = ? AND is_active = 1`)
    .bind(chatId)
    .first();

  if (existingConnection && existingConnection.user_id !== userId) {
    await sendErrorMessage(
      env, chatId, botToken,
      'این حساب تلگرام قبلاً به کاربر دیگری متصل شده است.'
    );
    return { success: false, error: 'chat_id قبلاً استفاده شده است.' };
  }

  // ذخیره اتصال
  const fromInfo = {
    id: from.id,
    username: from.username,
    first_name: from.first_name,
    last_name: from.last_name
  };

  await saveTelegramConnection(env, userId, chatId, fromInfo);

  // علامت‌گذاری توکن به عنوان استفاده‌شده
  await markTelegramTokenAsUsed(env, tokenRecord.id);

  // ⭐ ایجاد تنظیمات پیش‌فرض اعلان برای کاربر بر اساس ۱۱ وضعیت رسمی
  const existingPrefs = await getUserNotificationPreferences(env, userId);
  if (!existingPrefs) {
    await updateUserNotificationPreferences(env, userId, {
      payment_pending: 1,
      payment_success: 1,
      payment_failed: 1,
      order_confirmed: 1,
      courier_delivery: 1,
      bus_shipping: 1,
      shipped: 1,
      delivered: 1,
      completed: 1,
      cancelled: 1,
      returned: 1,
      announcements: 0,
      promotions: 0,
      marketing: 0
    });
  }

  // ارسال پیام موفقیت
  await sendWelcomeMessage(env, chatId, botToken, userInfo);

  return { success: true, userId };
}

/**
 * Webhook اصلی
 */
export async function onRequestPost(context) {
  try {
    const { env, request } = context;

    // دریافت Secret Token از هدر
    const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;

    // اعتبارسنجی Secret Token
    if (expectedSecret && secretToken !== expectedSecret) {
      return new Response('Unauthorized', { status: 401 });
    }

    // دریافت بدنه درخواست
    const body = await request.json();

    // دریافت اطلاعات پیام
    const message = body.message;
    if (!message) {
      return new Response('OK', { status: 200 });
    }

    const chat = message.chat;
    const chatId = chat.id;
    const text = message.text || '';
    const from = message.from || {};

    // دریافت تنظیمات تلگرام
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN تنظیم نشده است.');
      return new Response('Bot token not configured', { status: 500 });
    }

    // پردازش دستورات
    if (text.startsWith('/start')) {
      await handleStartCommand(env, chatId, botToken, text, from);
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/status')) {
      await handleStatusCommand(env, chatId, botToken);
      return new Response('OK', { status: 200 });
    }

    if (text.startsWith('/help')) {
      await handleHelpCommand(env, chatId, botToken);
      return new Response('OK', { status: 200 });
    }

    // پردازش سایر پیام‌ها
    const unknownMessage = `🤖 <b>سلام!</b>\n\n` +
      `من ربات اطلاع‌رسانی تک تجارت هستم.\n\n` +
      `📌 <b>دستورات موجود:</b>\n` +
      `  /status - مشاهده آخرین سفارش\n` +
      `  /help - راهنمای ربات\n\n` +
      `📌 <b>نکته:</b>\n` +
      `  این ربات برای ارسال اعلان‌های سفارش و پرداخت استفاده می‌شود.\n` +
      `  برای اتصال به حساب کاربری خود، لطفاً از سایت اقدام کنید.`;

    await sendTelegramMessage(botToken, chatId, unknownMessage);

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}