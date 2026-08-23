// ============================================
// سرویس SMS Gateway (ارسال و دریافت)
// ============================================

import { getDb } from './db.js';

// ============================================
// توابع کمکی
// ============================================

/**
 * تولید شناسه یکتا برای پیام
 * @returns {string} - UUID v4
 */
export function generateMessageId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * نرمال‌سازی شماره تلفن
 * @param {string} phone - شماره تلفن
 * @returns {string} - شماره نرمال‌سازی شده
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).trim();
  cleaned = cleaned.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '+98' + cleaned.substring(1);
  }
  if (cleaned.startsWith('98') && cleaned.length === 12 && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  if (cleaned.startsWith('9') && cleaned.length === 10 && !cleaned.startsWith('+')) {
    cleaned = '+98' + cleaned;
  }
  return cleaned;
}

/**
 * دریافت تنظیمات SMS از دیتابیس
 * @param {Object} env - محیط Cloudflare
 * @returns {Promise<Object>} - تنظیمات SMS
 */
export async function getSmsSettings(env) {
  const db = getDb(env);
  
  const result = await db
    .prepare(`
      SELECT 
        id,
        is_enabled,
        admin_phone,
        gateway_url,
        polling_interval,
        max_sms_per_minute,
        retry_interval,
        default_sender,
        event_order_created_admin,
        event_order_created_user,
        event_order_status_changed_user,
        event_payment_success_admin,
        event_payment_success_user,
        event_order_cancelled_user,
        extra_config,
        updated_by_user_id,
        created_at,
        updated_at
      FROM sms_settings
      LIMIT 1
    `)
    .first();

  if (!result) {
    return {
      is_enabled: false,
      admin_phone: '',
      gateway_url: '',
      polling_interval: 30,
      max_sms_per_minute: 10,
      retry_interval: 300,
      default_sender: '',
      event_order_created_admin: true,
      event_order_created_user: false,
      event_order_status_changed_user: false,
      event_payment_success_admin: true,
      event_payment_success_user: false,
      event_order_cancelled_user: false,
      extra_config: {}
    };
  }

  let extraConfig = {};
  try {
    if (result.extra_config && typeof result.extra_config === 'string') {
      extraConfig = JSON.parse(result.extra_config);
    } else if (result.extra_config && typeof result.extra_config === 'object') {
      extraConfig = result.extra_config;
    }
  } catch (_) {
    extraConfig = {};
  }

  return {
    id: result.id,
    is_enabled: result.is_enabled === 1,
    admin_phone: result.admin_phone || '',
    gateway_url: result.gateway_url || '',
    polling_interval: result.polling_interval || 30,
    max_sms_per_minute: result.max_sms_per_minute || 10,
    retry_interval: result.retry_interval || 300,
    default_sender: result.default_sender || '',
    event_order_created_admin: result.event_order_created_admin === 1,
    event_order_created_user: result.event_order_created_user === 1,
    event_order_status_changed_user: result.event_order_status_changed_user === 1,
    event_payment_success_admin: result.event_payment_success_admin === 1,
    event_payment_success_user: result.event_payment_success_user === 1,
    event_order_cancelled_user: result.event_order_cancelled_user === 1,
    extra_config: extraConfig,
    updated_by_user_id: result.updated_by_user_id,
    created_at: result.created_at,
    updated_at: result.updated_at
  };
}

/**
 * افزودن پیام به صف ارسال
 * @param {Object} env - محیط Cloudflare
 * @param {Object} data - اطلاعات پیام
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function addSmsToOutbox(env, data) {
  const db = getDb(env);

  const {
    recipient,
    message,
    sender = '',
    priority = 0,
    eventType = null,
    referenceId = null,
    referenceType = null,
    createdByUserId = null,
    maxRetry = 3
  } = data;

  if (!recipient || !message) {
    throw new Error('گیرنده و متن پیام الزامی هستند.');
  }

  const normalizedRecipient = normalizePhoneNumber(recipient);
  if (!normalizedRecipient) {
    throw new Error('شماره گیرنده معتبر نیست.');
  }

  const messageId = generateMessageId();

  const result = await db
    .prepare(`
      INSERT INTO sms_outbox (
        message_id,
        recipient,
        message,
        sender,
        priority,
        status,
        retry_count,
        max_retry,
        event_type,
        reference_id,
        reference_type,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .bind(
      messageId,
      normalizedRecipient,
      message,
      sender || '',
      priority || 0,
      maxRetry || 3,
      eventType || null,
      referenceId || null,
      referenceType || null,
      createdByUserId || null
    )
    .run();

  await logGatewayActivity(env, {
    direction: 'outbound',
    messageId: messageId,
    gatewayAction: 'queued',
    status: 'pending',
    durationMs: null,
    gatewayIp: null,
    errorMessage: null
  });

  return {
    success: true,
    messageId: messageId,
    id: result.meta?.last_row_id || null
  };
}

/**
 * دریافت پیام‌های در انتظار ارسال برای Gateway
 * @param {Object} env - محیط Cloudflare
 * @param {number} limit - تعداد پیام در هر بار
 * @returns {Promise<Array>} - لیست پیام‌های در انتظار
 */
