// ============================================
// سرویس اصلی اعلان‌ها (Notification Service)
// ============================================

import { 
  sendTelegramMessage,
  createOrderViewButton,
  createUserViewButton,
  createUserOrderTrackingButton,
  buildOrderCreatedMessage,
  buildPaymentSuccessMessage,
  buildPaymentStatusChangedMessage,
  buildOrderStatusChangedMessage,
  buildOrderCancelledMessage,
  buildRefundMessage,
  buildWalletTopupMessage,
  buildWalletWithdrawalRequestMessage,
  buildWalletWithdrawalStatusMessage,
  buildCashbackAppliedMessage,
  buildUserOrderCreatedMessage,
  buildUserPaymentSuccessMessage,
  buildUserOrderStatusChangedMessage,
  buildUserOrderTrackingMessage,
  buildUserOrderCancelledMessage
} from './telegram.js';

import {
  getSmsSettings,
  sendSms,
  markSmsAsSent,
  markSmsAsFailed,
  logGatewayActivity,
  getSmsTemplate,
  renderSmsTemplate,
  sendSmsWithTemplate
} from './sms.js';

// ============================================
// توابع کمکی عمومی
// ============================================

/**
 * دریافت تنظیمات یک کانال از دیتابیس
 * @param {Object} env - محیط Cloudflare
 * @param {string} channel - نام کانال ('telegram' | 'email' | 'sms')
 * @returns {Promise<Object|null>} - تنظیمات کانال یا null
 */
export async function getChannelSettings(env, channel) {
  const result = await env.DB
    .prepare(`
      SELECT 
        id,
        channel,
        is_enabled,
        config,
        updated_by_user_id,
        updated_at
      FROM notification_settings
      WHERE channel = ?
      LIMIT 1
    `)
    .bind(channel)
    .first();

  if (!result) return null;

  let config = {};
  try {
    if (result.config && typeof result.config === 'string') {
      config = JSON.parse(result.config);
    } else if (result.config && typeof result.config === 'object') {
      config = result.config;
    }
  } catch (_) {
    config = {};
  }

  return {
    id: result.id,
    channel: result.channel,
    is_enabled: result.is_enabled === 1,
    config: config,
    updated_by_user_id: result.updated_by_user_id,
    updated_at: result.updated_at
  };
}

/**
 * ذخیره یا به‌روزرسانی تنظیمات یک کانال
 * @param {Object} env - محیط Cloudflare
 * @param {string} channel - نام کانال
 * @param {Object} config - تنظیمات کانال
 * @param {number} userId - شناسه کاربر تغییردهنده
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function saveChannelSettings(env, channel, config, userId) {
  const allowedChannels = ['telegram', 'email', 'sms'];
  if (!allowedChannels.includes(channel)) {
    throw new Error(`کانال ${channel} معتبر نیست.`);
  }

  if (channel === 'telegram') {
    if (config.bot_token && config.bot_token.length < 20) {
      throw new Error('توکن ربات تلگرام معتبر نیست.');
    }
    if (config.chat_id && !config.chat_id.trim()) {
      throw new Error('شناسه چت تلگرام معتبر نیست.');
    }
  }

  const existing = await env.DB
    .prepare(`SELECT id FROM notification_settings WHERE channel = ?`)
    .bind(channel)
    .first();

  const configJson = JSON.stringify(config);

  if (existing) {
    await env.DB
      .prepare(`
        UPDATE notification_settings
        SET config = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE channel = ?
      `)
      .bind(configJson, userId, channel)
      .run();
  } else {
    await env.DB
      .prepare(`
        INSERT INTO notification_settings (channel, is_enabled, config, updated_by_user_id, created_at, updated_at)
        VALUES (?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(channel, configJson, userId)
      .run();
  }

  return { success: true, channel, config };
}

/**
 * فعال/غیرفعال کردن یک کانال
 * @param {Object} env - محیط Cloudflare
 * @param {string} channel - نام کانال
 * @param {boolean} enabled - فعال/غیرفعال
 * @param {number} userId - شناسه کاربر تغییردهنده
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function toggleChannel(env, channel, enabled, userId) {
  const existing = await env.DB
    .prepare(`SELECT id FROM notification_settings WHERE channel = ?`)
    .bind(channel)
    .first();

  if (!existing) {
    throw new Error(`تنظیمات کانال ${channel} یافت نشد.`);
  }

  await env.DB
    .prepare(`
      UPDATE notification_settings
      SET is_enabled = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE channel = ?
    `)
    .bind(enabled ? 1 : 0, userId, channel)
    .run();

  return { success: true, channel, is_enabled: enabled };
}

/**
 * ثبت لاگ ارسال اعلان
 * @param {Object} env - محیط Cloudflare
 * @param {Object} data - اطلاعات لاگ
 * @returns {Promise<number>} - شناسه لاگ ایجاد شده
 */
