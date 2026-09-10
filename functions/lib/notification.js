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

import {
  getEmailSettings,
  sendEmailWithTemplate,
  sendUserEmailNotification,
  sendAdminEmailNotification,
  sendWalletEmailNotification,
  testEmailNotification,
  getEmailTemplate,
  getAllEmailTemplates,
  saveEmailTemplate,
  toggleEmailTemplate,
  getEmailSettings as getEmailSettingsRaw
} from './email.js';

import { getStatusLabel, isValidCanonicalStatus } from './status-mapping.js';

// ============================================
// ⭐⭐⭐ وارد کردن Web Push
// ============================================

import {
  sendUserWebPushNotification,
  getUserPushSubscriptions
} from './web-push.js';

import {
  sendAdminFirebaseFcmNotification
} from './firebase-fcm.js';

// ============================================
// توابع کمکی عمومی
// ============================================

/**
 * دریافت تنظیمات یک کانال از دیتابیس
 * @param {Object} env - محیط Cloudflare
 * @param {string} channel - نام کانال ('telegram' | 'email' | 'sms' | 'web_push')
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
  const allowedChannels = ['telegram', 'email', 'sms', 'web_push', 'mobile'];
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

  if (channel === 'email') {
    // تنظیمات Email از طریق email.js مدیریت می‌شود
    // اینجا فقط به‌روزرسانی is_enabled انجام می‌شود
  }

  const existing = await env.DB
    .prepare(`SELECT id FROM notification_settings WHERE channel = ?`)
    .bind(channel)
    .first();

  // Telegram bot tokens belong in Cloudflare Secrets, never in D1.const botToken = env.TELEGRAM_BOT_TOKEN || config.bot_token;n  // Keep only non-sensitive channel settings in the shared database.const botToken = env.TELEGRAM_BOT_TOKEN || config.bot_token;n  const persistedConfig = channel === 'telegram'const botToken = env.TELEGRAM_BOT_TOKEN || config.bot_token;n    ? { chat_id: String(config.chat_id || '').trim() }const botToken = env.TELEGRAM_BOT_TOKEN || config.bot_token;n    : config;const botToken = env.TELEGRAM_BOT_TOKEN || config.bot_token;n  const configJson = JSON.stringify(persistedConfig);

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

  return { success: true, channel, config: persistedConfig };
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
  const botToken = env.TELEGRAM_BOT_TOKEN || config.bot_token;
  const chatId = config.chat_id;

  if (!botToken || !chatId) {
    results.push({
      channel: 'telegram',
      success: false,
      error: 'تنظیمات تلگرام کامل نیست (Bot Token یا Chat ID موجود نیست).'
    });
    return { success: false, results };
  }

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

  const logId = await logNotification(env, {
    eventType: eventType,
    channel: 'telegram',
    recipient: chatId,
    subject: message.substring(0, 100),
    content: message,
    status: 'pending',
    orderId: referenceId
  });

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

  if (checkDuplicate && referenceId) {
    const isDuplicate = await hasDuplicateLog(env, eventType, referenceId, 'sms', 1);
    if (isDuplicate) {
      return {
        success: false,
        error: 'اعلان تکراری تشخیص داده شد (در یک ساعت گذشته ارسال شده است).'
      };
    }
  }

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
// ⭐⭐⭐ تابع اصلی ارسال اعلان به Web Push
// ============================================

/**
 * تابع داخلی برای ارسال اعلان به Web Push
 * @param {Object} env - محیط Cloudflare
 * @param {number} userId - شناسه کاربر
 * @param {string} eventType - نوع رویداد
 * @param {Object} payload - محتوای اعلان
 * @param {string} orderId - شناسه سفارش (اختیاری)
 * @param {boolean} checkDuplicate - بررسی تکراری
 * @returns {Promise<Object>} - نتیجه ارسال
 */
async function sendWebPushNotification(env, userId, eventType, payload, orderId = null, checkDuplicate = true) {
  // بررسی فعال بودن کانال Web Push
  const webPushSettings = await getChannelSettings(env, 'web_push');
  
  if (!webPushSettings || !webPushSettings.is_enabled) {
    return {
      success: false,
      error: 'کانال Web Push فعال نیست یا تنظیمات وجود ندارد.'
    };
  }

  if (!userId) {
    return {
      success: false,
      error: 'شناسه کاربر مشخص نیست.'
    };
  }

  // بررسی تنظیمات کاربر
  const prefs = await getUserNotificationPreferences(env, userId);
  if (prefs && prefs[eventType] === 0) {
    return {
      success: false,
      error: 'این نوع اعلان توسط کاربر غیرفعال شده است.'
    };
  }

  // بررسی تکراری
  if (checkDuplicate && orderId) {
    const isDuplicate = await hasDuplicateLog(env, eventType, orderId, 'web_push', 1);
    if (isDuplicate) {
      return {
        success: false,
        error: 'اعلان تکراری تشخیص داده شد (در یک ساعت گذشته ارسال شده است).'
      };
    }
  }

  // دریافت Subscription‌های کاربر
  const subscriptions = await getUserPushSubscriptions(env, userId);
  
  if (!subscriptions || subscriptions.length === 0) {
    return {
      success: false,
      error: 'هیچ دستگاه فعالی برای اعلان Web Push ثبت نشده است.'
    };
  }

  // ارسال به تمام دستگاه‌ها
  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      const result = await sendWebPushInternal(
        env,
        subscription,
        payload,
        {
          eventType: eventType,
          orderId: orderId,
          userId: userId,
          isUserNotification: true
        }
      );
      return result;
    })
  );

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  return {
    success: successCount > 0,
    results: results,
    summary: {
      total: results.length,
      success: successCount,
      failed: failureCount
    }
  };
}

/**
 * تابع داخلی برای ارسال Web Push به یک Subscription (با لاگ)
 */
