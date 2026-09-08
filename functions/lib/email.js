// ============================================
// سرویس Email Notification با Resend API
// ============================================

import { getDb } from './db.js';
import { getStatusLabel } from './status-mapping.js';

// ============================================
// توابع کمکی
// ============================================

function formatPersianAmount(amount) {
  const num = Number(amount || 0);
  return num.toLocaleString('fa-IR');
}

function formatPersianDate(dateString) {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch {
    return dateString || '';
  }
}

function getPersianOrderStatus(status) {
  return getStatusLabel(status);
}

function buildItemsHtml(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<tr><td colspan="4" style="text-align:center;padding:12px;color:#94a3b8;">هیچ محصولی ثبت نشده است</td></tr>';
  }

  let html = '';
  let total = 0;

  for (const item of items) {
    const name = item.product_name || item.name || 'محصول';
    const qty = Number(item.quantity || 0);
    const price = Number(item.unit_price || 0);
    const rowTotal = Number(item.total_price || 0) || (qty * price);
    total += rowTotal;

    html += `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${name}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:center;">${qty}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:left;">${formatPersianAmount(price)} تومان</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:left;font-weight:bold;">${formatPersianAmount(rowTotal)} تومان</td>
      </tr>
    `;
  }

  return html;
}

// ============================================
// توابع مدیریت تنظیمات Email
// ============================================

export async function getEmailSettings(env) {
  const db = getDb(env);

  const result = await db
    .prepare(`
      SELECT 
        id,
        channel,
        is_enabled,
        config,
        updated_by_user_id,
        updated_at
      FROM notification_settings
      WHERE channel = 'email'
      LIMIT 1
    `)
    .first();

  if (!result) {
    return {
      id: null,
      channel: 'email',
      is_enabled: false,
      config: {
        sender_email: '',
        sender_name: '',
        admin_email: '',
        templates: {}
      },
      updated_by_user_id: null,
      updated_at: null
    };
  }

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

  if (!config.sender_email) config.sender_email = '';
  if (!config.sender_name) config.sender_name = '';
  if (!config.admin_email) config.admin_email = '';
  if (!config.templates) config.templates = {};

  return {
    id: result.id,
    channel: result.channel,
    is_enabled: result.is_enabled === 1,
    config: config,
    updated_by_user_id: result.updated_by_user_id,
    updated_at: result.updated_at
  };
}