export async function logNotification(env, data) {
  const {
    eventType,
    channel,
    recipient,
    subject,
    content,
    status,
    errorMessage,
    orderId,
    userId,
    isUserNotification
  } = data;

  try {
    const result = await env.DB
      .prepare(`
        INSERT INTO notification_logs (
          event_type,
          channel,
          recipient,
          subject,
          content,
          status,
          error_message,
          order_id,
          user_id,
          is_user_notification,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        eventType || 'order_created',
        channel || 'telegram',
        recipient || null,
        subject || null,
        content || null,
        status || 'pending',
        errorMessage || null,
        orderId || null,
        userId || null,
        isUserNotification ? 1 : 0
      )
      .run();

    return result.meta?.last_row_id || null;
  } catch (error) {
    console.error('❌ logNotification error:', error);
    console.error('📋 logNotification data:', { eventType, channel, recipient, orderId, userId, isUserNotification });
    return null;
  }
}

/**
 * به‌روزرسانی وضعیت لاگ
 * @param {Object} env - محیط Cloudflare
 * @param {number} logId - شناسه لاگ
 * @param {string} status - وضعیت جدید ('sent' | 'failed')
 * @param {string} errorMessage - پیام خطا (اختیاری)
 * @returns {Promise<boolean>} - نتیجه عملیات
 */
export async function updateLogStatus(env, logId, status, errorMessage = null) {
  await env.DB
    .prepare(`
      UPDATE notification_logs
      SET 
        status = ?,
        error_message = COALESCE(?, error_message),
        sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END
      WHERE id = ?
    `)
    .bind(status, errorMessage, status, logId)
    .run();

  return true;
}

/**
 * بررسی وجود لاگ تکراری برای جلوگیری از ارسال مجدد
 * @param {Object} env - محیط Cloudflare
 * @param {string} eventType - نوع رویداد
 * @param {string} referenceId - شناسه مرجع (مثلاً order_id)
 * @param {string} channel - کانال
 * @param {number} hours - بازه زمانی (ساعت)
 * @returns {Promise<boolean>} - true اگر تکراری وجود دارد
 */
export async function hasDuplicateLog(env, eventType, referenceId, channel = 'telegram', hours = 1) {
  const result = await env.DB
    .prepare(`
      SELECT id
      FROM notification_logs
      WHERE event_type = ?
        AND channel = ?
        AND order_id = ?
        AND status = 'sent'
        AND created_at > datetime('now', '-' || ? || ' hours')
      LIMIT 1
    `)
    .bind(eventType, channel, referenceId, hours)
    .first();

  return !!result;
}

// ============================================
// تابع اصلی ارسال اعلان به تلگرام
// ============================================

/**
 * تابع داخلی برای ارسال اعلان به تلگرام
 */
async function sendTelegramNotification(env, eventType, message, replyMarkup = null, referenceId = null, checkDuplicate = true) {
  const results = [];

  // دریافت تنظیمات تلگرام
  const telegramSettings = await getChannelSettings(env, 'telegram');
  
  if (!telegramSettings || !telegramSettings.is_enabled) {
    results.push({
      channel: 'telegram',
      success: false,
      error: 'کانال تلگرام فعال نیست یا تنظیمات وجود ندارد.'
    });
    return { success: false, results };
  }

  const config = telegramSettings.config || {};
  const botToken = config.bot_token || env.TELEGRAM_BOT_TOKEN;
  const chatId = config.chat_id;

  if (!botToken || !chatId) {
    results.push({
      channel: 'telegram',
      success: false,
      error: 'تنظیمات تلگرام کامل نیست (Bot Token یا Chat ID موجود نیست).'
    });
    return { success: false, results };
  }

  // بررسی تکراری بودن
  if (checkDuplicate && referenceId) {
    const isDuplicate = await hasDuplicateLog(env, eventType, referenceId, 'telegram', 1);
    if (isDuplicate) {
      results.push({
        channel: 'telegram',
        success: false,
        error: 'اعلان تکراری تشخیص داده شد (در یک ساعت گذشته ارسال شده است).'
      });
      return { success: false, results };
    }
  }

  // ثبت لاگ اولیه
  const logId = await logNotification(env, {
    eventType: eventType,
    channel: 'telegram',
    recipient: chatId,
    subject: message.substring(0, 100),
    content: message,
    status: 'pending',
    orderId: referenceId
  });

  // ارسال پیام
  const sendResult = await sendTelegramMessage(botToken, chatId, message, { replyMarkup });

  if (sendResult.success) {
    await updateLogStatus(env, logId, 'sent');
    results.push({
      channel: 'telegram',
      success: true,
      message_id: sendResult.message_id,
      log_id: logId
    });
  } else {
    await updateLogStatus(env, logId, 'failed', sendResult.error);
    results.push({
      channel: 'telegram',
      success: false,
      error: sendResult.error,
      log_id: logId
    });
  }

  return { success: sendResult.success, results };
}

// ============================================
// تابع اصلی ارسال اعلان به SMS (با Template)
// ============================================

/**
 * تابع داخلی برای ارسال اعلان به SMS با استفاده از Template
 */
async function sendSmsNotification(env, eventType, recipient, templateData = {}, referenceId = null, checkDuplicate = true) {
  // دریافت تنظیمات SMS
  const smsSettings = await getSmsSettings(env);
  
  if (!smsSettings.is_enabled) {
    return {
      success: false,
      error: 'کانال SMS فعال نیست.'
    };
  }

  if (!recipient) {
    return {
      success: false,
      error: 'شماره گیرنده مشخص نیست.'
    };
  }

  // بررسی تکراری بودن
  if (checkDuplicate && referenceId) {
    const isDuplicate = await hasDuplicateLog(env, eventType, referenceId, 'sms', 1);
    if (isDuplicate) {
      return {
        success: false,
        error: 'اعلان تکراری تشخیص داده شد (در یک ساعت گذشته ارسال شده است).'
      };
    }
  }

  // ارسال SMS با Template
  const sendResult = await sendSmsWithTemplate(env, {
    eventType: eventType,
    recipient: recipient,
    data: templateData,
    referenceId: referenceId,
    referenceType: 'order',
    createdByUserId: null
  });

  if (sendResult.success) {
    return {
      success: true,
      message_id: sendResult.messageId,
      rendered: sendResult.rendered,
      template: sendResult.template
    };
  } else {
    return {
      success: false,
      error: sendResult.error || 'ارسال SMS انجام نشد.'
    };
  }
}

// ============================================
// 1. اعلان سفارش جدید (ادمین) - با Template مجزا
// ============================================
export async function sendOrderCreatedNotification(env, orderData, userData, items, baseUrl = '') {
  const message = buildOrderCreatedMessage(orderData, userData, items);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, baseUrl);
  
  // ارسال به تلگرام ادمین
  const telegramResult = await sendTelegramNotification(
    env,
    'order_created',
    message,
    replyMarkup,
    orderData.orderId,
    true
  );

  // ارسال به SMS ادمین (با Template مجزا)
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_created_admin && smsSettings.admin_phone) {
    // ⭐ استفاده از Template مجزا برای ادمین
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || 'pending',
      order_status: orderData.status || 'pending',
      tracking_code: orderData.trackingCode || '',
      admin_note: 'لطفاً سفارش را بررسی کنید'  // متغیر اختصاصی برای ادمین
    };
    
    smsResult = await sendSmsNotification(
      env,
      'admin_order_created',  // ⭐ رویداد مجزا برای ادمین
      smsSettings.admin_phone,
      templateData,
      orderData.orderId,
      false
    );
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success),
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult
    }
  };
}

// ============================================
// 2. اعلان پرداخت موفق (ادمین) - با Template مجزا
// ============================================
export async function sendPaymentSuccessNotification(env, orderData, userData, paymentMethod = '') {
  const message = buildPaymentSuccessMessage(orderData, userData, paymentMethod);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  const telegramResult = await sendTelegramNotification(
    env,
    'payment_success',
    message,
    replyMarkup,
    orderData.orderId,
    true
  );

  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_payment_success_admin && smsSettings.admin_phone) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      payment_status: 'paid',
      order_status: orderData.status || 'pending',
      tracking_code: orderData.trackingCode || '',
      admin_note: 'پرداخت تأیید شد'  // متغیر اختصاصی برای ادمین
    };
    
    smsResult = await sendSmsNotification(
      env,
      'admin_payment_success',  // ⭐ رویداد مجزا برای ادمین
      smsSettings.admin_phone,
      templateData,
      orderData.orderId,
      true
    );
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success),
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult
    }
  };
}

// ============================================
// 3. اعلان تغییر وضعیت پرداخت (ادمین)
// ============================================
export async function sendPaymentStatusChangedNotification(env, orderData, userData, oldStatus, newStatus) {
  const message = buildPaymentStatusChangedMessage(orderData, userData, oldStatus, newStatus);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  return sendTelegramNotification(
    env,
    'payment_status_changed',
    message,
    replyMarkup,
    orderData.orderId,
    true
  );
}

// ============================================
// 4. اعلان تغییر وضعیت سفارش (ادمین) - با Template
// ============================================
export async function sendOrderStatusChangedNotification(env, orderData, userData, oldStatus, newStatus) {
  const message = buildOrderStatusChangedMessage(orderData, userData, oldStatus, newStatus);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  // ارسال به تلگرام
  const telegramResult = await sendTelegramNotification(
    env,
    'order_status_changed',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

  // ارسال به SMS (ادمین) با Template (فقط در صورت فعال بودن)
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  
  // بررسی اینکه آیا برای این وضعیت Template فعال است
  if (smsSettings.is_enabled && smsSettings.event_order_status_changed_user && smsSettings.admin_phone) {
    // تعیین eventType بر اساس وضعیت جدید - استفاده مستقیم از وضعیت
    let eventType = newStatus || 'order_processing';
    
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || 'pending',
      order_status: newStatus || 'pending',
      tracking_code: orderData.trackingCode || ''
    };
    
    smsResult = await sendSmsNotification(
      env,
      eventType,
      smsSettings.admin_phone,
      templateData,
      orderData.orderId,
      false
    );
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success),
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult
    }
  };
}

// ============================================
// 5. اعلان لغو سفارش (ادمین) - با Template
// ============================================
export async function sendOrderCancelledNotification(env, orderData, userData, refundAmount = 0) {
  const message = buildOrderCancelledMessage(orderData, userData, refundAmount);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  // ارسال به تلگرام
  const telegramResult = await sendTelegramNotification(
    env,
    'order_cancelled',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

  // ارسال به SMS (ادمین) با Template
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_cancelled_user && smsSettings.admin_phone) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || 'pending',
      order_status: 'cancelled',
      tracking_code: orderData.trackingCode || ''
    };
    
    smsResult = await sendSmsNotification(
      env,
      'order_cancelled',
      smsSettings.admin_phone,
      templateData,
      orderData.orderId,
      false
    );
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success),
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult
    }
  };
}

// ============================================
// 6. اعلان بازپرداخت (Refund)
// ============================================
export async function sendRefundNotification(env, orderData, userData, refundAmount, refundMethod = '') {
  const message = buildRefundMessage(orderData, userData, refundAmount, refundMethod);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  return sendTelegramNotification(
    env,
    'refund',
    message,
    replyMarkup,
    orderData.orderId,
    true
  );
}

// ============================================
// 7. اعلان شارژ کیف پول
// ============================================
export async function sendWalletTopupNotification(env, userData, amount, paymentMethod = '', newBalance = 0) {
  const message = buildWalletTopupMessage(userData, amount, paymentMethod, newBalance);
  const replyMarkup = createUserViewButton(userData.id, '');
  
  return sendTelegramNotification(
    env,
    'wallet_topup',
    message,
    replyMarkup,
    userData.id,
    true
  );
}

// ============================================
// 8. اعلان درخواست برداشت کیف پول
// ============================================
export async function sendWalletWithdrawalRequestNotification(env, userData, amount, destinationInfo = '', requestId = '') {
  const message = buildWalletWithdrawalRequestMessage(userData, amount, destinationInfo, requestId);
  const replyMarkup = createUserViewButton(userData.id, '');
  
  return sendTelegramNotification(
    env,
    'wallet_withdrawal_requested',
    message,
    replyMarkup,
    requestId || userData.id,
    true
  );
}

// ============================================
// 9. اعلان تغییر وضعیت برداشت کیف پول
// ============================================
export async function sendWalletWithdrawalStatusNotification(env, userData, amount, oldStatus, newStatus, requestId = '', reason = '') {
  const message = buildWalletWithdrawalStatusMessage(userData, amount, oldStatus, newStatus, requestId, reason);
  const replyMarkup = createUserViewButton(userData.id, '');
  
  return sendTelegramNotification(
    env,
    newStatus === 'approved' ? 'wallet_withdrawal_approved' : 'wallet_withdrawal_rejected',
    message,
    replyMarkup,
    requestId || userData.id,
    true
  );
}

// ============================================
// 10. اعلان اعمال کش‌بک
// ============================================
export async function sendCashbackAppliedNotification(env, orderData, userData, cashbackAmount, newBalance = 0) {
  const message = buildCashbackAppliedMessage(orderData, userData, cashbackAmount, newBalance);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  return sendTelegramNotification(
    env,
    'cashback_applied',
    message,
    replyMarkup,
    orderData.orderId,
    true
  );
}

// ============================================
// توابع مدیریت و آمار
// ============================================

/**
 * ارسال پیام آزمایشی تلگرام برای تست
 * @param {Object} env - محیط Cloudflare
 * @param {string} botToken - توکن ربات
 * @param {string} chatId - شناسه چت
 * @param {number} userId - شناسه کاربر تست‌کننده
 * @returns {Promise<Object>} - نتیجه تست
 */
export async function testTelegramNotification(env, botToken, chatId, userId) {
  const logId = await logNotification(env, {
    eventType: 'test',
    channel: 'telegram',
    recipient: chatId,
    subject: 'پیام آزمایشی تلگرام',
    content: 'این یک پیام آزمایشی از پنل مدیریت است.',
    status: 'pending'
  });

  const testMessage = `🔔 <b>پیام آزمایشی</b>\n\n✅ اتصال به ربات تلگرام با موفقیت برقرار شد.\n\n🕐 زمان: ${new Date().toLocaleString('fa-IR')}\n\n📌 این پیام از پنل مدیریت ارسال شده است.`;

  const sendResult = await sendTelegramMessage(botToken, chatId, testMessage);

  if (sendResult.success) {
    await updateLogStatus(env, logId, 'sent');
  } else {
    await updateLogStatus(env, logId, 'failed', sendResult.error);
  }

  return {
    success: sendResult.success,
    log_id: logId,
    error: sendResult.error || null
  };
}

/**
 * ارسال پیام آزمایشی SMS برای تست
 * @param {Object} env - محیط Cloudflare
 * @param {string} phoneNumber - شماره تلفن
 * @param {number} userId - شناسه کاربر تست‌کننده
 * @param {string} eventType - نوع رویداد برای Template
 * @returns {Promise<Object>} - نتیجه تست
 */
export async function testSmsNotification(env, phoneNumber, userId, eventType = 'order_created') {
  const logId = await logNotification(env, {
    eventType: 'test',
    channel: 'sms',
    recipient: phoneNumber,
    subject: 'پیام آزمایشی SMS',
    content: 'این یک پیام آزمایشی از پنل مدیریت است.',
    status: 'pending'
  });

  // دریافت Template
  const template = await getSmsTemplate(env, eventType);
  let message = '🔔 پیام آزمایشی\n\n✅ اتصال به سیستم SMS با موفقیت برقرار شد.\n\n📌 این پیام از پنل مدیریت ارسال شده است.';
  
  if (template) {
    const testData = {
      customer_name: 'کاربر تست',
      customer_phone: phoneNumber,
      order_number: 'TT-20260819-TEST',
      amount: '100000',
      payment_status: 'pending',
      order_status: 'pending',
      tracking_code: 'TEST-123456'
    };
    message = renderSmsTemplate(template.message_template, testData);
  }

  const sendResult = await sendSms(env, {
    recipient: phoneNumber,
    message: message,
    eventType: eventType,
    createdByUserId: userId
  });

  if (sendResult.success) {
    await updateLogStatus(env, logId, 'sent');
  } else {
    await updateLogStatus(env, logId, 'failed', sendResult.error);
  }

  return {
    success: sendResult.success,
    log_id: logId,
    error: sendResult.error || null
  };
}

/**
 * دریافت تاریخچه اعلان‌ها
 * @param {Object} env - محیط Cloudflare
 * @param {Object} options - گزینه‌های فیلتر
 * @returns {Promise<Object>} - لیست لاگ‌ها و تعداد کل
 */
export async function getNotificationLogs(env, options = {}) {
  const {
    channel,
    eventType,
    status,
    userId,
    isUserNotification,
    limit = 50,
    offset = 0
  } = options;

  let query = `
    SELECT 
      id,
      event_type,
      channel,
      recipient,
      subject,
      status,
      error_message,
      order_id,
      user_id,
      is_user_notification,
      created_at,
      sent_at
    FROM notification_logs
    WHERE 1=1
  `;

  const params = [];

  if (channel) {
    query += ` AND channel = ?`;
    params.push(channel);
  }

  if (eventType) {
    query += ` AND event_type = ?`;
    params.push(eventType);
  }

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (userId) {
    query += ` AND user_id = ?`;
    params.push(userId);
  }

  if (isUserNotification !== undefined) {
    query += ` AND is_user_notification = ?`;
    params.push(isUserNotification ? 1 : 0);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...params).all();

  let countQuery = `
    SELECT COUNT(*) as total
    FROM notification_logs
    WHERE 1=1
  `;

  const countParams = [];
  if (channel) {
    countQuery += ` AND channel = ?`;
    countParams.push(channel);
  }
  if (eventType) {
    countQuery += ` AND event_type = ?`;
    countParams.push(eventType);
  }
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  if (userId) {
    countQuery += ` AND user_id = ?`;
    countParams.push(userId);
  }
  if (isUserNotification !== undefined) {
    countQuery += ` AND is_user_notification = ?`;
    countParams.push(isUserNotification ? 1 : 0);
  }

  const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

  const logs = Array.isArray(result?.results) ? result.results : [];

  return {
    logs: logs,
    total: countResult?.total || 0,
    limit: limit,
    offset: offset
  };
}

/**
 * دریافت آمار اعلان‌ها
 * @param {Object} env - محیط Cloudflare
 * @returns {Promise<Object>} - آمار
 */
export async function getNotificationStats(env) {
  const totalResult = await env.DB
    .prepare(`SELECT COUNT(*) as total FROM notification_logs`)
    .first();

  const statusResult = await env.DB
    .prepare(`SELECT status, COUNT(*) as count FROM notification_logs GROUP BY status`)
    .all();

  const statusCounts = {};
  if (Array.isArray(statusResult?.results)) {
    for (const row of statusResult.results) {
      statusCounts[row.status] = row.count;
    }
  }

  const channelResult = await env.DB
    .prepare(`SELECT channel, COUNT(*) as count FROM notification_logs GROUP BY channel`)
    .all();

  const channelCounts = {};
  if (Array.isArray(channelResult?.results)) {
    for (const row of channelResult.results) {
      channelCounts[row.channel] = row.count;
    }
  }

  const lastSentResult = await env.DB
    .prepare(`
      SELECT id, event_type, channel, recipient, created_at, sent_at
      FROM notification_logs
      WHERE status = 'sent'
      ORDER BY sent_at DESC
      LIMIT 1
    `)
    .first();

  return {
    total: totalResult?.total || 0,
    status_counts: statusCounts,
    channel_counts: channelCounts,
    last_sent: lastSentResult || null
  };
}

// ============================================
// توابع جدید برای ارسال اعلان به کاربران (با Template)
// ============================================

/**
 * تابع داخلی برای ارسال اعلان به کاربر از طریق تلگرام
 */
async function sendUserTelegramNotification(env, userId, eventType, message, replyMarkup = null, orderId = null, checkDuplicate = true) {
  // دریافت اطلاعات کاربر
  const user = await env.DB
    .prepare(`SELECT id, full_name, email, phone FROM users WHERE id = ?`)
    .bind(userId)
    .first();

  if (!user) {
    return { success: false, error: 'کاربر یافت نشد.' };
  }

  // دریافت chat_id کاربر
  const connection = await env.DB
    .prepare(`SELECT chat_id, is_active FROM user_telegram_connections WHERE user_id = ? AND is_active = 1`)
    .bind(userId)
    .first();

  if (!connection) {
    return { success: false, error: 'کاربر به تلگرام متصل نیست.' };
  }

  // دریافت تنظیمات تلگرام
  const telegramSettings = await getChannelSettings(env, 'telegram');
  if (!telegramSettings || !telegramSettings.is_enabled) {
    return { success: false, error: 'کانال تلگرام فعال نیست.' };
  }

  const config = telegramSettings.config || {};
  const botToken = config.bot_token || env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return { success: false, error: 'توکن ربات تلگرام تنظیم نشده است.' };
  }

  // بررسی تنظیمات اعلان کاربر
  const prefs = await getUserNotificationPreferences(env, userId);
  if (prefs && prefs[eventType] === 0) {
    return { success: false, error: 'این نوع اعلان توسط کاربر غیرفعال شده است.' };
  }

  // بررسی تکراری
  if (checkDuplicate && orderId) {
    const isDuplicate = await hasDuplicateLog(env, eventType, orderId, 'telegram', 1);
    if (isDuplicate) {
      return { success: false, error: 'اعلان تکراری تشخیص داده شد.' };
    }
  }

  // ثبت لاگ
  const logId = await logNotification(env, {
    eventType: eventType,
    channel: 'telegram',
    recipient: connection.chat_id,
    subject: message.substring(0, 100),
    content: message,
    status: 'pending',
    orderId: orderId,
    userId: userId,
    isUserNotification: true
  });

  // ارسال پیام
  const sendResult = await sendTelegramMessage(botToken, connection.chat_id, message, { replyMarkup });

  if (sendResult.success) {
    await updateLogStatus(env, logId, 'sent');
    // به‌روزرسانی last_used_at
    await env.DB
      .prepare(`UPDATE user_telegram_connections SET last_used_at = CURRENT_TIMESTAMP WHERE user_id = ?`)
      .bind(userId)
      .run();
  } else {
    await updateLogStatus(env, logId, 'failed', sendResult.error);
  }

  return {
    success: sendResult.success,
    log_id: logId,
    error: sendResult.error || null
  };
}

// ============================================
// تابع ارسال SMS به کاربر با Template
// ============================================
async function sendUserSmsNotification(env, userId, eventType, templateData = {}, orderId = null, checkDuplicate = true) {
  try {
    console.log(`📱 sendUserSmsNotification - شروع: userId=${userId}, eventType=${eventType}, orderId=${orderId}`);

    // دریافت اطلاعات کاربر
    const user = await env.DB
      .prepare(`SELECT id, full_name, email, phone FROM users WHERE id = ?`)
      .bind(userId)
      .first();

    if (!user) {
      console.log(`❌ sendUserSmsNotification - کاربر یافت نشد: userId=${userId}`);
      return { success: false, error: 'کاربر یافت نشد.' };
    }

    console.log(`📱 sendUserSmsNotification - user: id=${user.id}, phone=${user.phone}, full_name=${user.full_name}`);

    if (!user.phone) {
      console.log(`❌ sendUserSmsNotification - کاربر شماره تلفن ندارد: userId=${userId}`);
      return { success: false, error: 'کاربر شماره تلفن ندارد.' };
    }

    // دریافت تنظیمات SMS
    const smsSettings = await getSmsSettings(env);
    console.log(`📱 sendUserSmsNotification - smsSettings: is_enabled=${smsSettings.is_enabled}`);

    if (!smsSettings.is_enabled) {
      console.log(`❌ sendUserSmsNotification - کانال SMS فعال نیست`);
      return { success: false, error: 'کانال SMS فعال نیست.' };
    }

    // بررسی تنظیمات اعلان کاربر
    const prefs = await getUserNotificationPreferences(env, userId);
    console.log(`📱 sendUserSmsNotification - prefs:`, prefs);

    if (prefs && prefs[eventType] === 0) {
      console.log(`❌ sendUserSmsNotification - کاربر این نوع اعلان را غیرفعال کرده: eventType=${eventType}`);
      return { success: false, error: 'این نوع اعلان توسط کاربر غیرفعال شده است.' };
    }

    // بررسی تکراری
    if (checkDuplicate && orderId) {
      const isDuplicate = await hasDuplicateLog(env, eventType, orderId, 'sms', 1);
      if (isDuplicate) {
        console.log(`❌ sendUserSmsNotification - اعلان تکراری تشخیص داده شد: orderId=${orderId}`);
        return { success: false, error: 'اعلان تکراری تشخیص داده شد.' };
      }
    }

    // ارسال SMS با Template
    console.log(`📱 sendUserSmsNotification - در حال ارسال SMS با Template...`);
    const sendResult = await sendSmsWithTemplate(env, {
      eventType: eventType,
      recipient: user.phone,
      data: templateData,
      referenceId: orderId,
      referenceType: 'order',
      createdByUserId: userId
    });

    console.log(`📱 sendUserSmsNotification - sendResult: success=${sendResult.success}, messageId=${sendResult.messageId}`);

    if (sendResult.success) {
      return {
        success: true,
        message_id: sendResult.messageId,
        rendered: sendResult.rendered,
        template: sendResult.template
      };
    } else {
      return {
        success: false,
        error: sendResult.error || 'ارسال SMS انجام نشد.'
      };
    }

  } catch (error) {
    console.error('❌ sendUserSmsNotification - خطای غیرمنتظره:', error);
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}

/**
 * دریافت تنظیمات اعلان کاربر
 */
export async function getUserNotificationPreferences(env, userId) {
  const result = await env.DB
    .prepare(`SELECT * FROM user_notification_preferences WHERE user_id = ?`)
    .bind(userId)
    .first();

  if (!result) return null;

  // تبدیل به فرمت boolean
  const prefs = {};
  const fields = [
    'order_created', 'payment_success', 'payment_failed',
    'order_status_changed', 'order_preparing', 'order_shipped',
    'tracking_code_added', 'order_completed', 'order_cancelled',
    'announcements', 'promotions', 'marketing'
  ];

  for (const field of fields) {
    prefs[field] = result[field] === 1;
  }

  return prefs;
}

/**
 * به‌روزرسانی تنظیمات اعلان کاربر
 */
export async function updateUserNotificationPreferences(env, userId, preferences) {
  const fields = [
    'order_created', 'payment_success', 'payment_failed',
    'order_status_changed', 'order_preparing', 'order_shipped',
    'tracking_code_added', 'order_completed', 'order_cancelled',
    'announcements', 'promotions', 'marketing'
  ];

  const updates = [];
  const values = [];

  for (const field of fields) {
    if (preferences[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(preferences[field] ? 1 : 0);
    }
  }

  if (updates.length === 0) {
    throw new Error('هیچ تنظیماتی برای به‌روزرسانی وجود ندارد.');
  }

  const existing = await env.DB
    .prepare(`SELECT id FROM user_notification_preferences WHERE user_id = ?`)
    .bind(userId)
    .first();

  if (existing) {
    values.push(userId);
    const query = `
      UPDATE user_notification_preferences
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;
    await env.DB.prepare(query).bind(...values).run();
  } else {
    const insertFields = ['user_id', ...fields];
    const placeholders = insertFields.map(() => '?').join(', ');
    const insertValues = [userId];
    
    for (const field of fields) {
      const val = preferences[field] !== undefined ? preferences[field] : 1;
      insertValues.push(val ? 1 : 0);
    }

    const query = `
      INSERT INTO user_notification_preferences (${insertFields.join(', ')})
      VALUES (${placeholders})
    `;
    await env.DB.prepare(query).bind(...insertValues).run();
  }

  return { success: true };
}

// ============================================
// 11. اعلان ثبت سفارش برای کاربر - با Template
// ============================================
export async function sendUserOrderCreatedNotification(env, orderData, userData, items, baseUrl = '') {
  console.log('📱 sendUserOrderCreatedNotification - شروع:', {
    orderId: orderData.orderId,
    userId: userData.id,
    userPhone: userData.phone,
    hasItems: Array.isArray(items) ? items.length : 0
  });

  const message = buildUserOrderCreatedMessage(orderData, userData, items);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  
  // ارسال به تلگرام کاربر
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    'order_created',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

  // ارسال به SMS کاربر با Template
  const smsSettings = await getSmsSettings(env);
  console.log('📱 sendUserOrderCreatedNotification - smsSettings:', {
    is_enabled: smsSettings.is_enabled,
    event_order_created_user: smsSettings.event_order_created_user
  });

  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_created_user) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || 'pending',
      order_status: orderData.status || 'pending',
      tracking_code: orderData.trackingCode || ''
    };
    
    smsResult = await sendUserSmsNotification(
      env,
      userData.id,
      'order_created',
      templateData,
      orderData.orderId,
      false
    );
    console.log('📱 sendUserOrderCreatedNotification - smsResult:', smsResult);
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success),
    results: {
      telegram: telegramResult,
      sms: smsResult
    }
  };
}