export async function getPendingSms(env, limit = 10) {
  const db = getDb(env);

  const result = await db
    .prepare(`
      SELECT 
        id,
        message_id,
        recipient,
        message,
        sender,
        priority,
        status,
        retry_count,
        max_retry,
        event_type,
        reference_id,
        reference_type,
        created_at
      FROM sms_outbox
      WHERE status IN ('pending', 'retry')
        AND retry_count < max_retry
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `)
    .bind(limit)
    .all();

  return Array.isArray(result?.results) ? result.results : [];
}

/**
 * علامت‌گذاری پیام به عنوان ارسال‌شده
 * @param {Object} env - محیط Cloudflare
 * @param {string} messageId - شناسه پیام
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function markSmsAsSent(env, messageId) {
  const db = getDb(env);

  await db
    .prepare(`
      UPDATE sms_outbox
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE message_id = ?
    `)
    .bind(messageId)
    .run();

  await logGatewayActivity(env, {
    direction: 'outbound',
    messageId: messageId,
    gatewayAction: 'send_success',
    status: 'success',
    durationMs: null,
    gatewayIp: null,
    errorMessage: null
  });

  return { success: true };
}

/**
 * علامت‌گذاری پیام به عنوان ناموفق
 * @param {Object} env - محیط Cloudflare
 * @param {string} messageId - شناسه پیام
 * @param {string} errorMessage - پیام خطا
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function markSmsAsFailed(env, messageId, errorMessage) {
  const db = getDb(env);

  const current = await db
    .prepare(`SELECT retry_count, max_retry FROM sms_outbox WHERE message_id = ?`)
    .bind(messageId)
    .first();

  if (!current) {
    return { success: false, error: 'پیام یافت نشد.' };
  }

  const newRetryCount = (current.retry_count || 0) + 1;
  const newStatus = newRetryCount >= (current.max_retry || 3) ? 'failed' : 'retry';

  await db
    .prepare(`
      UPDATE sms_outbox
      SET 
        status = ?,
        retry_count = ?,
        error_message = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE message_id = ?
    `)
    .bind(newStatus, newRetryCount, errorMessage || null, messageId)
    .run();

  await logGatewayActivity(env, {
    direction: 'outbound',
    messageId: messageId,
    gatewayAction: 'send_failed',
    status: 'failed',
    durationMs: null,
    gatewayIp: null,
    errorMessage: errorMessage || 'ارسال انجام نشد.'
  });

  return {
    success: true,
    status: newStatus,
    retryCount: newRetryCount
  };
}

/**
 * به‌روزرسانی وضعیت پیام
 * @param {Object} env - محیط Cloudflare
 * @param {string} messageId - شناسه پیام
 * @param {string} status - وضعیت جدید
 * @param {string} errorMessage - پیام خطا (اختیاری)
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function updateSmsStatus(env, messageId, status, errorMessage = null) {
  const db = getDb(env);

  const allowedStatuses = ['pending', 'sent', 'failed', 'retry'];
  if (!allowedStatuses.includes(status)) {
    throw new Error(`وضعیت ${status} معتبر نیست.`);
  }

  const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const values = [status];

  if (status === 'sent') {
    updates.push('sent_at = CURRENT_TIMESTAMP');
  }

  if (errorMessage !== null) {
    updates.push('error_message = ?');
    values.push(errorMessage);
  }

  values.push(messageId);

  await db
    .prepare(`
      UPDATE sms_outbox
      SET ${updates.join(', ')}
      WHERE message_id = ?
    `)
    .bind(...values)
    .run();

  return { success: true };
}

/**
 * ذخیره SMS دریافتی
 * @param {Object} env - محیط Cloudflare
 * @param {Object} data - اطلاعات پیام دریافتی
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function saveIncomingSms(env, data) {
  const db = getDb(env);

  const {
    messageId,
    sender,
    recipient,
    message,
    receivedAt
  } = data;

  if (!messageId || !sender || !recipient || !message) {
    throw new Error('همه فیلدهای پیام دریافتی الزامی هستند.');
  }

  const normalizedSender = normalizePhoneNumber(sender);
  const normalizedRecipient = normalizePhoneNumber(recipient);

  const result = await db
    .prepare(`
      INSERT INTO sms_inbox (
        message_id,
        sender,
        recipient,
        message,
        received_at,
        status,
        processed,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'received', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .bind(
      messageId,
      normalizedSender,
      normalizedRecipient,
      message,
      receivedAt || new Date().toISOString()
    )
    .run();

  await logGatewayActivity(env, {
    direction: 'inbound',
    messageId: messageId,
    gatewayAction: 'receive',
    status: 'success',
    durationMs: null,
    gatewayIp: null,
    errorMessage: null
  });

  return {
    success: true,
    id: result.meta?.last_row_id || null,
    messageId: messageId
  };
}

/**
 * ثبت لاگ فعالیت Gateway
 * @param {Object} env - محیط Cloudflare
 * @param {Object} data - اطلاعات لاگ
 * @returns {Promise<number>} - شناسه لاگ
 */