export async function saveEmailSettings(env, settings, userId) {
  const db = getDb(env);

  if (!settings.templates) {
    settings.templates = {};
  }

  const configJson = JSON.stringify(settings);

  const existing = await db
    .prepare(`SELECT id FROM notification_settings WHERE channel = 'email'`)
    .first();

  if (existing) {
    await db
      .prepare(`
        UPDATE notification_settings
        SET config = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE channel = 'email'
      `)
      .bind(configJson, userId)
      .run();
  } else {
    await db
      .prepare(`
        INSERT INTO notification_settings (channel, is_enabled, config, updated_by_user_id, created_at, updated_at)
        VALUES ('email', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(settings.is_enabled ? 1 : 0, configJson, userId)
      .run();
  }

  return { success: true };
}

export async function toggleEmailChannel(env, enabled, userId) {
  const db = getDb(env);

  const existing = await db
    .prepare(`SELECT id FROM notification_settings WHERE channel = 'email'`)
    .first();

  if (!existing) {
    const defaultConfig = {
      sender_email: '',
      sender_name: '',
      admin_email: '',
      templates: {}
    };

    await db
      .prepare(`
        INSERT INTO notification_settings (channel, is_enabled, config, updated_by_user_id, created_at, updated_at)
        VALUES ('email', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(enabled ? 1 : 0, JSON.stringify(defaultConfig), userId)
      .run();
  } else {
    await db
      .prepare(`
        UPDATE notification_settings
        SET is_enabled = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE channel = 'email'
      `)
      .bind(enabled ? 1 : 0, userId)
      .run();
  }

  return { success: true };
}

// ============================================
// توابع مدیریت Template‌های Email
// ============================================

export async function getEmailTemplate(env, eventType) {
  const settings = await getEmailSettings(env);
  const templates = settings.config.templates || {};
  return templates[eventType] || null;
}

export async function getAllEmailTemplates(env) {
  const settings = await getEmailSettings(env);
  const templates = settings.config.templates || {};

  const eventTypes = [
    'order_created',
    'payment_pending',
    'payment_success',
    'payment_failed',
    'order_status_changed',
    'order_cancelled',
    'wallet_credit',
    'wallet_debit',
    'cashback_applied',
    'refund_applied'
  ];

  const result = [];
  for (const eventType of eventTypes) {
    const template = templates[eventType] || null;
    result.push({
      event_type: eventType,
      title: template?.title || '',
      subject: template?.subject || '',
      body: template?.body || '',
      is_enabled: template?.is_enabled !== false,
      exists: !!template
    });
  }

  return result;
}

export async function saveEmailTemplate(env, data, userId) {
  const { eventType, title, subject, body, isEnabled } = data;

  if (!eventType || !title || !subject || !body) {
    throw new Error('eventType, title, subject و body الزامی هستند.');
  }

  const settings = await getEmailSettings(env);
  
  if (!settings.config) {
    settings.config = {};
  }
  if (!settings.config.templates) {
    settings.config.templates = {};
  }

  settings.config.templates[eventType] = {
    title: title,
    subject: subject,
    body: body,
    is_enabled: isEnabled !== undefined ? isEnabled : true,
    updated_at: new Date().toISOString()
  };

  await saveEmailSettings(env, settings.config, userId);

  return { success: true };
}

export async function toggleEmailTemplate(env, eventType, isEnabled, userId) {
  const settings = await getEmailSettings(env);
  const templates = settings.config.templates || {};

  if (!templates[eventType]) {
    throw new Error(`Template برای رویداد ${eventType} یافت نشد.`);
  }

  templates[eventType].is_enabled = isEnabled;
  templates[eventType].updated_at = new Date().toISOString();

  settings.config.templates = templates;

  await saveEmailSettings(env, settings.config, userId);

  return { success: true };
}

// ============================================
// Template‌های پیش‌فرض Email
// ============================================

const DEFAULT_EMAIL_TEMPLATES = {
  order_created: {
    title: 'ثبت سفارش جدید',
    subject: '✅ سفارش #{order_number} با موفقیت ثبت شد | تاکدارو',
    body: `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تأیید سفارش</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Tahoma','Arial',sans-serif; background:#f0f2f5; direction:rtl; padding:20px; }
.email-wrapper { max-width:600px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.08); }
.email-header { background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460); padding:35px 30px 25px; text-align:center; }
.email-header .logo { font-size:28px; font-weight:800; color:#ffffff; letter-spacing:2px; }
.email-header .logo span { color:#4fc3f7; }
.email-header .subtitle { color:rgba(255,255,255,0.7); font-size:14px; margin-top:6px; }
.email-header .badge-top { display:inline-block; background:rgba(79,195,247,0.2); color:#4fc3f7; padding:4px 18px; border-radius:20px; font-size:12px; font-weight:600; margin-top:10px; border:1px solid rgba(79,195,247,0.3); }
.email-body { padding:30px 28px; color:#1a1a2e; line-height:1.9; }
.email-body .greeting { font-size:22px; font-weight:700; margin-bottom:6px; }
.email-body .greeting span { background:linear-gradient(135deg,#4fc3f7,#7c3aed); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.email-body .intro { color:#4a4a6a; font-size:15px; margin-bottom:20px; }
.order-card { background:linear-gradient(135deg,#f8f9ff,#eef1ff); border-radius:16px; padding:20px 22px; margin:16px 0 20px; border-right:4px solid #4fc3f7; }
.order-card .order-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.06); }
.order-card .order-row:last-child { border-bottom:none; }
.order-card .order-label { color:#4a4a6a; font-size:14px; }
.order-card .order-value { font-weight:600; color:#1a1a2e; font-size:14px; }
.order-card .order-value.amount { color:#0f3460; font-size:18px; }
.status-badge-custom { display:inline-block; padding:4px 16px; border-radius:20px; font-size:13px; font-weight:600; background:#fef3c7; color:#d97706; }
.items-table { width:100%; border-collapse:collapse; font-size:14px; margin:12px 0; }
.items-table thead th { text-align:right; padding:10px 12px; background:#f0f2f5; color:#4a4a6a; font-weight:600; border-bottom:2px solid #e2e8f0; }
.items-table tbody td { padding:10px 12px; border-bottom:1px solid #f0f2f5; }
.items-table .total-row td { font-weight:700; border-top:2px solid #e2e8f0; padding-top:12px; }
.cashback-box { background:linear-gradient(135deg,#fef9e7,#fdf2d0); border-radius:12px; padding:14px 18px; margin:16px 0; border:1px solid #fcd34d; display:flex; align-items:center; gap:12px; }
.cashback-box .icon { font-size:28px; }
.cashback-box .text { font-size:14px; color:#78350f; }
.cashback-box .text strong { font-size:18px; color:#b45309; }
.btn-custom { display:inline-block; padding:14px 34px; background:linear-gradient(135deg,#0f3460,#7c3aed); color:#ffffff !important; text-decoration:none; border-radius:12px; font-weight:700; font-size:15px; margin:16px 0 8px; box-shadow:0 4px 16px rgba(124,58,237,0.35); }
.btn-custom:hover { transform:translateY(-3px); box-shadow:0 8px 28px rgba(124,58,237,0.45); }
.btn-custom-secondary { display:inline-block; padding:12px 28px; background:transparent; color:#0f3460 !important; text-decoration:none; border-radius:12px; font-weight:600; font-size:14px; border:2px solid #e2e8f0; margin:6px 8px 6px 0; }
.btn-custom-secondary:hover { border-color:#0f3460; background:#f8f9ff; }
.text-center { text-align:center; }
.email-footer { background:#f8f9ff; padding:24px 28px; text-align:center; border-top:1px solid #eef1ff; }
.email-footer .copyright { color:#94a3b8; font-size:13px; line-height:1.8; }
.email-footer .copyright a { color:#0f3460; text-decoration:none; font-weight:600; }
@media (max-width:480px) {
  .email-body { padding:20px 16px; }
  .email-header { padding:25px 16px 20px; }
  .email-header .logo { font-size:22px; }
  .order-card .order-row { flex-direction:column; gap:2px; }
  .btn-custom { padding:12px 24px; font-size:14px; display:block; text-align:center; }
  .btn-custom-secondary { display:block; text-align:center; margin:6px 0; }
}
</style>
</head>
<body>
<div class="email-wrapper">
<div class="email-header">
<div class="logo">🛍️ تاک<span>دارو</span></div>
<div class="subtitle">مرکز تخصصی مکمل‌های ورزشی</div>
<div class="badge-top">✅ تأیید سفارش</div>
</div>
<div class="email-body">
<div class="greeting">سلام <span>{customer_name}</span> 👋</div>
<p class="intro">سفارش شما با موفقیت ثبت شد و در حال پردازش است. جزئیات سفارش به شرح زیر است:</p>
<div class="order-card">
<div class="order-row"><span class="order-label">📋 شماره سفارش</span><span class="order-value">#{order_number}</span></div>
<div class="order-row"><span class="order-label">📅 تاریخ ثبت</span><span class="order-value">{order_date}</span></div>
<div class="order-row"><span class="order-label">💰 مبلغ کل</span><span class="order-value amount">{amount} تومان</span></div>
<div class="order-row"><span class="order-label">📌 وضعیت</span><span class="order-value"><span class="status-badge-custom">{order_status}</span></span></div>
</div>
<h3 style="margin:16px 0 8px;">📦 اقلام سفارش</h3>
<table class="items-table">
<thead><tr><th>محصول</th><th style="text-align:center;">تعداد</th><th style="text-align:left;">قیمت</th></tr></thead>
<tbody>{items_list}</tbody>
</table>
<div class="cashback-box">
<span class="icon">🎁</span>
<div class="text"><strong>{cashback_amount} تومان</strong> کش‌بک به کیف پول شما اضافه خواهد شد<br><span style="font-size:13px;color:#92400e;">(پس از تکمیل سفارش)</span></div>
</div>
<div class="text-center">
<a href="{site_url}/invoice.html?order={order_number}" class="btn-custom">🔍 مشاهده جزئیات سفارش</a><br>
<a href="{site_url}/account.html" class="btn-custom-secondary">👤 ورود به حساب کاربری</a>
<a href="{site_url}/contact.html" class="btn-custom-secondary">📞 تماس با پشتیبانی</a>
</div>
<p style="color:#94a3b8;font-size:14px;margin-top:20px;text-align:center;">💡 در صورت نیاز به راهنمایی، با پشتیبانی تماس بگیرید.</p>
</div>
<div class="email-footer">
<div class="copyright">© {year} تاکدارو - تمامی حقوق محفوظ است.<br><a href="{site_url}">{site_url}</a></div>
</div>
</div>
</body>
</html>`,
    is_enabled: true
  },

  payment_success: {
    title: 'پرداخت موفق',
    subject: '💳 پرداخت سفارش #{order_number} با موفقیت انجام شد | تاکدارو',
    body: `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>پرداخت موفق</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Tahoma','Arial',sans-serif; background:#f0f2f5; direction:rtl; padding:20px; }
.email-wrapper { max-width:600px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.08); }
.email-header { background:linear-gradient(135deg,#065f46,#047857,#059669); padding:35px 30px 25px; text-align:center; }
.email-header .logo { font-size:28px; font-weight:800; color:#ffffff; letter-spacing:2px; }
.email-header .logo span { color:#6ee7b7; }
.email-header .subtitle { color:rgba(255,255,255,0.7); font-size:14px; margin-top:6px; }
.email-header .badge-top { display:inline-block; background:rgba(110,231,183,0.2); color:#6ee7b7; padding:4px 18px; border-radius:20px; font-size:12px; font-weight:600; margin-top:10px; border:1px solid rgba(110,231,183,0.3); }
.email-body { padding:30px 28px; color:#1a1a2e; line-height:1.9; }
.email-body .greeting { font-size:22px; font-weight:700; margin-bottom:6px; }
.email-body .greeting span { background:linear-gradient(135deg,#059669,#10b981); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.email-body .intro { color:#4a4a6a; font-size:15px; margin-bottom:20px; }
.order-card { background:linear-gradient(135deg,#ecfdf5,#d1fae5); border-radius:16px; padding:20px 22px; margin:16px 0 20px; border-right:4px solid #10b981; }
.order-card .order-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.06); }
.order-card .order-row:last-child { border-bottom:none; }
.order-card .order-label { color:#4a4a6a; font-size:14px; }
.order-card .order-value { font-weight:600; color:#1a1a2e; font-size:14px; }
.order-card .order-value.amount { color:#065f46; font-size:18px; }
.status-badge-custom { display:inline-block; padding:4px 16px; border-radius:20px; font-size:13px; font-weight:600; background:#dcfce7; color:#16a34a; }
.btn-custom { display:inline-block; padding:14px 34px; background:linear-gradient(135deg,#065f46,#059669); color:#ffffff !important; text-decoration:none; border-radius:12px; font-weight:700; font-size:15px; margin:16px 0 8px; box-shadow:0 4px 16px rgba(5,150,105,0.35); }
.btn-custom:hover { transform:translateY(-3px); box-shadow:0 8px 28px rgba(5,150,105,0.45); }
.btn-custom-secondary { display:inline-block; padding:12px 28px; background:transparent; color:#065f46 !important; text-decoration:none; border-radius:12px; font-weight:600; font-size:14px; border:2px solid #e2e8f0; margin:6px 8px 6px 0; }
.btn-custom-secondary:hover { border-color:#065f46; background:#ecfdf5; }
.text-center { text-align:center; }
.email-footer { background:#f8f9ff; padding:24px 28px; text-align:center; border-top:1px solid #eef1ff; }
.email-footer .copyright { color:#94a3b8; font-size:13px; line-height:1.8; }
.email-footer .copyright a { color:#065f46; text-decoration:none; font-weight:600; }
.success-animation { text-align:center; margin:10px 0; }
.success-animation .check { font-size:56px; display:block; }
@media (max-width:480px) {
  .email-body { padding:20px 16px; }
  .email-header { padding:25px 16px 20px; }
  .email-header .logo { font-size:22px; }
  .order-card .order-row { flex-direction:column; gap:2px; }
  .btn-custom { padding:12px 24px; font-size:14px; display:block; text-align:center; }
  .btn-custom-secondary { display:block; text-align:center; margin:6px 0; }
}
</style>
</head>
<body>
<div class="email-wrapper">
<div class="email-header">
<div class="logo">🛍️ تاک<span>دارو</span></div>
<div class="subtitle">مرکز تخصصی مکمل‌های ورزشی</div>
<div class="badge-top">✅ پرداخت موفق</div>
</div>
<div class="email-body">
<div class="success-animation"><span class="check">✅</span></div>
<div class="greeting">سلام <span>{customer_name}</span> 🎉</div>
<p class="intro">پرداخت سفارش <strong>#{order_number}</strong> با موفقیت انجام شد. سفارش شما در حال پردازش است و به‌زودی ارسال خواهد شد.</p>
<div class="order-card">
<div class="order-row"><span class="order-label">📋 شماره سفارش</span><span class="order-value">#{order_number}</span></div>
<div class="order-row"><span class="order-label">💰 مبلغ پرداخت</span><span class="order-value amount">{amount} تومان</span></div>
<div class="order-row"><span class="order-label">📌 وضعیت</span><span class="order-value"><span class="status-badge-custom">{order_status}</span></span></div>
</div>
<div class="text-center">
<a href="{site_url}/invoice.html?order={order_number}" class="btn-custom">🔍 پیگیری سفارش</a><br>
<a href="{site_url}/account.html" class="btn-custom-secondary">👤 حساب کاربری</a>
</div>
</div>
<div class="email-footer">
<div class="copyright">© {year} تاکدارو - تمامی حقوق محفوظ است.<br><a href="{site_url}">{site_url}</a></div>
</div>
</div>
</body>
</html>`,
    is_enabled: true
  },

  order_status_changed: {
    title: 'تغییر وضعیت سفارش',
    subject: '🔄 وضعیت سفارش #{order_number} به {order_status} تغییر کرد | تاکدارو',
    body: `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تغییر وضعیت</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Tahoma','Arial',sans-serif; background:#f0f2f5; direction:rtl; padding:20px; }
.email-wrapper { max-width:600px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.08); }
.email-header { background:linear-gradient(135deg,#1e293b,#334155,#475569); padding:35px 30px 25px; text-align:center; }
.email-header .logo { font-size:28px; font-weight:800; color:#ffffff; letter-spacing:2px; }
.email-header .logo span { color:#94a3b8; }
.email-header .subtitle { color:rgba(255,255,255,0.7); font-size:14px; margin-top:6px; }
.email-header .badge-top { display:inline-block; background:rgba(148,163,184,0.2); color:#94a3b8; padding:4px 18px; border-radius:20px; font-size:12px; font-weight:600; margin-top:10px; border:1px solid rgba(148,163,184,0.3); }
.email-body { padding:30px 28px; color:#1a1a2e; line-height:1.9; }
.email-body .greeting { font-size:22px; font-weight:700; margin-bottom:6px; }
.email-body .greeting span { color:#475569; }
.email-body .intro { color:#4a4a6a; font-size:15px; margin-bottom:20px; }
.order-card { background:linear-gradient(135deg,#f1f5f9,#e2e8f0); border-radius:16px; padding:20px 22px; margin:16px 0 20px; border-right:4px solid #64748b; }
.order-card .order-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.06); }
.order-card .order-row:last-child { border-bottom:none; }
.order-card .order-label { color:#4a4a6a; font-size:14px; }
.order-card .order-value { font-weight:600; color:#1a1a2e; font-size:14px; }
.status-badge-custom { display:inline-block; padding:4px 16px; border-radius:20px; font-size:13px; font-weight:600; background:#dbeafe; color:#2563eb; }
.tracking-box { background:#f8fafc; border-radius:10px; padding:12px 18px; margin:12px 0; border:1px dashed #94a3b8; text-align:center; }
.tracking-box .code { font-size:22px; font-weight:800; color:#1e293b; letter-spacing:2px; }
.btn-custom { display:inline-block; padding:14px 34px; background:linear-gradient(135deg,#1e293b,#475569); color:#ffffff !important; text-decoration:none; border-radius:12px; font-weight:700; font-size:15px; margin:16px 0 8px; box-shadow:0 4px 16px rgba(71,85,105,0.35); }
.btn-custom:hover { transform:translateY(-3px); box-shadow:0 8px 28px rgba(71,85,105,0.45); }
.text-center { text-align:center; }
.email-footer { background:#f8f9ff; padding:24px 28px; text-align:center; border-top:1px solid #eef1ff; }
.email-footer .copyright { color:#94a3b8; font-size:13px; line-height:1.8; }
.email-footer .copyright a { color:#1e293b; text-decoration:none; font-weight:600; }
@media (max-width:480px) {
  .email-body { padding:20px 16px; }
  .email-header { padding:25px 16px 20px; }
  .email-header .logo { font-size:22px; }
  .order-card .order-row { flex-direction:column; gap:2px; }
  .btn-custom { padding:12px 24px; font-size:14px; display:block; text-align:center; }
}
</style>
</head>
<body>
<div class="email-wrapper">
<div class="email-header">
<div class="logo">🛍️ تاک<span>دارو</span></div>
<div class="subtitle">مرکز تخصصی مکمل‌های ورزشی</div>
<div class="badge-top">🔄 به‌روزرسانی وضعیت</div>
</div>
<div class="email-body">
<div class="greeting">سلام <span>{customer_name}</span></div>
<p class="intro">وضعیت سفارش <strong>#{order_number}</strong> تغییر کرد.</p>
<div class="order-card">
<div class="order-row"><span class="order-label">📋 شماره سفارش</span><span class="order-value">#{order_number}</span></div>
<div class="order-row"><span class="order-label">🔄 وضعیت جدید</span><span class="order-value"><span class="status-badge-custom">{order_status}</span></span></div>
</div>
<div class="tracking-box"><div style="font-size:13px;color:#64748b;">📮 کد رهگیری</div><div class="code">{tracking_code}</div></div>
<div class="text-center"><a href="{site_url}/invoice.html?order={order_number}" class="btn-custom">🔍 پیگیری سفارش</a></div>
</div>
<div class="email-footer">
<div class="copyright">© {year} تاکدارو - تمامی حقوق محفوظ است.<br><a href="{site_url}">{site_url}</a></div>
</div>
</div>
</body>
</html>`,
    is_enabled: true
  },

  order_cancelled: {
    title: 'لغو سفارش',
    subject: '❌ سفارش #{order_number} لغو شد | تاکدارو',
    body: `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>لغو سفارش</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Tahoma','Arial',sans-serif; background:#f0f2f5; direction:rtl; padding:20px; }
.email-wrapper { max-width:600px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.08); }
.email-header { background:linear-gradient(135deg,#7f1d1d,#991b1b,#b91c1c); padding:35px 30px 25px; text-align:center; }
.email-header .logo { font-size:28px; font-weight:800; color:#ffffff; letter-spacing:2px; }
.email-header .logo span { color:#fca5a5; }
.email-header .subtitle { color:rgba(255,255,255,0.7); font-size:14px; margin-top:6px; }
.email-header .badge-top { display:inline-block; background:rgba(252,165,165,0.2); color:#fca5a5; padding:4px 18px; border-radius:20px; font-size:12px; font-weight:600; margin-top:10px; border:1px solid rgba(252,165,165,0.3); }
.email-body { padding:30px 28px; color:#1a1a2e; line-height:1.9; }
.email-body .greeting { font-size:22px; font-weight:700; margin-bottom:6px; }
.email-body .greeting span { color:#991b1b; }
.email-body .intro { color:#4a4a6a; font-size:15px; margin-bottom:20px; }
.order-card { background:linear-gradient(135deg,#fef2f2,#fee2e2); border-radius:16px; padding:20px 22px; margin:16px 0 20px; border-right:4px solid #dc2626; }
.order-card .order-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.06); }
.order-card .order-row:last-child { border-bottom:none; }
.order-card .order-label { color:#4a4a6a; font-size:14px; }
.order-card .order-value { font-weight:600; color:#1a1a2e; font-size:14px; }
.status-badge-custom { display:inline-block; padding:4px 16px; border-radius:20px; font-size:13px; font-weight:600; background:#fee2e2; color:#dc2626; }
.btn-custom { display:inline-block; padding:14px 34px; background:linear-gradient(135deg,#7f1d1d,#b91c1c); color:#ffffff !important; text-decoration:none; border-radius:12px; font-weight:700; font-size:15px; margin:16px 0 8px; box-shadow:0 4px 16px rgba(185,28,28,0.35); }
.btn-custom:hover { transform:translateY(-3px); box-shadow:0 8px 28px rgba(185,28,28,0.45); }
.text-center { text-align:center; }
.email-footer { background:#f8f9ff; padding:24px 28px; text-align:center; border-top:1px solid #eef1ff; }
.email-footer .copyright { color:#94a3b8; font-size:13px; line-height:1.8; }
.email-footer .copyright a { color:#7f1d1d; text-decoration:none; font-weight:600; }
@media (max-width:480px) {
  .email-body { padding:20px 16px; }
  .email-header { padding:25px 16px 20px; }
  .email-header .logo { font-size:22px; }
  .order-card .order-row { flex-direction:column; gap:2px; }
  .btn-custom { padding:12px 24px; font-size:14px; display:block; text-align:center; }
}
</style>
</head>
<body>
<div class="email-wrapper">
<div class="email-header">
<div class="logo">🛍️ تاک<span>دارو</span></div>
<div class="subtitle">مرکز تخصصی مکمل‌های ورزشی</div>
<div class="badge-top">❌ لغو سفارش</div>
</div>
<div class="email-body">
<div class="greeting">سلام <span>{customer_name}</span></div>
<p class="intro">سفارش <strong>#{order_number}</strong> لغو شد.</p>
<div class="order-card">
<div class="order-row"><span class="order-label">📋 شماره سفارش</span><span class="order-value">#{order_number}</span></div>
<div class="order-row"><span class="order-label">💰 مبلغ</span><span class="order-value">{amount} تومان</span></div>
<div class="order-row"><span class="order-label">📌 وضعیت</span><span class="order-value"><span class="status-badge-custom">{order_status}</span></span></div>
</div>
<div class="text-center">
<a href="{site_url}/account.html" class="btn-custom">👤 ورود به حساب کاربری</a>
</div>
<p style="color:#94a3b8;font-size:14px;margin-top:20px;text-align:center;">در صورت نیاز با پشتیبانی تماس بگیرید.</p>
</div>
<div class="email-footer">
<div class="copyright">© {year} تاکدارو - تمامی حقوق محفوظ است.<br><a href="{site_url}">{site_url}</a></div>
</div>
</div>
</body>
</html>`,
    is_enabled: true
  },

  wallet_credit: {
    title: 'افزایش موجودی کیف پول',
    subject: '💰 افزایش موجودی کیف پول | تاکدارو',
    body: `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>افزایش موجودی</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Tahoma','Arial',sans-serif; background:#f0f2f5; direction:rtl; padding:20px; }
.email-wrapper { max-width:600px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.08); }
.email-header { background:linear-gradient(135deg,#0f3460,#1a1a6e); padding:35px 30px 25px; text-align:center; }
.email-header .logo { font-size:28px; font-weight:800; color:#ffffff; letter-spacing:2px; }
.email-header .logo span { color:#60a5fa; }
.email-header .subtitle { color:rgba(255,255,255,0.7); font-size:14px; margin-top:6px; }
.email-header .badge-top { display:inline-block; background:rgba(96,165,250,0.2); color:#60a5fa; padding:4px 18px; border-radius:20px; font-size:12px; font-weight:600; margin-top:10px; border:1px solid rgba(96,165,250,0.3); }
.email-body { padding:30px 28px; color:#1a1a2e; line-height:1.9; }
.email-body .greeting { font-size:22px; font-weight:700; margin-bottom:6px; }
.email-body .greeting span { color:#1a1a6e; }
.email-body .intro { color:#4a4a6a; font-size:15px; margin-bottom:20px; }
.order-card { background:linear-gradient(135deg,#eff6ff,#dbeafe); border-radius:16px; padding:20px 22px; margin:16px 0 20px; border-right:4px solid #3b82f6; }
.order-card .order-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.06); }
.order-card .order-row:last-child { border-bottom:none; }
.order-card .order-label { color:#4a4a6a; font-size:14px; }
.order-card .order-value { font-weight:600; color:#1a1a2e; font-size:14px; }
.order-card .order-value.amount { color:#0f3460; font-size:18px; }
.btn-custom { display:inline-block; padding:14px 34px; background:linear-gradient(135deg,#0f3460,#1a1a6e); color:#ffffff !important; text-decoration:none; border-radius:12px; font-weight:700; font-size:15px; margin:16px 0 8px; box-shadow:0 4px 16px rgba(26,26,110,0.35); }
.btn-custom:hover { transform:translateY(-3px); box-shadow:0 8px 28px rgba(26,26,110,0.45); }
.text-center { text-align:center; }
.email-footer { background:#f8f9ff; padding:24px 28px; text-align:center; border-top:1px solid #eef1ff; }
.email-footer .copyright { color:#94a3b8; font-size:13px; line-height:1.8; }
.email-footer .copyright a { color:#0f3460; text-decoration:none; font-weight:600; }
@media (max-width:480px) {
  .email-body { padding:20px 16px; }
  .email-header { padding:25px 16px 20px; }
  .email-header .logo { font-size:22px; }
  .order-card .order-row { flex-direction:column; gap:2px; }
  .btn-custom { padding:12px 24px; font-size:14px; display:block; text-align:center; }
}
</style>
</head>
<body>
<div class="email-wrapper">
<div class="email-header">
<div class="logo">🛍️ تاک<span>دارو</span></div>
<div class="subtitle">مرکز تخصصی مکمل‌های ورزشی</div>
<div class="badge-top">💰 افزایش موجودی</div>
</div>
<div class="email-body">
<div class="greeting">سلام <span>{customer_name}</span></div>
<p class="intro">موجودی کیف پول شما افزایش یافت.</p>
<div class="order-card">
<div class="order-row"><span class="order-label">💰 مبلغ افزایش</span><span class="order-value amount">+{amount} تومان</span></div>
<div class="order-row"><span class="order-label">👛 موجودی فعلی</span><span class="order-value">{wallet_balance} تومان</span></div>
<div class="order-row"><span class="order-label">📋 توضیحات</span><span class="order-value">{wallet_note}</span></div>
</div>
<div class="text-center">
<a href="{site_url}/account.html?tab=wallet" class="btn-custom">👛 مشاهده کیف پول</a>
</div>
</div>
<div class="email-footer">
<div class="copyright">© {year} تاکدارو - تمامی حقوق محفوظ است.<br><a href="{site_url}">{site_url}</a></div>
</div>
</div>
</body>
</html>`,
    is_enabled: true
  },

  wallet_debit: {
    title: 'کاهش موجودی کیف پول',
    subject: '💸 کاهش موجودی کیف پول | تاکدارو',
    body: `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>کاهش موجودی</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Tahoma','Arial',sans-serif; background:#f0f2f5; direction:rtl; padding:20px; }
.email-wrapper { max-width:600px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.08); }
.email-header { background:linear-gradient(135deg,#7f1d1d,#991b1b); padding:35px 30px 25px; text-align:center; }
.email-header .logo { font-size:28px; font-weight:800; color:#ffffff; letter-spacing:2px; }
.email-header .logo span { color:#fca5a5; }
.email-header .subtitle { color:rgba(255,255,255,0.7); font-size:14px; margin-top:6px; }
.email-header .badge-top { display:inline-block; background:rgba(252,165,165,0.2); color:#fca5a5; padding:4px 18px; border-radius:20px; font-size:12px; font-weight:600; margin-top:10px; border:1px solid rgba(252,165,165,0.3); }
.email-body { padding:30px 28px; color:#1a1a2e; line-height:1.9; }
.email-body .greeting { font-size:22px; font-weight:700; margin-bottom:6px; }
.email-body .greeting span { color:#991b1b; }
.email-body .intro { color:#4a4a6a; font-size:15px; margin-bottom:20px; }
.order-card { background:linear-gradient(135deg,#fef2f2,#fee2e2); border-radius:16px; padding:20px 22px; margin:16px 0 20px; border-right:4px solid #dc2626; }
.order-card .order-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed rgba(0,0,0,0.06); }
.order-card .order-row:last-child { border-bottom:none; }
.order-card .order-label { color:#4a4a6a; font-size:14px; }
.order-card .order-value { font-weight:600; color:#1a1a2e; font-size:14px; }
.order-card .order-value.amount { color:#991b1b; font-size:18px; }
.btn-custom { display:inline-block; padding:14px 34px; background:linear-gradient(135deg,#7f1d1d,#991b1b); color:#ffffff !important; text-decoration:none; border-radius:12px; font-weight:700; font-size:15px; margin:16px 0 8px; box-shadow:0 4px 16px rgba(153,27,27,0.35); }
.btn-custom:hover { transform:translateY(-3px); box-shadow:0 8px 28px rgba(153,27,27,0.45); }
.text-center { text-align:center; }
.email-footer { background:#f8f9ff; padding:24px 28px; text-align:center; border-top:1px solid #eef1ff; }
.email-footer .copyright { color:#94a3b8; font-size:13px; line-height:1.8; }
.email-footer .copyright a { color:#7f1d1d; text-decoration:none; font-weight:600; }
@media (max-width:480px) {
  .email-body { padding:20px 16px; }
  .email-header { padding:25px 16px 20px; }
  .email-header .logo { font-size:22px; }
  .order-card .order-row { flex-direction:column; gap:2px; }
  .btn-custom { padding:12px 24px; font-size:14px; display:block; text-align:center; }
}
</style>
</head>
<body>
<div class="email-wrapper">
<div class="email-header">
<div class="logo">🛍️ تاک<span>دارو</span></div>
<div class="subtitle">مرکز تخصصی مکمل‌های ورزشی</div>
<div class="badge-top">💸 کاهش موجودی</div>
</div>
<div class="email-body">
<div class="greeting">سلام <span>{customer_name}</span></div>
<p class="intro">موجودی کیف پول شما کاهش یافت.</p>
<div class="order-card">
<div class="order-row"><span class="order-label">💰 مبلغ کاهش</span><span class="order-value amount">-{amount} تومان</span></div>
<div class="order-row"><span class="order-label">👛 موجودی فعلی</span><span class="order-value">{wallet_balance} تومان</span></div>
<div class="order-row"><span class="order-label">📋 توضیحات</span><span class="order-value">{wallet_note}</span></div>
</div>
<div class="text-center">
<a href="{site_url}/account.html?tab=wallet" class="btn-custom">👛 مشاهده کیف پول</a>
</div>
</div>
<div class="email-footer">
<div class="copyright">© {year} تاکدارو - تمامی حقوق محفوظ است.<br><a href="{site_url}">{site_url}</a></div>
</div>
</div>
</body>
</html>`,
    is_enabled: true
  }
};

// ============================================
// تابع پر کردن Template‌های پیش‌فرض
// ============================================

async function seedDefaultEmailTemplates(env, userId = null) {
  try {
    const settings = await getEmailSettings(env);
    
    if (!settings.config.templates) {
      settings.config.templates = {};
    }

    let addedCount = 0;
    let updatedCount = 0;

    for (const [eventType, template] of Object.entries(DEFAULT_EMAIL_TEMPLATES)) {
      const existing = settings.config.templates[eventType];
      
      if (!existing) {
        settings.config.templates[eventType] = {
          title: template.title,
          subject: template.subject,
          body: template.body,
          is_enabled: template.is_enabled,
          updated_at: new Date().toISOString()
        };
        addedCount++;
      } else if (!existing.body || existing.body.length < 50) {
        settings.config.templates[eventType] = {
          ...existing,
          title: existing.title || template.title,
          subject: existing.subject || template.subject,
          body: existing.body || template.body,
          is_enabled: existing.is_enabled !== undefined ? existing.is_enabled : template.is_enabled,
          updated_at: new Date().toISOString()
        };
        updatedCount++;
      }
    }

    await saveEmailSettings(env, settings.config, userId || 1);

    return {
      success: true,
      added: addedCount,
      updated: updatedCount,
      total: Object.keys(settings.config.templates).length
    };
  } catch (error) {
    console.error('❌ seedDefaultEmailTemplates error:', error);
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}

// ============================================
// توابع رندر Template
// ============================================

export function renderEmailTemplate(template, data) {
  if (!template) return { subject: '', body: '' };

  let subject = template.subject || '';
  let body = template.body || '';

  const variables = {
    '{customer_name}': data.customer_name || '',
    '{customer_phone}': data.customer_phone || '',
    '{order_number}': data.order_number || '',
    '{amount}': formatPersianAmount(data.amount),
    '{payment_status}': data.payment_status || '',
    '{order_status}': getPersianOrderStatus(data.order_status),
    '{tracking_code}': data.tracking_code || '',
    '{order_date}': formatPersianDate(data.order_date || new Date().toISOString()),
    '{wallet_transaction_type}': data.wallet_transaction_type || '',
    '{wallet_balance_before}': formatPersianAmount(data.wallet_balance_before),
    '{wallet_balance_after}': formatPersianAmount(data.wallet_balance_after),
    '{wallet_balance}': formatPersianAmount(data.wallet_balance),
    '{wallet_note}': data.wallet_note || '',
    '{transaction_date}': formatPersianDate(data.transaction_date || new Date().toISOString()),
    '{items_list}': data.items_list || '',
    '{cashback_amount}': formatPersianAmount(data.cashback_amount || 0),
    '{year}': new Date().getFullYear()
  };

  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replace(new RegExp(key, 'g'), value);
    body = body.replace(new RegExp(key, 'g'), value);
  }

  return { subject, body };
}

export async function getAndRenderEmailTemplate(env, eventType, data) {
  const template = await getEmailTemplate(env, eventType);

  if (!template) {
    return {
      template: null,
      rendered: null,
      isEnabled: false,
      error: `Template برای رویداد ${eventType} یافت نشد`
    };
  }

  const rendered = renderEmailTemplate(template, data);

  return {
    template: template,
    rendered: rendered,
    isEnabled: template.is_enabled !== false
  };
}

// ============================================
// تابع اصلی ارسال Email با Resend API
// ============================================

export async function sendEmail(env, data) {
  const { to, subject, html, from, fromName, replyTo } = data;

  if (!to || !subject || !html) {
    throw new Error('to, subject و html الزامی هستند.');
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY در Environment Variables تنظیم نشده است.');
  }

  const senderEmail = from || 'noreply@takdaro.com';
  const senderName = fromName || 'تاکدارو';

  const payload = {
    from: `${senderName} <${senderEmail}>`,
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: html,
    reply_to: replyTo || senderEmail
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || !result.id) {
      throw new Error(result.message || 'ارسال ایمیل انجام نشد.');
    }

    return {
      success: true,
      messageId: result.id,
      to: to,
      subject: subject
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}

// ============================================
// توابع ارسال Email با Template
// ============================================

export async function sendEmailWithTemplate(env, data) {
  const { eventType, recipient, data: templateData, from, fromName, referenceId = null, referenceType = 'order', userId = null, isUserNotification = true } = data;

  if (!eventType || !recipient) {
    throw new Error('eventType و recipient الزامی هستند.');
  }

  const settings = await getEmailSettings(env);
  if (!settings.is_enabled) {
    return { success: false, error: 'کانال Email غیرفعال است.' };
  }

  const result = await getAndRenderEmailTemplate(env, eventType, templateData);
  if (!result.template) {
    return { success: false, error: result.error || 'Template یافت نشد' };
  }

  if (!result.isEnabled) {
    return { success: false, error: `Template برای رویداد ${eventType} غیرفعال است` };
  }

  const senderEmail = from || settings.config.sender_email || 'noreply@takdaro.com';
  const senderName = fromName || settings.config.sender_name || 'تاکدارو';

  const htmlBody = buildEmailHtml(result.rendered.body, templateData);

  const sendResult = await sendEmail(env, {
    to: recipient,
    subject: result.rendered.subject,
    html: htmlBody,
    from: senderEmail,
    fromName: senderName
  });

  await logEmailNotification(env, {
    eventType: eventType,
    recipient: recipient,
    subject: result.rendered.subject,
    content: htmlBody,
    status: sendResult.success ? 'sent' : 'failed',
    errorMessage: sendResult.error || null,
    referenceId: referenceId,
    userId: userId,
    isUserNotification: isUserNotification
  });

  return {
    success: sendResult.success,
    messageId: sendResult.messageId,
    template: result.template,
    rendered: result.rendered,
    error: sendResult.error || null
  };
}

// ============================================
// ساخت HTML کامل Email
// ============================================

function buildEmailHtml(bodyContent, data = {}) {
  const siteName = 'تاکدارو';
  const siteUrl = data.site_url || 'https://takdaro-site.pages.dev';

  return `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${siteName}</title>
  <style>
    body { font-family: 'Tahoma', 'Arial', sans-serif; margin: 0; padding: 0; background-color: #f9fafb; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #e5e7eb; }
    .header h1 { margin: 0; color: #1f2937; font-size: 24px; }
    .content { padding: 30px 0; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .order-details { background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th { background-color: #f3f4f6; padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; }
    td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
    .total-row { font-weight: bold; background-color: #f9fafb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${siteName}</h1>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>این ایمیل به صورت خودکار ارسال شده است. لطفاً به آن پاسخ ندهید.</p>
      <p>© ${new Date().getFullYear()} ${siteName} - تمامی حقوق محفوظ است.</p>
      <p><a href="${siteUrl}" style="color:#2563eb;">${siteUrl}</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

// ============================================
// توابع لاگ‌گیری Email
// ============================================

export async function logEmailNotification(env, data) {
  const db = getDb(env);

  const { eventType, recipient, subject, content, status, errorMessage, referenceId, userId, isUserNotification } = data;

  try {
    const result = await db
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
        VALUES (?, 'email', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        eventType || 'unknown',
        recipient || null,
        subject || null,
        content || null,
        status || 'pending',
        errorMessage || null,
        referenceId || null,
        userId || null,
        isUserNotification ? 1 : 0
      )
      .run();

    return result.meta?.last_row_id || null;
  } catch (error) {
    console.error('❌ logEmailNotification error:', error);
    return null;
  }
}

// ============================================
// توابع ارسال Email به کاربر و ادمین
// ============================================

export async function sendUserEmailNotification(env, userId, eventType, orderData, userData, items = [], baseUrl = '') {
  try {
    const userEmail = userData.email;
    if (!userEmail) {
      return { success: false, error: 'کاربر ایمیل ندارد.' };
    }

    const itemsHtml = buildItemsHtml(items);

    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || 'pending',
      order_status: orderData.status || 'payment_pending',
      tracking_code: orderData.trackingCode || '',
      order_date: orderData.createdAt || new Date().toISOString(),
      items_list: itemsHtml,
      cashback_amount: orderData.cashbackAmount || 0,
      site_url: baseUrl || ''
    };

    return await sendEmailWithTemplate(env, {
      eventType: eventType,
      recipient: userEmail,
      data: templateData,
      referenceId: orderData.orderId || null,
      referenceType: 'order',
      userId: userId,
      isUserNotification: true
    });
  } catch (error) {
    return { success: false, error: String(error?.message || error) };
  }
}

export async function sendAdminEmailNotification(env, eventType, orderData, userData, items = [], baseUrl = '') {
  try {
    const settings = await getEmailSettings(env);
    const adminEmail = settings.config.admin_email || '';

    const adminRecipient = adminEmail || 'admin@takdaro.com';

    const itemsHtml = buildItemsHtml(items);

    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      order_number: orderData.orderNumber || '',
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || 'pending',
      order_status: orderData.status || 'payment_pending',
      tracking_code: orderData.trackingCode || '',
      order_date: orderData.createdAt || new Date().toISOString(),
      items_list: itemsHtml,
      cashback_amount: orderData.cashbackAmount || 0,
      site_url: baseUrl || ''
    };

    return await sendEmailWithTemplate(env, {
      eventType: eventType,
      recipient: adminRecipient,
      data: templateData,
      referenceId: orderData.orderId || null,
      referenceType: 'order',
      userId: null,
      isUserNotification: false
    });
  } catch (error) {
    return { success: false, error: String(error?.message || error) };
  }
}

export async function sendWalletEmailNotification(env, userId, eventType, userData, transactionData) {
  try {
    const userEmail = userData.email;
    if (!userEmail) {
      return { success: false, error: 'کاربر ایمیل ندارد.' };
    }

    const templateData = {
      customer_name: userData.fullName || '',
      customer_phone: userData.phone || '',
      amount: transactionData.amount || 0,
      wallet_transaction_type: transactionData.type || '',
      wallet_balance_before: transactionData.balance_before || 0,
      wallet_balance_after: transactionData.balance_after || 0,
      wallet_balance: transactionData.balance_after || 0,
      wallet_note: transactionData.note || '',
      transaction_date: transactionData.created_at || new Date().toISOString()
    };

    return await sendEmailWithTemplate(env, {
      eventType: eventType,
      recipient: userEmail,
      data: templateData,
      referenceId: transactionData.id || null,
      referenceType: 'wallet',
      userId: userId,
      isUserNotification: true
    });
  } catch (error) {
    return { success: false, error: String(error?.message || error) };
  }
}

// ============================================
// تابع تست ارسال Email
// ============================================

export async function testEmailNotification(env, recipient, userId) {
  try {
    const settings = await getEmailSettings(env);
    if (!settings.is_enabled) {
      return { success: false, error: 'کانال Email غیرفعال است.' };
    }

    const senderEmail = settings.config.sender_email || 'noreply@takdaro.com';
    const senderName = settings.config.sender_name || 'تاکدارو';

    const testHtml = `
      <h2>🔔 پیام آزمایشی</h2>
      <p>✅ اتصال به سیستم Email با موفقیت برقرار شد.</p>
      <p>🕐 زمان: ${new Date().toLocaleString('fa-IR')}</p>
      <p>📌 این پیام از پنل مدیریت ارسال شده است.</p>
      <hr>
      <p style="color:#6b7280;font-size:12px;">تاکدارو - سیستم مدیریت فروش</p>
    `;

    const sendResult = await sendEmail(env, {
      to: recipient,
      subject: '🔔 پیام آزمایشی - تاکدارو',
      html: testHtml,
      from: senderEmail,
      fromName: senderName
    });

    await logEmailNotification(env, {
      eventType: 'test',
      recipient: recipient,
      subject: 'پیام آزمایشی Email',
      content: testHtml,
      status: sendResult.success ? 'sent' : 'failed',
      errorMessage: sendResult.error || null,
      referenceId: null,
      userId: userId,
      isUserNotification: true
    });

    return {
      success: sendResult.success,
      messageId: sendResult.messageId,
      error: sendResult.error || null
    };
  } catch (error) {
    return { success: false, error: String(error?.message || error) };
  }
}

// ============================================
// صادرات نهایی
// ============================================

export {
  buildItemsHtml,
  formatPersianAmount,
  formatPersianDate,
  getPersianOrderStatus,
  DEFAULT_EMAIL_TEMPLATES,
  seedDefaultEmailTemplates
};