// ============================================
// 12. اعلان پرداخت موفق برای کاربر - با Template
// ============================================
export async function sendUserPaymentSuccessNotification(env, orderData, userData, paymentMethod = '', baseUrl = '') {
  const message = buildUserPaymentSuccessMessage(orderData, userData, paymentMethod);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  
  // ارسال به تلگرام کاربر
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    'payment_success',
    message,
    replyMarkup,
    orderData.orderId,
    true
  );

  // ارسال به SMS کاربر با Template
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_payment_success_user) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || 'pending',
      order_status: orderData.status || 'pending',
      tracking_code: orderData.trackingCode || ''
    };
    
    smsResult = await sendUserSmsNotification(
      env,
      userData.id,
      'payment_success',
      templateData,
      orderData.orderId,
      true
    );
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success),
    results: {
      telegram: telegramResult,
      sms: smsResult
    }
  };
}

// ============================================
// 13. اعلان تغییر وضعیت سفارش برای کاربر - با Template (16 وضعیت کامل)
// ============================================
export async function sendUserOrderStatusChangedNotification(env, orderData, userData, oldStatus, newStatus, trackingCode = '', baseUrl = '') {
  // ⭐⭐ تعیین eventType با استفاده از Map 16 وضعیت کامل
  const statusEventMap = {
    'order_created': 'order_created',
    'payment_pending': 'payment_pending',
    'payment_success': 'payment_success',
    'payment_failed': 'payment_failed',
    'payment_review': 'payment_review',
    'order_confirmed': 'order_confirmed',
    'processing': 'processing',
    'ready_to_ship': 'ready_to_ship',
    'courier_delivery': 'courier_delivery',
    'bus_shipping': 'bus_shipping',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'returned': 'returned',
    'processing_failed': 'processing_failed'
  };
  let eventType = statusEventMap[newStatus] || 'order_processing';

  const message = buildUserOrderStatusChangedMessage(orderData, userData, oldStatus, newStatus, trackingCode);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  
  // ارسال به تلگرام کاربر
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    'order_status_changed',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

  // ارسال به SMS کاربر با Template
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_status_changed_user) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || 'pending',
      order_status: newStatus || 'pending',
      tracking_code: trackingCode || ''
    };
    
    smsResult = await sendUserSmsNotification(
      env,
      userData.id,
      eventType,
      templateData,
      orderData.orderId,
      false
    );
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success),
    results: {
      telegram: telegramResult,
      sms: smsResult
    }
  };
}

