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

// ============================================
// ⭐⭐ تبدیل وضعیت‌ها به فارسی (16 وضعیت کامل)
// ============================================

/**
 * تبدیل وضعیت سفارش به فارسی - 16 وضعیت کامل
 * @param {string} status - وضعیت انگلیسی
 * @returns {string} - وضعیت فارسی
 */
function getPersianOrderStatus(status) {
  const map = {
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
  return map[String(status || '').toLowerCase()] || status || '';
}

/**
 * تبدیل وضعیت پرداخت به فارسی - کامل
 * @param {string} status - وضعیت انگلیسی
 * @returns {string} - وضعیت فارسی
 */
function getPersianPaymentStatus(status) {
  const map = {
    'payment_pending': 'در انتظار پرداخت',
    'payment_success': 'پرداخت موفق',
    'payment_failed': 'پرداخت ناموفق',
    'payment_review': 'بررسی پرداخت',
    'pending': 'در انتظار پرداخت',
    'paid': 'پرداخت شده',
    'completed': 'تکمیل شده',
    'failed': 'ناموفق',
    'refunded': 'بازگشت داده شده'
  };
  return map[String(status || '').toLowerCase()] || status || '';
}

/**
 * تبدیل مبلغ به فرمت فارسی با هزارگان
 * @param {number|string} amount - مبلغ
 * @returns {string} - مبلغ به فرمت فارسی
 */
function formatPersianAmount(amount) {
  const num = Number(amount || 0);
  return num.toLocaleString('fa-IR');
}

// ============================================
// ⭐⭐ توابع مدیریت Template
// ============================================

/**
 * دریافت Template SMS از دیتابیس
 * @param {Object} env - محیط Cloudflare
 * @param {string} eventType - نوع رویداد
 * @returns {Promise<Object|null>} - Template یا null
 */
export async function getSmsTemplate(env, eventType) {
  const db = getDb(env);
  
  const result = await db
    .prepare(`
      SELECT 
        id,
        event_type,
        title,
        message_template,
        is_enabled,
        created_at,
        updated_at
      FROM sms_templates
      WHERE event_type = ?
    `)
    .bind(eventType)
    .first();

  return result;
}

/**
 * دریافت همه Template‌های SMS
 * @param {Object} env - محیط Cloudflare
 * @param {boolean} onlyEnabled - فقط فعال‌ها
 * @returns {Promise<Array>} - لیست Template‌ها
 */
export async function getAllSmsTemplates(env, onlyEnabled = false) {
  const db = getDb(env);
  
  let query = `
    SELECT 
      id,
      event_type,
      title,
      message_template,
      is_enabled,
      created_at,
      updated_at
    FROM sms_templates
  `;
  
  if (onlyEnabled) {
    query += ` WHERE is_enabled = 1`;
  }
  
  query += ` ORDER BY id ASC`;
  
  const result = await db.prepare(query).all();
  return Array.isArray(result?.results) ? result.results : [];
}

/**
 * ذخیره یا به‌روزرسانی Template SMS
 * @param {Object} env - محیط Cloudflare
 * @param {Object} data - اطلاعات Template
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function saveSmsTemplate(env, data) {
  const db = getDb(env);
  
  const {
    eventType,
    title,
    messageTemplate,
    isEnabled
  } = data;

  if (!eventType || !title || !messageTemplate) {
    throw new Error('eventType, title و messageTemplate الزامی هستند.');
  }

  const existing = await db
    .prepare(`SELECT id FROM sms_templates WHERE event_type = ?`)
    .bind(eventType)
    .first();

  if (existing) {
    await db
      .prepare(`
        UPDATE sms_templates
        SET 
          title = ?,
          message_template = ?,
          is_enabled = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE event_type = ?
      `)
      .bind(title, messageTemplate, isEnabled ? 1 : 0, eventType)
      .run();
  } else {
    await db
      .prepare(`
        INSERT INTO sms_templates (event_type, title, message_template, is_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(eventType, title, messageTemplate, isEnabled ? 1 : 0)
      .run();
  }

  return { success: true };
}

/**
 * فعال/غیرفعال کردن Template
 * @param {Object} env - محیط Cloudflare
 * @param {string} eventType - نوع رویداد
 * @param {boolean} isEnabled - فعال/غیرفعال
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function toggleSmsTemplate(env, eventType, isEnabled) {
  const db = getDb(env);
  
  await db
    .prepare(`
      UPDATE sms_templates
      SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE event_type = ?
    `)
    .bind(isEnabled ? 1 : 0, eventType)
    .run();

  return { success: true };
}

// ============================================
// ⭐⭐ توابع رندر Template (با فارسی کامل)
// ============================================

/**
 * جایگزینی متغیرها در متن Template
 * @param {string} template - متن Template
 * @param {Object} data - داده‌های جایگزینی
 * @returns {string} - متن نهایی
 */
export function renderSmsTemplate(template, data) {
  if (!template) return '';
  
  let result = template;
  
  // متغیرهای استاندارد با تبدیل وضعیت‌ها به فارسی
  const variables = {
    '{customer_name}': data.customer_name || '',
    '{customer_phone}': data.customer_phone || '',
    '{order_number}': data.order_number || '',
    '{amount}': formatPersianAmount(data.amount),
    '{payment_status}': getPersianPaymentStatus(data.payment_status),
    '{order_status}': getPersianOrderStatus(data.order_status),
    '{tracking_code}': data.tracking_code || ''
  };
  
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(key, 'g'), value);
  }
  
  return result;
}