async function sendWebPushInternal(env, subscription, payload, options = {}) {
  const {
    eventType = 'web_push',
    orderId = null,
    userId = null,
    isUserNotification = true
  } = options;

  const endpoint = subscription?.endpoint;

  if (!endpoint) {
    return {
      success: false,
      error: 'Push endpoint وجود ندارد.'
    };
  }

  // ثبت لاگ pending
  const logId = await logNotification(env, {
    eventType: eventType,
    channel: 'web_push',
    recipient: endpoint,
    subject: payload?.title || '',
    content: payload?.body || '',
    status: 'pending',
    orderId: orderId,
    userId: userId,
    isUserNotification: isUserNotification
  });

  try {
    const result = await sendWebPushDirect(env, subscription, payload);

    if (result.success) {
      await updateLogStatus(env, logId, 'sent');
      
      // به‌روزرسانی last_used_at
      await env.DB
        .prepare(`
          UPDATE push_subscriptions
          SET last_used_at = CURRENT_TIMESTAMP
          WHERE endpoint = ?
        `)
        .bind(endpoint)
        .run();

      return {
        success: true,
        log_id: logId,
        status: result.status
      };
    } else {
      const errorMessage = result.error || 'خطا در ارسال Web Push';
      await updateLogStatus(env, logId, 'failed', errorMessage);

      // اگر Subscription منقضی شده، غیرفعالش کن
      if (result.expired) {
        await env.DB
          .prepare(`
            UPDATE push_subscriptions
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE endpoint = ?
          `)
          .bind(endpoint)
          .run();
      }

      return {
        success: false,
        log_id: logId,
        error: errorMessage,
        expired: result.expired || false
      };
    }
  } catch (error) {
    const errorMessage = String(error?.message || error);
    await updateLogStatus(env, logId, 'failed', errorMessage);
    return {
      success: false,
      log_id: logId,
      error: errorMessage
    };
  }
}

/**
 * تابع ارسال مستقیم Web Push (بدون لاگ - برای استفاده در sendWebPushInternal)
 * این تابع از web-push.js استفاده می‌کند
 */
async function sendWebPushDirect(env, subscription, payload) {
  // این تابع از توابع موجود در web-push.js استفاده می‌کند
  // برای جلوگیری از import loop، از همان توابع استفاده می‌کنیم
  
  const { sendWebPush } = await import('./web-push.js');
  
  return sendWebPush(env, subscription, payload);
}


// ============================================
// تنظیمات اعلان موبایل (FCM)
// ============================================

export const MOBILE_NOTIFICATION_EVENTS = [
  { key: 'order_created', label: 'ثبت سفارش جدید' },
  { key: 'payment_pending', label: 'در انتظار پرداخت' },
  { key: 'payment_success', label: 'پرداخت موفق' },
  { key: 'payment_failed', label: 'پرداخت ناموفق' },
  { key: 'order_confirmed', label: 'تأیید سفارش' },
  { key: 'courier_delivery', label: 'ارسال با پیک' },
  { key: 'bus_shipping', label: 'ارسال با باربری' },
  { key: 'shipped', label: 'ارسال شد' },
  { key: 'delivered', label: 'تحویل داده شد' },
  { key: 'completed', label: 'تکمیل شد' },
  { key: 'cancelled', label: 'لغو شد' },
  { key: 'returned', label: 'مرجوع شد' },
  { key: 'chat_online', label: 'چت آنلاین' }
];

const MOBILE_NOTIFICATION_DEFAULTS = {
  // ثبت سفارش به صورت پیش‌فرض فعال است.
  order_created: true,

  // 11 وضعیت سفارش به صورت پیش‌فرض غیرفعال هستند
  // تا مدیر خودش موارد موردنیاز را فعال کند.
  payment_pending: false,
  payment_success: false,
  payment_failed: false,
  order_confirmed: false,
  courier_delivery: false,
  bus_shipping: false,
  shipped: false,
  delivered: false,
  completed: false,
  cancelled: false,
  returned: false,

  // چت آنلاین مستقل از وضعیت سفارش است.
  chat_online: true
};

function normalizeMobileNotificationEvents(config) {
  const configured =
    config &&
    typeof config === 'object' &&
    config.events &&
    typeof config.events === 'object'
      ? config.events
      : {};

  const events = {};

  for (const item of MOBILE_NOTIFICATION_EVENTS) {
    if (
      Object.prototype.hasOwnProperty.call(
        configured,
        item.key
      )
    ) {
      events[item.key] =
        configured[item.key] === true;
    } else {
      events[item.key] =
        MOBILE_NOTIFICATION_DEFAULTS[item.key] === true;
    }
  }

  return events;
}

export async function getMobileNotificationSettings(env) {
  const settings =
    await getChannelSettings(env, 'mobile');

  if (!settings) {
    return {
      channel: 'mobile',
      is_enabled: true,
      config: {
        events: {
          ...MOBILE_NOTIFICATION_DEFAULTS
        }
      },
      events: {
        ...MOBILE_NOTIFICATION_DEFAULTS
      },
      exists: false
    };
  }

  const events =
    normalizeMobileNotificationEvents(
      settings.config
    );

  return {
    ...settings,
    events,
    exists: true
  };
}

export async function saveMobileNotificationSettings(
  env,
  config,
  userId
) {
  const existing =
    await getChannelSettings(
      env,
      'mobile'
    );

  const events =
    normalizeMobileNotificationEvents(
      config
    );

  const mergedConfig = {
    ...(existing?.config || {}),
    ...(config || {}),
    events
  };

  const enabled =
    config &&
    Object.prototype.hasOwnProperty.call(
      config,
      'is_enabled'
    )
      ? config.is_enabled === true
      : existing
        ? existing.is_enabled === true
        : true;

  const existingRow =
    await env.DB
      .prepare(`SELECT id FROM notification_settings WHERE channel = ?`)
      .bind('mobile')
      .first();

  const configJson =
    JSON.stringify(mergedConfig);

  if (existingRow) {
    await env.DB
      .prepare(`
        UPDATE notification_settings
        SET
          is_enabled = ?,
          config = ?,
          updated_by_user_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE channel = 'mobile'
      `)
      .bind(
        enabled ? 1 : 0,
        configJson,
        userId
      )
      .run();
  } else {
    await env.DB
      .prepare(`
        INSERT INTO notification_settings (
          channel,
          is_enabled,
          config,
          updated_by_user_id,
          created_at,
          updated_at
        )
        VALUES (
          'mobile',
          ?,
          ?,
          ?,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `)
      .bind(
        enabled ? 1 : 0,
        configJson,
        userId
      )
      .run();
  }

  return {
    success: true,
    channel: 'mobile',
    is_enabled: enabled,
    config: mergedConfig
  };
}

export async function toggleMobileNotificationEvent(
  env,
  eventKey,
  enabled,
  userId
) {
  const validEvent =
    MOBILE_NOTIFICATION_EVENTS.some(
      (item) => item.key === eventKey
    );

  if (!validEvent) {
    throw new Error(
      `رویداد اعلان موبایل ${eventKey} معتبر نیست.`
    );
  }

  const current =
    await getMobileNotificationSettings(
      env
    );

  const events = {
    ...current.events,
    [eventKey]: enabled === true
  };

  return saveMobileNotificationSettings(
    env,
    {
      ...(current.config || {}),
      events
    },
    userId
  );
}