// ============================================
// 14. اعلان لغو سفارش برای کاربر - با Template
// ============================================
export async function sendUserOrderCancelledNotification(env, orderData, userData, refundAmount = 0, baseUrl = '') {
  const message = buildUserOrderCancelledMessage(orderData, userData, refundAmount);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  
  // ارسال به تلگرام کاربر
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    'order_cancelled',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

  // ارسال به SMS کاربر با Template
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_cancelled_user) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || 'pending',
      order_status: 'cancelled',
      tracking_code: orderData.trackingCode || ''
    };
    
    smsResult = await sendUserSmsNotification(
      env,
      userData.id,
      'order_cancelled',
      templateData,
      orderData.orderId,
      false
    );
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success),
    results: {
      telegram: telegramResult,
      sms: smsResult
    }
  };
}

// ============================================
// 15. ارسال پیام پیگیری سفارش به کاربر
// ============================================
export async function sendUserOrderTrackingNotification(env, orderData, userData, items = [], baseUrl = '') {
  const message = buildUserOrderTrackingMessage(orderData, userData, items);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  
  return sendUserTelegramNotification(
    env,
    userData.id,
    'order_tracking',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );
}

// ============================================
// 16. تابع ارسال همزمان به ادمین و کاربر
// ============================================
export async function sendNotificationToAdminAndUser(env, adminEventType, userEventType, orderData, userData, items, baseUrl = '', paymentMethod = '', trackingCode = '') {
  const results = {
    admin: null,
    user: null
  };

  // ارسال به ادمین
  if (adminEventType === 'order_created') {
    results.admin = await sendOrderCreatedNotification(env, orderData, userData, items, baseUrl);
  } else if (adminEventType === 'payment_success') {
    results.admin = await sendPaymentSuccessNotification(env, orderData, userData, paymentMethod);
  } else if (adminEventType === 'order_status_changed') {
    results.admin = { success: false, error: 'نیاز به پارامترهای بیشتر دارد.' };
  }

  // ارسال به کاربر
  if (userEventType === 'order_created') {
    results.user = await sendUserOrderCreatedNotification(env, orderData, userData, items, baseUrl);
  } else if (userEventType === 'payment_success') {
    results.user = await sendUserPaymentSuccessNotification(env, orderData, userData, paymentMethod, baseUrl);
  } else if (userEventType === 'order_status_changed') {
    results.user = await sendUserOrderStatusChangedNotification(env, orderData, userData, null, null, trackingCode, baseUrl);
  } else if (userEventType === 'order_tracking') {
    results.user = await sendUserOrderTrackingNotification(env, orderData, userData, items, baseUrl);
  }

  return results;
}

// ============================================
// صادرات نهایی
// ============================================

export {
  sendTelegramNotification,
  sendUserTelegramNotification,
  sendSmsNotification,
  sendUserSmsNotification
};

// ============================================
// تابع کمکی برای دریافت Base URL
// ============================================

/**
 * دریافت آدرس پایه سایت از دیتابیس
 * @param {Object} env - محیط Cloudflare
 * @returns {Promise<string>} - آدرس پایه سایت
 */
export async function getSiteBaseUrl(env) {
  try {
    const result = await env.DB
      .prepare(`SELECT setting_value FROM app_settings WHERE setting_key = 'site_base_url'`)
      .first();
    if (result && result.setting_value) {
      return result.setting_value;
    }
  } catch (_) {
    // خطا را نادیده بگیر
  }
  // مقدار پیش‌فرض
  return 'https://takdaro-site.pages.dev';
}