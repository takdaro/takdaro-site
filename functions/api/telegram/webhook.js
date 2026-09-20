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
    await sendTelegramMessage(
      botToken,
      chatId,
      '🤖 <b>به ربات رسمی تک تجارت خوش آمدید!</b>\n\nبرای اتصال حساب کاربری و مشاهدهٔ سفارش‌ها از وب‌سایت اقدام کنید. برای دریافت راهنمایی نیز می‌توانید با پشتیبانی گفتگو کنید.',
      { replyMarkup: [
        [{ text: '🌐 ورود به وب‌سایت', url: env.SITE_BASE_URL || 'https://www.takdaro.com' }],
        [{ text: '💬 پشتیبانی', callback_data: 'support:start' }]
      ] }
    );
    return { success: true, guest: true };
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

  // پس از اتصال، آخرین فاکتور کاربر را خودکار نمایش بده؛
  // کاربر دیگر لازم نیست جداگانه دستور /status را ارسال کند.
  await handleStatusCommand(env, chatId, botToken);

  return { success: true, userId };
}

async function telegramApi(botToken, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  return response.json().catch(() => null);
}

async function getAdminChatId(env) {
  const row = await env.DB.prepare('SELECT config FROM notification_settings WHERE channel = ? LIMIT 1').bind('telegram').first();
  try { return row?.config ? JSON.parse(row.config)?.chat_id : null; } catch (_) { return null; }
}

async function setSupportSession(env, chatId, isOpen) {
  await env.DB.prepare(`INSERT INTO telegram_support_sessions (customer_chat_id, is_open, opened_at, closed_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CASE WHEN ? = 1 THEN NULL ELSE CURRENT_TIMESTAMP END)
    ON CONFLICT(customer_chat_id) DO UPDATE SET is_open = excluded.is_open, closed_at = excluded.closed_at`).bind(String(chatId), isOpen ? 1 : 0, isOpen ? 1 : 0).run();
}

async function isSupportOpen(env, chatId) {
  const row = await env.DB.prepare('SELECT is_open FROM telegram_support_sessions WHERE customer_chat_id = ? LIMIT 1').bind(String(chatId)).first();
  return !row || Number(row.is_open) === 1;
}

async function handleSupportMessage(env, botToken, message) {
  const chatId = message.chat?.id;
  const adminChatId = await getAdminChatId(env);
  if (!adminChatId) return false;
  const connection = await env.DB.prepare('SELECT user_id FROM user_telegram_connections WHERE chat_id = ? AND is_active = 1 LIMIT 1').bind(chatId).first();
  const replyTo = message.reply_to_message?.caption || message.reply_to_message?.text || '';
  const customerIdMatch = replyTo.match(/CUSTOMER_CHAT_ID:(-?\d+)/);
  if (String(chatId) === String(adminChatId) && customerIdMatch) {
    const target = customerIdMatch[1];
    if (message.text) await telegramApi(botToken, 'sendMessage', { chat_id: target, text: `💬 <b>پشتیبانی</b>\n\n${message.text}`, parse_mode: 'HTML' });
    else if (message.voice?.file_id) await telegramApi(botToken, 'sendVoice', { chat_id: target, voice: message.voice.file_id, caption: '💬 پاسخ پشتیبانی' });
    else if (message.photo?.length) await telegramApi(botToken, 'sendPhoto', { chat_id: target, photo: message.photo.at(-1).file_id, caption: '💬 پاسخ پشتیبانی' });
    return true;
  }
  if (!(await isSupportOpen(env, chatId))) {
    await sendTelegramMessage(botToken, chatId, '🔒 این گفت‌وگو بسته شده است. برای درخواست جدید، دوباره روی دکمهٔ پشتیبانی بزنید.');
    return true;
  }
  if (!connection && !message.text && !message.photo && !message.voice) return false;
  const user = connection
    ? await env.DB.prepare('SELECT full_name, phone FROM users WHERE id = ? LIMIT 1').bind(connection.user_id).first()
    : { full_name: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'کاربر تلگرام', phone: '' };
  const header = `📩 <b>پیام پشتیبانی مشتری</b>\n👤 ${user?.full_name || '-'}\n📱 ${user?.phone || '-'}\n🆔 <code>CUSTOMER_CHAT_ID:${chatId}</code>`;
  await setSupportSession(env, chatId, true);
  const closeMarkup = { inline_keyboard: [[{ text: '🔒 بستن مکالمه', callback_data: `support:close:${chatId}` }]] };
  if (message.text) await telegramApi(botToken, 'sendMessage', { chat_id: adminChatId, text: `${header}\n\n📝 ${message.text}`, parse_mode: 'HTML', reply_markup: closeMarkup });
  else if (message.voice?.file_id) await telegramApi(botToken, 'sendVoice', { chat_id: adminChatId, voice: message.voice.file_id, caption: header, parse_mode: 'HTML', reply_markup: closeMarkup });
  else if (message.photo?.length) await telegramApi(botToken, 'sendPhoto', { chat_id: adminChatId, photo: message.photo.at(-1).file_id, caption: header, parse_mode: 'HTML', reply_markup: closeMarkup });
  return true;
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

    const callback = body.callback_query;
    if (callback) {
      const botToken = env.TELEGRAM_BOT_TOKEN;
      if (callback.data === 'support:start') {
        await telegramApi(botToken, 'answerCallbackQuery', { callback_query_id: callback.id });
        await setSupportSession(env, callback.message.chat.id, true);
        await sendTelegramMessage(botToken, callback.message.chat.id, '💬 پیام خود را به‌صورت متن، تصویر یا ویس ارسال کنید تا برای پشتیبانی فرستاده شود.');
      } else if (callback.data?.startsWith('support:close:')) {
        const customerChatId = callback.data.slice('support:close:'.length);
        await setSupportSession(env, customerChatId, false);
        await telegramApi(botToken, 'answerCallbackQuery', { callback_query_id: callback.id, text: 'مکالمه بسته شد.' });
        await sendTelegramMessage(botToken, customerChatId, '✅ مکالمهٔ پشتیبانی بسته شد. در صورت نیاز می‌توانید درخواست جدیدی ارسال کنید.');
        await telegramApi(botToken, 'editMessageReplyMarkup', { chat_id: callback.message.chat.id, message_id: callback.message.message_id, reply_markup: { inline_keyboard: [] } });
      }
      return new Response('OK', { status: 200 });
    }

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

    if (text.startsWith('/support')) {
      await setSupportSession(env, chatId, true);
      await sendTelegramMessage(
        botToken,
        chatId,
        '💬 <b>پشتیبانی تک تجارت</b>\n\nپیام خود را به‌صورت متن، تصویر یا ویس ارسال کنید تا برای کارشناسان پشتیبانی فرستاده شود.',
        { replyMarkup: [[{ text: '💬 شروع پشتیبانی', callback_data: 'support:start' }]] }
      );
      return new Response('OK', { status: 200 });
    }

    if (await handleSupportMessage(env, botToken, message)) {
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