function getMobileEventKeyForFcm(
  eventType,
  data = {}
) {
  const newStatus = String(
    data?.new_status || ''
  ).trim().toLowerCase();

  if (eventType === 'order_created') {
    return 'order_created';
  }

  if (
    eventType === 'payment_success'
  ) {
    return 'payment_success';
  }

  if (
    eventType === 'payment_status_changed'
  ) {
    if (
      newStatus === 'payment_pending' ||
      newStatus === 'payment_success' ||
      newStatus === 'payment_failed'
    ) {
      return newStatus;
    }
  }

  if (
    eventType === 'order_status_changed'
  ) {
    return MOBILE_NOTIFICATION_EVENTS.some(
      (item) => item.key === newStatus
    )
      ? newStatus
      : 'order_status_changed';
  }

  if (
    eventType === 'order_cancelled'
  ) {
    return 'cancelled';
  }

  return eventType;
}

async function shouldSendAdminMobileFcm(
  env,
  eventType,
  data = {}
) {
  // رویدادهای غیرسفارشی فعلی (کیف پول/Refund و ...)
  // برای حفظ رفتار قبلی، تحت تنظیمات 11 وضعیت سفارش نیستند.
  const controlledEvents = new Set(
    MOBILE_NOTIFICATION_EVENTS.map(
      (item) => item.key
    )
  );

  const eventKey =
    getMobileEventKeyForFcm(
      eventType,
      data
    );

  if (
    eventKey === 'order_status_changed'
  ) {
    return {
      allowed: false,
      eventKey
    };
  }

  if (!controlledEvents.has(eventKey)) {
    return {
      allowed: true,
      eventKey
    };
  }

  const settings =
    await getMobileNotificationSettings(
      env
    );

  if (
    settings.is_enabled !== true
  ) {
    return {
      allowed: false,
      eventKey
    };
  }

  return {
    allowed:
      settings.events[eventKey] === true,
    eventKey
  };
}

// ============================================
// Android FCM - اعلان مستقل برای پنل مدیریت
// ============================================