export async function logGatewayActivity(env, data) {
  const db = getDb(env);

  const {
    direction,
    messageId,
    gatewayAction,
    requestPayload = null,
    responsePayload = null,
    status,
    errorMessage = null,
    durationMs = null,
    gatewayIp = null
  } = data;

  if (!direction || !gatewayAction || !status) {
    throw new Error('direction, gatewayAction و status الزامی هستند.');
  }

  const result = await db
    .prepare(`
      INSERT INTO sms_gateway_logs (
        direction,
        message_id,
        gateway_action,
        request_payload,
        response_payload,
        status,
        error_message,
        duration_ms,
        gateway_ip,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(
      direction,
      messageId || null,
      gatewayAction,
      requestPayload || null,
      responsePayload || null,
      status,
      errorMessage || null,
      durationMs || null,
      gatewayIp || null
    )
    .run();

  return result.meta?.last_row_id || null;
}

/**
 * دریافت آمار SMS
 * @param {Object} env - محیط Cloudflare
 * @returns {Promise<Object>} - آمار SMS
 */
export async function getSmsStats(env) {
  const db = getDb(env);

  const outboxStats = await db
    .prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'retry' THEN 1 ELSE 0 END) as retry
      FROM sms_outbox
    `)
    .first();

  const inboxStats = await db
    .prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN processed = 0 THEN 1 ELSE 0 END) as unprocessed
      FROM sms_inbox
    `)
    .first();

  const logStats = await db
    .prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM sms_gateway_logs
    `)
    .first();

  const lastSent = await db
    .prepare(`
      SELECT message_id, recipient, sent_at
      FROM sms_outbox
      WHERE status = 'sent'
      ORDER BY sent_at DESC
      LIMIT 1
    `)
    .first();

  const lastReceived = await db
    .prepare(`
      SELECT message_id, sender, received_at
      FROM sms_inbox
      ORDER BY received_at DESC
      LIMIT 1
    `)
    .first();

  return {
    outbox: {
      total: outboxStats?.total || 0,
      pending: outboxStats?.pending || 0,
      sent: outboxStats?.sent || 0,
      failed: outboxStats?.failed || 0,
      retry: outboxStats?.retry || 0
    },
    inbox: {
      total: inboxStats?.total || 0,
      processed: inboxStats?.processed || 0,
      unprocessed: inboxStats?.unprocessed || 0
    },
    logs: {
      total: logStats?.total || 0,
      outbound: logStats?.outbound || 0,
      inbound: logStats?.inbound || 0,
      success: logStats?.success || 0,
      failed: logStats?.failed || 0
    },
    last_sent: lastSent || null,
    last_received: lastReceived || null
  };
}

export {
  getDb
};