/**
 * دریافت و رندر Template
 * @param {Object} env - محیط Cloudflare
 * @param {string} eventType - نوع رویداد
 * @param {Object} data - داده‌های جایگزینی
 * @returns {Promise<Object>} - { template, rendered, isEnabled }
 */
export async function getAndRenderSmsTemplate(env, eventType, data) {
  const template = await getSmsTemplate(env, eventType);
  
  if (!template) {
    return {
      template: null,
      rendered: null,
      isEnabled: false,
      error: 'Template یافت نشد'
    };
  }
  
  const rendered = renderSmsTemplate(template.message_template, data);
  
  return {
    template: template,
    rendered: rendered,
    isEnabled: template.is_enabled === 1
  };
}

// ============================================
// تنظیمات SMS
// ============================================

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
 * ذخیره تنظیمات SMS
 * @param {Object} env - محیط Cloudflare
 * @param {Object} settings - تنظیمات جدید
 * @param {number} userId - شناسه کاربر تغییردهنده
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function saveSmsSettings(env, settings, userId) {
  const db = getDb(env);

  const allowedFields = [
    'is_enabled',
    'admin_phone',
    'gateway_url',
    'polling_interval',
    'max_sms_per_minute',
    'retry_interval',
    'default_sender',
    'event_order_created_admin',
    'event_order_created_user',
    'event_order_status_changed_user',
    'event_payment_success_admin',
    'event_payment_success_user',
    'event_order_cancelled_user',
    'extra_config'
  ];

  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (settings[field] !== undefined) {
      let value = settings[field];
      
      if (typeof value === 'boolean') {
        value = value ? 1 : 0;
      }
      
      if (field === 'extra_config' && typeof value === 'object') {
        value = JSON.stringify(value);
      }

      updates.push(`${field} = ?`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    throw new Error('هیچ تنظیماتی برای به‌روزرسانی وجود ندارد.');
  }

  const existing = await db
    .prepare(`SELECT id FROM sms_settings LIMIT 1`)
    .first();

  if (existing) {
    values.push(userId);
    const query = `
      UPDATE sms_settings
      SET ${updates.join(', ')}, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    values.push(existing.id);
    await db.prepare(query).bind(...values).run();
  } else {
    const insertFields = [...allowedFields, 'updated_by_user_id'];
    const placeholders = insertFields.map(() => '?').join(', ');
    const insertValues = [];

    for (const field of allowedFields) {
      const val = settings[field] !== undefined ? settings[field] : null;
      let value = val;
      if (typeof value === 'boolean') {
        value = value ? 1 : 0;
      }
      if (field === 'extra_config' && typeof value === 'object') {
        value = JSON.stringify(value);
      }
      insertValues.push(value);
    }
    insertValues.push(userId);

    const query = `
      INSERT INTO sms_settings (${insertFields.join(', ')}, created_at, updated_at)
      VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    await db.prepare(query).bind(...insertValues).run();
  }

  return { success: true };
}

/**
 * به‌روزرسانی تنظیمات SMS (alias برای saveSmsSettings)
 */
export async function updateSmsSettings(env, settings, userId) {
  return saveSmsSettings(env, settings, userId);
}

// ============================================
// توابع مدیریت صف ارسال (Outbox)
// ============================================

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

// ============================================
// توابع مدیریت SMS دریافتی (Inbox)
// ============================================

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

  const isDuplicate = await checkDuplicateInbox(env, messageId);
  if (isDuplicate) {
    return {
      success: false,
      error: 'پیام تکراری است.',
      duplicate: true
    };
  }

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
 * بررسی تکراری بودن SMS دریافتی
 * @param {Object} env - محیط Cloudflare
 * @param {string} messageId - شناسه پیام
 * @returns {Promise<boolean>} - true اگر تکراری باشد
 */
export async function checkDuplicateInbox(env, messageId) {
  const db = getDb(env);

  const result = await db
    .prepare(`SELECT id FROM sms_inbox WHERE message_id = ? LIMIT 1`)
    .bind(messageId)
    .first();

  return !!result;
}

/**
 * دریافت SMS‌های دریافتی
 * @param {Object} env - محیط Cloudflare
 * @param {Object} options - گزینه‌های فیلتر
 * @returns {Promise<Object>} - لیست SMS‌های دریافتی
 */
export async function getIncomingSms(env, options = {}) {
  const db = getDb(env);

  const {
    sender,
    recipient,
    status,
    processed,
    limit = 50,
    offset = 0,
    fromDate,
    toDate
  } = options;

  let query = `
    SELECT 
      id,
      message_id,
      sender,
      recipient,
      message,
      received_at,
      processed,
      processed_at,
      processed_by,
      status,
      reference_id,
      reference_type,
      note,
      created_at,
      updated_at
    FROM sms_inbox
    WHERE 1=1
  `;

  const params = [];

  if (sender) {
    query += ` AND sender = ?`;
    params.push(normalizePhoneNumber(sender));
  }

  if (recipient) {
    query += ` AND recipient = ?`;
    params.push(normalizePhoneNumber(recipient));
  }

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (processed !== undefined) {
    query += ` AND processed = ?`;
    params.push(processed ? 1 : 0);
  }

  if (fromDate) {
    query += ` AND received_at >= ?`;
    params.push(fromDate);
  }

  if (toDate) {
    query += ` AND received_at <= ?`;
    params.push(toDate);
  }

  query += ` ORDER BY received_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await db.prepare(query).bind(...params).all();

  let countQuery = `
    SELECT COUNT(*) as total
    FROM sms_inbox
    WHERE 1=1
  `;

  const countParams = [];
  if (sender) {
    countQuery += ` AND sender = ?`;
    countParams.push(normalizePhoneNumber(sender));
  }
  if (recipient) {
    countQuery += ` AND recipient = ?`;
    countParams.push(normalizePhoneNumber(recipient));
  }
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  if (processed !== undefined) {
    countQuery += ` AND processed = ?`;
    countParams.push(processed ? 1 : 0);
  }
  if (fromDate) {
    countQuery += ` AND received_at >= ?`;
    countParams.push(fromDate);
  }
  if (toDate) {
    countQuery += ` AND received_at <= ?`;
    countParams.push(toDate);
  }

  const countResult = await db.prepare(countQuery).bind(...countParams).first();

  return {
    sms: Array.isArray(result?.results) ? result.results : [],
    total: countResult?.total || 0,
    limit: limit,
    offset: offset
  };
}

/**
 * علامت‌گذاری SMS دریافتی به عنوان پردازش‌شده
 * @param {Object} env - محیط Cloudflare
 * @param {number} inboxId - شناسه پیام در sms_inbox
 * @param {Object} data - اطلاعات پردازش
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function markIncomingSmsAsProcessed(env, inboxId, data = {}) {
  const db = getDb(env);

  const {
    status = 'processed',
    referenceId = null,
    referenceType = null,
    note = null,
    processedBy = 'system'
  } = data;

  await db
    .prepare(`
      UPDATE sms_inbox
      SET 
        processed = 1,
        processed_at = CURRENT_TIMESTAMP,
        processed_by = ?,
        status = ?,
        reference_id = ?,
        reference_type = ?,
        note = COALESCE(?, note),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(
      processedBy,
      status,
      referenceId || null,
      referenceType || null,
      note || null,
      inboxId
    )
    .run();

  return { success: true };
}

// ============================================
// توابع مدیریت لاگ‌های Gateway
// ============================================

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
 * دریافت لاگ‌های Gateway
 * @param {Object} env - محیط Cloudflare
 * @param {Object} options - گزینه‌های فیلتر
 * @returns {Promise<Object>} - لیست لاگ‌ها
 */
export async function getGatewayLogs(env, options = {}) {
  const db = getDb(env);

  const {
    direction,
    status,
    messageId,
    limit = 50,
    offset = 0,
    fromDate,
    toDate
  } = options;

  let query = `
    SELECT 
      id,
      direction,
      message_id,
      gateway_action,
      status,
      error_message,
      duration_ms,
      gateway_ip,
      created_at
    FROM sms_gateway_logs
    WHERE 1=1
  `;

  const params = [];

  if (direction) {
    query += ` AND direction = ?`;
    params.push(direction);
  }

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (messageId) {
    query += ` AND message_id = ?`;
    params.push(messageId);
  }

  if (fromDate) {
    query += ` AND created_at >= ?`;
    params.push(fromDate);
  }

  if (toDate) {
    query += ` AND created_at <= ?`;
    params.push(toDate);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await db.prepare(query).bind(...params).all();

  let countQuery = `
    SELECT COUNT(*) as total
    FROM sms_gateway_logs
    WHERE 1=1
  `;

  const countParams = [];
  if (direction) {
    countQuery += ` AND direction = ?`;
    countParams.push(direction);
  }
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  if (messageId) {
    countQuery += ` AND message_id = ?`;
    countParams.push(messageId);
  }
  if (fromDate) {
    countQuery += ` AND created_at >= ?`;
    countParams.push(fromDate);
  }
  if (toDate) {
    countQuery += ` AND created_at <= ?`;
    countParams.push(toDate);
  }

  const countResult = await db.prepare(countQuery).bind(...countParams).first();

  return {
    logs: Array.isArray(result?.results) ? result.results : [],
    total: countResult?.total || 0,
    limit: limit,
    offset: offset
  };
}

// ============================================
// توابع آمار و گزارش
// ============================================

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

// ============================================
// ⭐⭐ تابع ارسال SMS با Template (اصلاح شده)
// ============================================

/**
 * ارسال SMS با استفاده از Template
 * @param {Object} env - محیط Cloudflare
 * @param {Object} data - اطلاعات پیام
 * @param {string} data.eventType - نوع رویداد
 * @param {string} data.recipient - شماره گیرنده
 * @param {Object} data.data - داده‌های جایگزینی
 * @param {string} data.sender - شماره فرستنده (اختیاری)
 * @param {string} data.referenceId - شناسه مرجع (اختیاری)
 * @param {string} data.referenceType - نوع مرجع (اختیاری)
 * @param {number} data.createdByUserId - شناسه کاربر ایجادکننده (اختیاری)
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function sendSmsWithTemplate(env, data) {
  const {
    eventType,
    recipient,
    data: templateData,
    sender = '',
    referenceId = null,
    referenceType = null,
    createdByUserId = null
  } = data;

  if (!eventType || !recipient) {
    throw new Error('eventType و recipient الزامی هستند.');
  }

  // دریافت و رندر Template
  const result = await getAndRenderSmsTemplate(env, eventType, templateData);
  
  if (!result.template) {
    return {
      success: false,
      error: `Template برای رویداد ${eventType} یافت نشد`
    };
  }

  if (!result.isEnabled) {
    return {
      success: false,
      error: `Template برای رویداد ${eventType} غیرفعال است`,
      template: result.template
    };
  }

  // افزودن به صف ارسال
  const sendResult = await addSmsToOutbox(env, {
    recipient: recipient,
    message: result.rendered,
    sender: sender,
    priority: 0,
    eventType: eventType,
    referenceId: referenceId,
    referenceType: referenceType,
    createdByUserId: createdByUserId
  });

  return {
    success: sendResult.success,
    messageId: sendResult.messageId,
    template: result.template,
    rendered: result.rendered
  };
}

// ============================================
// توابع کمکی برای ارسال SMS (API Gateway)
// ============================================

/**
 * ارسال SMS از طریق Gateway (تابع اصلی برای استفاده در سایر بخش‌ها)
 * @param {Object} env - محیط Cloudflare
 * @param {Object} data - اطلاعات پیام
 * @param {string} data.recipient - شماره گیرنده
 * @param {string} data.message - متن پیام
 * @param {string} data.sender - شماره فرستنده (اختیاری)
 * @param {string} data.eventType - نوع رویداد (اختیاری)
 * @param {string} data.referenceId - شناسه مرجع (اختیاری)
 * @param {string} data.referenceType - نوع مرجع (اختیاری)
 * @param {number} data.createdByUserId - شناسه کاربر ایجادکننده (اختیاری)
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function sendSms(env, data) {
  const settings = await getSmsSettings(env);
  if (!settings.is_enabled) {
    return {
      success: false,
      error: 'سیستم SMS غیرفعال است.'
    };
  }

  if (data.eventType && !data.message) {
    return sendSmsWithTemplate(env, {
      eventType: data.eventType,
      recipient: data.recipient,
      data: data.templateData || {},
      sender: data.sender || '',
      referenceId: data.referenceId || null,
      referenceType: data.referenceType || null,
      createdByUserId: data.createdByUserId || null
    });
  }

  return addSmsToOutbox(env, data);
}

// ============================================
// صادرات نهایی
// ============================================

export {
  getDb
};