async function sendAdminFcmNotification(env, eventType, title, body, orderId = null, data = {}) {
  try {
    const gate =
      await shouldSendAdminMobileFcm(
        env,
        eventType,
        data
      );

    if (!gate.allowed) {
      return {
        success: true,
        skipped: true,
        event_key: gate.eventKey,
        reason: 'disabled_by_admin_settings',
        results: []
      };
    }

    return await sendAdminFirebaseFcmNotification(env, {
      eventType,
      title,
      body,
      orderId,
      data: {
        type: eventType,
        event_key: gate.eventKey,
        order_id: orderId || '',
        ...data
      }
    });
  } catch (error) {
    const errorMessage = String(error?.message || error);
    console.error(`❌ Android FCM error in ${eventType}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
      results: []
    };
  }
}

// ============================================
// 1. اعلان سفارش جدید (ادمین)
// ============================================
export async function sendOrderCreatedNotification(env, orderData, userData, items, baseUrl = '') {
  const message = buildOrderCreatedMessage(orderData, userData, items);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, baseUrl);
  
  const telegramResult = await sendTelegramNotification(
    env,
    'order_created',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_created_admin && smsSettings.admin_phone) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      order_status: orderData.status || 'payment_pending',
      tracking_code: orderData.trackingCode || '',
      admin_note: 'لطفاً سفارش را بررسی کنید'
    };
    
    smsResult = await sendSmsNotification(
      env,
      'admin_order_created',
      smsSettings.admin_phone,
      templateData,
      orderData.orderId,
      false
    );
  }

  // ============================================
  // ⭐ ارسال Email به ادمین
  // ============================================
  let emailResult = null;
  try {
    const emailSettings = await getEmailSettingsRaw(env);
    if (emailSettings.is_enabled) {
      emailResult = await sendAdminEmailNotification(
        env,
        'order_created',
        orderData,
        userData,
        items,
        baseUrl
      );
    }
  } catch (emailError) {
    console.error('❌ Email error in sendOrderCreatedNotification:', emailError);
    emailResult = { success: false, error: String(emailError?.message || emailError) };
  }

  // ============================================
  // ⭐⭐⭐ Web Push به ادمین
  // ============================================
  let webPushResult = null;
  if (userData && userData.id) {
    try {
      const webPushSettings = await getChannelSettings(env, 'web_push');
      if (webPushSettings && webPushSettings.is_enabled) {
        webPushResult = await sendWebPushNotification(
          env,
          userData.id,
          'order_created',
          {
            title: '🛒 سفارش جدید ثبت شد',
            body: `سفارش ${orderData.orderNumber || ''} توسط ${userData.fullName || 'کاربر'} ثبت شد.`,
            icon: '/assets/images/logo.png',
            badge: '/assets/images/logo.png',
            url: baseUrl ? `${baseUrl}/admin/orders` : '/admin/orders',
            tag: `order-${orderData.orderId}`
          },
          orderData.orderId,
          false
        );
      }
    } catch (webPushError) {
      console.error('❌ Web Push error in sendOrderCreatedNotification:', webPushError);
      webPushResult = { success: false, error: String(webPushError?.message || webPushError) };
    }
  }

    const fcmResult = await sendAdminFcmNotification(
    env,
    'order_created',
    '🛒 سفارش جدید ثبت شد',
    `سفارش ${orderData.orderNumber || ''} توسط ${userData.fullName || 'کاربر'} ثبت شد.`,
    orderData.orderId,
    {
      order_number: orderData.orderNumber || '',
      customer_name: userData.fullName || ''
    }
  );


  return {
    success: telegramResult.success || (smsResult && smsResult.success) || (emailResult && emailResult.success) || (webPushResult && webPushResult.success) || (fcmResult && fcmResult.success),
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult,
      email: emailResult,
      web_push: webPushResult,
      fcm: fcmResult
    }
  };
}

// ============================================
// 2. اعلان پرداخت موفق (ادمین)
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
      order_status: orderData.status || 'payment_success',
      tracking_code: orderData.trackingCode || '',
      admin_note: 'پرداخت تأیید شد'
    };
    
    smsResult = await sendSmsNotification(
      env,
      'admin_payment_success',
      smsSettings.admin_phone,
      templateData,
      orderData.orderId,
      true
    );
  }

  // ============================================
  // ⭐ ارسال Email به ادمین
  // ============================================
  let emailResult = null;
  try {
    const emailSettings = await getEmailSettingsRaw(env);
    if (emailSettings.is_enabled) {
      emailResult = await sendAdminEmailNotification(
        env,
        'payment_success',
        orderData,
        userData,
        [],
        ''
      );
    }
  } catch (emailError) {
    console.error('❌ Email error in sendPaymentSuccessNotification:', emailError);
    emailResult = { success: false, error: String(emailError?.message || emailError) };
  }

  // ============================================
  // ⭐⭐⭐ Web Push به ادمین
  // ============================================
  let webPushResult = null;
  if (userData && userData.id) {
    try {
      const webPushSettings = await getChannelSettings(env, 'web_push');
      if (webPushSettings && webPushSettings.is_enabled) {
        webPushResult = await sendWebPushNotification(
          env,
          userData.id,
          'payment_success',
          {
            title: '💰 پرداخت موفق',
            body: `پرداخت سفارش ${orderData.orderNumber || ''} توسط ${userData.fullName || 'کاربر'} با موفقیت انجام شد.`,
            icon: '/assets/images/logo.png',
            badge: '/assets/images/logo.png',
            url: `/admin/orders/${orderData.orderId}`,
            tag: `payment-${orderData.orderId}`
          },
          orderData.orderId,
          true
        );
      }
    } catch (webPushError) {
      console.error('❌ Web Push error in sendPaymentSuccessNotification:', webPushError);
      webPushResult = { success: false, error: String(webPushError?.message || webPushError) };
    }
  }

    const fcmResult = await sendAdminFcmNotification(
    env,
    'payment_success',
    '💰 پرداخت موفق',
    `پرداخت سفارش ${orderData.orderNumber || ''} توسط ${userData.fullName || 'کاربر'} با موفقیت انجام شد.`,
    orderData.orderId,
    {
      order_number: orderData.orderNumber || '',
      customer_name: userData.fullName || ''
    }
  );


  return {
    success: telegramResult.success || (smsResult && smsResult.success) || (emailResult && emailResult.success) || (webPushResult && webPushResult.success) || (fcmResult && fcmResult.success),
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult,
      email: emailResult,
      web_push: webPushResult,
      fcm: fcmResult
    }
  };
}

// ============================================
// 3. اعلان تغییر وضعیت پرداخت (ادمین)
// ============================================
export async function sendPaymentStatusChangedNotification(env, orderData, userData, oldStatus, newStatus) {
  const message = buildPaymentStatusChangedMessage(orderData, userData, oldStatus, newStatus);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  const telegramResult = await sendTelegramNotification(
    env,
    'payment_status_changed',
    message,
    replyMarkup,
    orderData.orderId,
    true
  );

  const fcmResult = await sendAdminFcmNotification(
    env,
    'payment_status_changed',
    '💳 تغییر وضعیت پرداخت',
    `وضعیت پرداخت سفارش ${orderData.orderNumber || ''} از "${oldStatus || 'نامشخص'}" به "${newStatus || 'تغییر یافت'}" تغییر کرد.`,
    orderData.orderId,
    {
      order_number: orderData.orderNumber || '',
      old_status: oldStatus || '',
      new_status: newStatus || ''
    }
  );

  return {
    ...telegramResult,
    fcm: fcmResult,
    success: telegramResult.success || fcmResult.success
  };
}

// ============================================
// 4. اعلان تغییر وضعیت سفارش (ادمین)
// ============================================
export async function sendOrderStatusChangedNotification(env, orderData, userData, oldStatus, newStatus) {
  const message = buildOrderStatusChangedMessage(orderData, userData, oldStatus, newStatus);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  const telegramResult = await sendTelegramNotification(
    env,
    'order_status_changed',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  
  if (smsSettings.is_enabled && smsSettings.event_order_status_changed_user && smsSettings.admin_phone) {
    let eventType = newStatus || 'order_processing';
    
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
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

  // ============================================
  // ⭐ ارسال Email به ادمین
  // ============================================
  let emailResult = null;
  try {
    const emailSettings = await getEmailSettingsRaw(env);
    if (emailSettings.is_enabled) {
      emailResult = await sendAdminEmailNotification(
        env,
        newStatus === 'cancelled' ? 'order_cancelled' : 'order_status_changed',
        orderData,
        userData,
        [],
        ''
      );
    }
  } catch (emailError) {
    console.error('❌ Email error in sendOrderStatusChangedNotification:', emailError);
    emailResult = { success: false, error: String(emailError?.message || emailError) };
  }

  // ============================================
  // ⭐⭐⭐ Web Push به ادمین
  // ============================================
  let webPushResult = null;
  if (userData && userData.id) {
    try {
      const webPushSettings = await getChannelSettings(env, 'web_push');
      if (webPushSettings && webPushSettings.is_enabled) {
        const statusLabel = newStatus || 'تغییر یافت';
        webPushResult = await sendWebPushNotification(
          env,
          userData.id,
          'order_status_changed',
          {
            title: '📦 تغییر وضعیت سفارش',
            body: `وضعیت سفارش ${orderData.orderNumber || ''} به "${statusLabel}" تغییر یافت.`,
            icon: '/assets/images/logo.png',
            badge: '/assets/images/logo.png',
            url: `/admin/orders/${orderData.orderId}`,
            tag: `order-status-${orderData.orderId}`
          },
          orderData.orderId,
          false
        );
      }
    } catch (webPushError) {
      console.error('❌ Web Push error in sendOrderStatusChangedNotification:', webPushError);
      webPushResult = { success: false, error: String(webPushError?.message || webPushError) };
    }
  }

    const fcmResult = await sendAdminFcmNotification(
    env,
    'order_status_changed',
    '📦 تغییر وضعیت سفارش',
    `وضعیت سفارش ${orderData.orderNumber || ''} به "${newStatus || 'تغییر یافت'}" تغییر یافت.`,
    orderData.orderId,
    {
      order_number: orderData.orderNumber || '',
      old_status: oldStatus || '',
      new_status: newStatus || ''
    }
  );


  return {
    success: telegramResult.success || (smsResult && smsResult.success) || (emailResult && emailResult.success) || (webPushResult && webPushResult.success) || (fcmResult && fcmResult.success),
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult,
      email: emailResult,
      web_push: webPushResult,
      fcm: fcmResult
    }
  };
}

// ============================================
// 5. اعلان لغو سفارش (ادمین)
// ============================================
export async function sendOrderCancelledNotification(env, orderData, userData, refundAmount = 0) {
  const message = buildOrderCancelledMessage(orderData, userData, refundAmount);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  const telegramResult = await sendTelegramNotification(
    env,
    'order_cancelled',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_cancelled_user && smsSettings.admin_phone) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
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

  // ============================================
  // ⭐ ارسال Email به ادمین
  // ============================================
  let emailResult = null;
  try {
    const emailSettings = await getEmailSettingsRaw(env);
    if (emailSettings.is_enabled) {
      emailResult = await sendAdminEmailNotification(
        env,
        'order_cancelled',
        orderData,
        userData,
        [],
        ''
      );
    }
  } catch (emailError) {
    console.error('❌ Email error in sendOrderCancelledNotification:', emailError);
    emailResult = { success: false, error: String(emailError?.message || emailError) };
  }

  // ============================================
  // ⭐⭐⭐ Web Push به ادمین
  // ============================================
  let webPushResult = null;
  if (userData && userData.id) {
    try {
      const webPushSettings = await getChannelSettings(env, 'web_push');
      if (webPushSettings && webPushSettings.is_enabled) {
        webPushResult = await sendWebPushNotification(
          env,
          userData.id,
          'order_cancelled',
          {
            title: '❌ لغو سفارش',
            body: `سفارش ${orderData.orderNumber || ''} توسط ${userData.fullName || 'کاربر'} لغو شد.${refundAmount > 0 ? ` مبلغ ${refundAmount.toLocaleString()} تومان بازگشت داده شد.` : ''}`,
            icon: '/assets/images/logo.png',
            badge: '/assets/images/logo.png',
            url: `/admin/orders/${orderData.orderId}`,
            tag: `order-cancel-${orderData.orderId}`
          },
          orderData.orderId,
          false
        );
      }
    } catch (webPushError) {
      console.error('❌ Web Push error in sendOrderCancelledNotification:', webPushError);
      webPushResult = { success: false, error: String(webPushError?.message || webPushError) };
    }
  }

    const fcmResult = await sendAdminFcmNotification(
    env,
    'order_cancelled',
    '❌ لغو سفارش',
    `سفارش ${orderData.orderNumber || ''} توسط ${userData.fullName || 'کاربر'} لغو شد.${refundAmount > 0 ? ` مبلغ ${refundAmount.toLocaleString()} تومان بازگشت داده شد.` : ''}`,
    orderData.orderId,
    {
      order_number: orderData.orderNumber || '',
      refund_amount: refundAmount || 0
    }
  );


  return {
    success: telegramResult.success || (smsResult && smsResult.success) || (emailResult && emailResult.success) || (webPushResult && webPushResult.success) || (fcmResult && fcmResult.success),
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult,
      email: emailResult,
      web_push: webPushResult,
      fcm: fcmResult
    }
  };
}

// ============================================
// 6. اعلان بازپرداخت (Refund)
// ============================================
export async function sendRefundNotification(env, orderData, userData, refundAmount, refundMethod = '') {
  const message = buildRefundMessage(orderData, userData, refundAmount, refundMethod);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  const telegramResult = await sendTelegramNotification(
    env,
    'refund',
    message,
    replyMarkup,
    orderData.orderId,
    true
  );

  const fcmResult = await sendAdminFcmNotification(
    env,
    'refund',
    '↩️ بازپرداخت سفارش',
    `برای سفارش ${orderData.orderNumber || ''} بازپرداخت به مبلغ ${Number(refundAmount || 0).toLocaleString()} تومان ثبت شد.`,
    orderData.orderId,
    {
      order_number: orderData.orderNumber || '',
      refund_amount: refundAmount || 0,
      refund_method: refundMethod || ''
    }
  );

  return {
    ...telegramResult,
    fcm: fcmResult,
    success: telegramResult.success || fcmResult.success
  };
}

// ============================================
// 7. اعلان شارژ کیف پول
// ============================================
export async function sendWalletTopupNotification(env, userData, amount, paymentMethod = '', newBalance = 0) {
  const message = buildWalletTopupMessage(userData, amount, paymentMethod, newBalance);
  const replyMarkup = createUserViewButton(userData.id, '');
  
  const telegramResult = await sendTelegramNotification(
    env,
    'wallet_topup',
    message,
    replyMarkup,
    userData.id,
    true
  );

  const fcmResult = await sendAdminFcmNotification(
    env,
    'wallet_topup',
    '💰 شارژ کیف پول',
    `کیف پول ${userData.fullName || 'کاربر'} به مبلغ ${Number(amount || 0).toLocaleString()} تومان شارژ شد.`,
    null,
    {
      user_id: userData.id || '',
      amount: amount || 0,
      payment_method: paymentMethod || '',
      new_balance: newBalance || 0
    }
  );

  return {
    ...telegramResult,
    fcm: fcmResult,
    success: telegramResult.success || fcmResult.success
  };
}

// ============================================
// 8. اعلان درخواست برداشت کیف پول
// ============================================
export async function sendWalletWithdrawalRequestNotification(env, userData, amount, destinationInfo = '', requestId = '') {
  const message = buildWalletWithdrawalRequestMessage(userData, amount, destinationInfo, requestId);
  const replyMarkup = createUserViewButton(userData.id, '');
  
  const telegramResult = await sendTelegramNotification(
    env,
    'wallet_withdrawal_requested',
    message,
    replyMarkup,
    requestId || userData.id,
    true
  );

  const fcmResult = await sendAdminFcmNotification(
    env,
    'wallet_withdrawal_requested',
    '💸 درخواست برداشت کیف پول',
    `درخواست برداشت ${Number(amount || 0).toLocaleString()} تومان توسط ${userData.fullName || 'کاربر'} ثبت شد.`,
    null,
    {
      user_id: userData.id || '',
      amount: amount || 0,
      request_id: requestId || '',
      destination_info: destinationInfo || ''
    }
  );

  return {
    ...telegramResult,
    fcm: fcmResult,
    success: telegramResult.success || fcmResult.success
  };
}

// ============================================
// 9. اعلان تغییر وضعیت برداشت کیف پول
// ============================================
export async function sendWalletWithdrawalStatusNotification(env, userData, amount, oldStatus, newStatus, requestId = '', reason = '') {
  const message = buildWalletWithdrawalStatusMessage(userData, amount, oldStatus, newStatus, requestId, reason);
  const replyMarkup = createUserViewButton(userData.id, '');
  
  const eventType = newStatus === 'approved'
    ? 'wallet_withdrawal_approved'
    : 'wallet_withdrawal_rejected';

  const telegramResult = await sendTelegramNotification(
    env,
    eventType,
    message,
    replyMarkup,
    requestId || userData.id,
    true
  );

  const fcmResult = await sendAdminFcmNotification(
    env,
    eventType,
    newStatus === 'approved'
      ? '✅ برداشت کیف پول تأیید شد'
      : '❌ برداشت کیف پول رد شد',
    `درخواست برداشت ${Number(amount || 0).toLocaleString()} تومان برای ${userData.fullName || 'کاربر'} ${newStatus === 'approved' ? 'تأیید شد' : 'رد شد'}.`,
    null,
    {
      user_id: userData.id || '',
      amount: amount || 0,
      old_status: oldStatus || '',
      new_status: newStatus || '',
      request_id: requestId || '',
      reason: reason || ''
    }
  );

  return {
    ...telegramResult,
    fcm: fcmResult,
    success: telegramResult.success || fcmResult.success
  };
}

// ============================================
// 10. اعلان اعمال کش‌بک
// ============================================
export async function sendCashbackAppliedNotification(env, orderData, userData, cashbackAmount, newBalance = 0) {
  const message = buildCashbackAppliedMessage(orderData, userData, cashbackAmount, newBalance);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, '');
  
  const telegramResult = await sendTelegramNotification(
    env,
    'cashback_applied',
    message,
    replyMarkup,
    orderData.orderId,
    true
  );

  const fcmResult = await sendAdminFcmNotification(
    env,
    'cashback_applied',
    '🎁 کش‌بک اعمال شد',
    `برای سفارش ${orderData.orderNumber || ''} مبلغ ${Number(cashbackAmount || 0).toLocaleString()} تومان کش‌بک اعمال شد.`,
    orderData.orderId,
    {
      order_number: orderData.orderNumber || '',
      user_id: userData.id || '',
      cashback_amount: cashbackAmount || 0,
      new_balance: newBalance || 0
    }
  );

  return {
    ...telegramResult,
    fcm: fcmResult,
    success: telegramResult.success || fcmResult.success
  };
}

// ============================================
// توابع مدیریت و آمار
// ============================================

/**
 * ارسال پیام آزمایشی تلگرام برای تست
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

  const template = await getSmsTemplate(env, eventType);
  let message = '🔔 پیام آزمایشی\n\n✅ اتصال به سیستم SMS با موفقیت برقرار شد.\n\n📌 این پیام از پنل مدیریت ارسال شده است.';
  
  if (template) {
    const testData = {
      customer_name: 'کاربر تست',
      customer_phone: phoneNumber,
      order_number: 'TT-20260819-TEST',
      amount: '100000',
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
 * ارسال پیام آزمایشی Email برای تست
 */
export async function testEmailNotificationWrapper(env, recipient, userId) {
  return testEmailNotification(env, recipient, userId);
}

/**
 * دریافت تاریخچه اعلان‌ها
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
  const user = await env.DB
    .prepare(`SELECT id, full_name, email, phone FROM users WHERE id = ?`)
    .bind(userId)
    .first();

  if (!user) {
    return { success: false, error: 'کاربر یافت نشد.' };
  }

  const connection = await env.DB
    .prepare(`SELECT chat_id, is_active FROM user_telegram_connections WHERE user_id = ? AND is_active = 1`)
    .bind(userId)
    .first();

  if (!connection) {
    return { success: false, error: 'کاربر به تلگرام متصل نیست.' };
  }

  const telegramSettings = await getChannelSettings(env, 'telegram');
  if (!telegramSettings || !telegramSettings.is_enabled) {
    return { success: false, error: 'کانال تلگرام فعال نیست.' };
  }

  const config = telegramSettings.config || {};
  const botToken = env.TELEGRAM_BOT_TOKEN || config.bot_token;

  if (!botToken) {
    return { success: false, error: 'توکن ربات تلگرام تنظیم نشده است.' };
  }

  const prefs = await getUserNotificationPreferences(env, userId);
  if (prefs && prefs[eventType] === 0) {
    return { success: false, error: 'این نوع اعلان توسط کاربر غیرفعال شده است.' };
  }

  if (checkDuplicate && orderId) {
    const isDuplicate = await hasDuplicateLog(env, eventType, orderId, 'telegram', 1);
    if (isDuplicate) {
      return { success: false, error: 'اعلان تکراری تشخیص داده شد.' };
    }
  }

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

  const sendResult = await sendTelegramMessage(botToken, connection.chat_id, message, { replyMarkup });

  if (sendResult.success) {
    await updateLogStatus(env, logId, 'sent');
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

    const smsSettings = await getSmsSettings(env);
    console.log(`📱 sendUserSmsNotification - smsSettings: is_enabled=${smsSettings.is_enabled}`);

    if (!smsSettings.is_enabled) {
      console.log(`❌ sendUserSmsNotification - کانال SMS فعال نیست`);
      return { success: false, error: 'کانال SMS فعال نیست.' };
    }

    const prefs = await getUserNotificationPreferences(env, userId);
    console.log(`📱 sendUserSmsNotification - prefs:`, prefs);

    if (prefs && prefs[eventType] === 0) {
      console.log(`❌ sendUserSmsNotification - کاربر این نوع اعلان را غیرفعال کرده: eventType=${eventType}`);
      return { success: false, error: 'این نوع اعلان توسط کاربر غیرفعال شده است.' };
    }

    if (checkDuplicate && orderId) {
      const isDuplicate = await hasDuplicateLog(env, eventType, orderId, 'sms', 1);
      if (isDuplicate) {
        console.log(`❌ sendUserSmsNotification - اعلان تکراری تشخیص داده شد: orderId=${orderId}`);
        return { success: false, error: 'اعلان تکراری تشخیص داده شد.' };
      }
    }

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

// ============================================
// ⭐⭐⭐ تابع Web Push برای کاربران
// ============================================

/**
 * تابع داخلی برای ارسال اعلان به کاربر از طریق Web Push
 */
async function sendUserWebPushNotificationInternal(env, userId, eventType, payload, orderId = null, checkDuplicate = true) {
  // این تابع همان sendWebPushNotification است که قبلاً تعریف شده
  // برای جلوگیری از تکرار، از همان استفاده می‌کنیم
  return sendWebPushNotification(env, userId, eventType, payload, orderId, checkDuplicate);
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
// 11. اعلان ثبت سفارش برای کاربر
// ============================================
export async function sendUserOrderCreatedNotification(env, orderData, userData, items, baseUrl = '') {
  console.log('📱 sendUserOrderCreatedNotification - شروع:', {
    orderId: orderData.orderId,
    userId: userData.id,
    userPhone: userData.phone,
    userEmail: userData.email,
    hasItems: Array.isArray(items) ? items.length : 0
  });

  const message = buildUserOrderCreatedMessage(orderData, userData, items);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    'order_created',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

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
      order_status: orderData.status || 'payment_pending',
      tracking_code: orderData.trackingCode || ''
    };
    
    smsResult = await sendUserSmsNotification(
      env,
      userData.id,
      'payment_pending',
      templateData,
      orderData.orderId,
      false
    );
    console.log('📱 sendUserOrderCreatedNotification - smsResult:', smsResult);
  }

  // ============================================
  // ⭐ ارسال Email به کاربر
  // ============================================
  let emailResult = null;
  try {
    const emailSettings = await getEmailSettingsRaw(env);
    if (emailSettings.is_enabled) {
      emailResult = await sendUserEmailNotification(
        env,
        userData.id,
        'order_created',
        orderData,
        userData,
        items,
        baseUrl
      );
    }
  } catch (emailError) {
    console.error('❌ Email error in sendUserOrderCreatedNotification:', emailError);
    emailResult = { success: false, error: String(emailError?.message || emailError) };
  }

  // ============================================
  // ⭐⭐⭐ Web Push به کاربر
  // ============================================
  let webPushResult = null;
  try {
    const webPushSettings = await getChannelSettings(env, 'web_push');
    if (webPushSettings && webPushSettings.is_enabled) {
      webPushResult = await sendWebPushNotification(
        env,
        userData.id,
        'order_created',
        {
          title: '🛒 سفارش شما ثبت شد',
          body: `سفارش شماره ${orderData.orderNumber || ''} با موفقیت ثبت شد.`,
          icon: '/assets/images/logo.png',
          badge: '/assets/images/logo.png',
          url: baseUrl ? `${baseUrl}/account/orders/${orderData.orderId}` : `/account/orders/${orderData.orderId}`,
          tag: `user-order-${orderData.orderId}`
        },
        orderData.orderId,
        false
      );
    }
  } catch (webPushError) {
    console.error('❌ Web Push error in sendUserOrderCreatedNotification:', webPushError);
    webPushResult = { success: false, error: String(webPushError?.message || webPushError) };
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success) || (emailResult && emailResult.success) || (webPushResult && webPushResult.success),
    results: {
      telegram: telegramResult,
      sms: smsResult,
      email: emailResult,
      web_push: webPushResult
    }
  };
}

// ============================================
// 12. اعلان پرداخت موفق برای کاربر
// ============================================
export async function sendUserPaymentSuccessNotification(env, orderData, userData, paymentMethod = '', baseUrl = '') {
  const message = buildUserPaymentSuccessMessage(orderData, userData, paymentMethod);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    'payment_success',
    message,
    replyMarkup,
    orderData.orderId,
    true
  );

  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_payment_success_user) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      order_status: orderData.status || 'payment_success',
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

  // ============================================
  // ⭐ ارسال Email به کاربر
  // ============================================
  let emailResult = null;
  try {
    const emailSettings = await getEmailSettingsRaw(env);
    if (emailSettings.is_enabled) {
      emailResult = await sendUserEmailNotification(
        env,
        userData.id,
        'payment_success',
        orderData,
        userData,
        [],
        baseUrl
      );
    }
  } catch (emailError) {
    console.error('❌ Email error in sendUserPaymentSuccessNotification:', emailError);
    emailResult = { success: false, error: String(emailError?.message || emailError) };
  }

  // ============================================
  // ⭐⭐⭐ Web Push به کاربر
  // ============================================
  let webPushResult = null;
  try {
    const webPushSettings = await getChannelSettings(env, 'web_push');
    if (webPushSettings && webPushSettings.is_enabled) {
      webPushResult = await sendWebPushNotification(
        env,
        userData.id,
        'payment_success',
        {
          title: '💰 پرداخت شما موفق بود',
          body: `پرداخت سفارش ${orderData.orderNumber || ''} با موفقیت انجام شد.`,
          icon: '/assets/images/logo.png',
          badge: '/assets/images/logo.png',
          url: baseUrl ? `${baseUrl}/account/orders/${orderData.orderId}` : `/account/orders/${orderData.orderId}`,
          tag: `user-payment-${orderData.orderId}`
        },
        orderData.orderId,
        true
      );
    }
  } catch (webPushError) {
    console.error('❌ Web Push error in sendUserPaymentSuccessNotification:', webPushError);
    webPushResult = { success: false, error: String(webPushError?.message || webPushError) };
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success) || (emailResult && emailResult.success) || (webPushResult && webPushResult.success),
    results: {
      telegram: telegramResult,
      sms: smsResult,
      email: emailResult,
      web_push: webPushResult
    }
  };
}

// ============================================
// 13. اعلان تغییر وضعیت سفارش برای کاربر
// ============================================
export async function sendUserOrderStatusChangedNotification(env, orderData, userData, oldStatus, newStatus, trackingCode = '', baseUrl = '') {
  const statusEventMap = {
    'payment_pending': 'payment_pending',
    'payment_success': 'payment_success',
    'payment_failed': 'payment_failed',
    'order_confirmed': 'order_confirmed',
    'courier_delivery': 'courier_delivery',
    'bus_shipping': 'bus_shipping',
    'shipped': 'shipped',
    'delivered': 'delivered',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'returned': 'returned'
  };
  let eventType = statusEventMap[newStatus] || 'order_status_changed';

  const message = buildUserOrderStatusChangedMessage(orderData, userData, oldStatus, newStatus, trackingCode);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    'order_status_changed',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_status_changed_user) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
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

  // ============================================
  // ⭐ ارسال Email به کاربر
  // ============================================
  let emailResult = null;
  try {
    const emailSettings = await getEmailSettingsRaw(env);
    if (emailSettings.is_enabled) {
      emailResult = await sendUserEmailNotification(
        env,
        userData.id,
        eventType === 'cancelled' ? 'order_cancelled' : 'order_status_changed',
        orderData,
        userData,
        [],
        baseUrl
      );
    }
  } catch (emailError) {
    console.error('❌ Email error in sendUserOrderStatusChangedNotification:', emailError);
    emailResult = { success: false, error: String(emailError?.message || emailError) };
  }

  // ============================================
  // ⭐⭐⭐ Web Push به کاربر
  // ============================================
  let webPushResult = null;
  try {
    const webPushSettings = await getChannelSettings(env, 'web_push');
    if (webPushSettings && webPushSettings.is_enabled) {
      const statusLabel = newStatus || 'تغییر یافت';
      webPushResult = await sendWebPushNotification(
        env,
        userData.id,
        'order_status_changed',
        {
          title: '📦 به‌روزرسانی وضعیت سفارش',
          body: `وضعیت سفارش ${orderData.orderNumber || ''} به "${statusLabel}" تغییر یافت.${trackingCode ? ` کد رهگیری: ${trackingCode}` : ''}`,
          icon: '/assets/images/logo.png',
          badge: '/assets/images/logo.png',
          url: baseUrl ? `${baseUrl}/account/orders/${orderData.orderId}` : `/account/orders/${orderData.orderId}`,
          tag: `user-order-status-${orderData.orderId}`
        },
        orderData.orderId,
        false
      );
    }
  } catch (webPushError) {
    console.error('❌ Web Push error in sendUserOrderStatusChangedNotification:', webPushError);
    webPushResult = { success: false, error: String(webPushError?.message || webPushError) };
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success) || (emailResult && emailResult.success) || (webPushResult && webPushResult.success),
    results: {
      telegram: telegramResult,
      sms: smsResult,
      email: emailResult,
      web_push: webPushResult
    }
  };
}

// ============================================
// 14. اعلان لغو سفارش برای کاربر
// ============================================
export async function sendUserOrderCancelledNotification(env, orderData, userData, refundAmount = 0, baseUrl = '') {
  const message = buildUserOrderCancelledMessage(orderData, userData, refundAmount);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    'order_cancelled',
    message,
    replyMarkup,
    orderData.orderId,
    false
  );

  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_cancelled_user) {
    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
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

  // ============================================
  // ⭐ ارسال Email به کاربر
  // ============================================
  let emailResult = null;
  try {
    const emailSettings = await getEmailSettingsRaw(env);
    if (emailSettings.is_enabled) {
      emailResult = await sendUserEmailNotification(
        env,
        userData.id,
        'order_cancelled',
        orderData,
        userData,
        [],
        baseUrl
      );
    }
  } catch (emailError) {
    console.error('❌ Email error in sendUserOrderCancelledNotification:', emailError);
    emailResult = { success: false, error: String(emailError?.message || emailError) };
  }

  // ============================================
  // ⭐⭐⭐ Web Push به کاربر
  // ============================================
  let webPushResult = null;
  try {
    const webPushSettings = await getChannelSettings(env, 'web_push');
    if (webPushSettings && webPushSettings.is_enabled) {
      webPushResult = await sendWebPushNotification(
        env,
        userData.id,
        'order_cancelled',
        {
          title: '❌ لغو سفارش',
          body: `سفارش ${orderData.orderNumber || ''} لغو شد.${refundAmount > 0 ? ` مبلغ ${refundAmount.toLocaleString()} تومان به کیف پول شما بازگشت داده شد.` : ''}`,
          icon: '/assets/images/logo.png',
          badge: '/assets/images/logo.png',
          url: baseUrl ? `${baseUrl}/account/orders/${orderData.orderId}` : `/account/orders/${orderData.orderId}`,
          tag: `user-order-cancel-${orderData.orderId}`
        },
        orderData.orderId,
        false
      );
    }
  } catch (webPushError) {
    console.error('❌ Web Push error in sendUserOrderCancelledNotification:', webPushError);
    webPushResult = { success: false, error: String(webPushError?.message || webPushError) };
  }

  return {
    success: telegramResult.success || (smsResult && smsResult.success) || (emailResult && emailResult.success) || (webPushResult && webPushResult.success),
    results: {
      telegram: telegramResult,
      sms: smsResult,
      email: emailResult,
      web_push: webPushResult
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
// ⭐⭐ 16. اعلان تراکنش کیف پول برای کاربر (Email)
// ============================================
export async function sendUserWalletNotification(env, userId, eventType, transactionData, userData) {
  try {
    const emailSettings = await getEmailSettingsRaw(env);
    if (!emailSettings.is_enabled) {
      return { success: false, error: 'کانال Email غیرفعال است.' };
    }

    const result = await sendWalletEmailNotification(
      env,
      userId,
      eventType,
      userData,
      transactionData
    );

    // ============================================
    // ⭐⭐⭐ Web Push برای کیف پول
    // ============================================
    let webPushResult = null;
    try {
      const webPushSettings = await getChannelSettings(env, 'web_push');
      if (webPushSettings && webPushSettings.is_enabled && userData && userData.id) {
        const amount = transactionData?.amount || 0;
        const type = eventType === 'wallet_topup' ? 'شارژ' : 'برداشت';
        webPushResult = await sendWebPushNotification(
          env,
          userData.id,
          eventType,
          {
            title: `💰 ${type} کیف پول`,
            body: `مبلغ ${amount.toLocaleString()} تومان ${type === 'شارژ' ? 'به' : 'از'} کیف پول شما ${type === 'شارژ' ? 'افزود' : 'کسر'} شد.`,
            icon: '/assets/images/logo.png',
            badge: '/assets/images/logo.png',
            url: baseUrl ? `${baseUrl}/account/wallet` : '/account/wallet',
            tag: `wallet-${eventType}-${Date.now()}`
          },
          null,
          false
        );
      }
    } catch (webPushError) {
      console.error('❌ Web Push error in sendUserWalletNotification:', webPushError);
      webPushResult = { success: false, error: String(webPushError?.message || webPushError) };
    }

    return {
      ...result,
      web_push: webPushResult
    };
  } catch (error) {
    console.error('❌ sendUserWalletNotification error:', error);
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}

// ============================================
// 17. تابع ارسال همزمان به ادمین و کاربر
// ============================================
export async function sendNotificationToAdminAndUser(env, adminEventType, userEventType, orderData, userData, items, baseUrl = '', paymentMethod = '', trackingCode = '') {
  const results = {
    admin: null,
    user: null
  };

  if (adminEventType === 'order_created') {
    results.admin = await sendOrderCreatedNotification(env, orderData, userData, items, baseUrl);
  } else if (adminEventType === 'payment_success') {
    results.admin = await sendPaymentSuccessNotification(env, orderData, userData, paymentMethod);
  } else if (adminEventType === 'order_status_changed') {
    results.admin = { success: false, error: 'نیاز به پارامترهای بیشتر دارد.' };
  }

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
  sendUserSmsNotification,
  sendWebPushNotification,
  sendUserWebPushNotificationInternal as sendUserWebPushNotification,
  testEmailNotificationWrapper as testEmailNotification
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
  return 'https://takdaro-site.pages.dev';
}