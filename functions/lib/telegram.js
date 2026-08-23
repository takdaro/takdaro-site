// ============================================
// سرویس ارسال پیام به تلگرام
// ============================================

/**
 * ارسال پیام به تلگرام
 * @param {string} botToken - توکن ربات تلگرام
 * @param {string} chatId - شناسه چت (عدد یا @username)
 * @param {string} text - متن پیام
 * @param {Object} options - گزینه‌های اضافی
 * @param {Array} options.replyMarkup - دکمه‌های شیشه‌ای (Inline Keyboard)
 * @returns {Promise<Object>} - نتیجه ارسال
 */
export async function sendTelegramMessage(botToken, chatId, text, options = {}) {
  if (!botToken || !chatId || !text) {
    throw new Error('botToken, chatId و text الزامی هستند.');
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const payload = {
    chat_id: String(chatId),
    text: String(text),
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };

  if (options.replyMarkup && Array.isArray(options.replyMarkup) && options.replyMarkup.length > 0) {
    payload.reply_markup = {
      inline_keyboard: options.replyMarkup
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || 'ارسال پیام به تلگرام انجام نشد.');
    }

    return {
      success: true,
      result: data.result,
      message_id: data.result?.message_id
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}

/**
 * ارسال پیام آزمایشی برای تست اتصال
 * @param {string} botToken - توکن ربات
 * @param {string} chatId - شناسه چت
 * @returns {Promise<Object>} - نتیجه تست
 */
export async function testTelegramConnection(botToken, chatId) {
  const testMessage = '✅ اتصال به ربات تلگرام با موفقیت برقرار شد.\n\n⏰ زمان: ' + new Date().toLocaleString('fa-IR');

  return sendTelegramMessage(botToken, chatId, testMessage);
}

/**
 * دریافت اطلاعات ربات از API تلگرام
 * @param {string} botToken - توکن ربات
 * @returns {Promise<Object>} - اطلاعات ربات
 */
export async function getTelegramBotInfo(botToken) {
  if (!botToken) {
    throw new Error('botToken الزامی است.');
  }

  const url = `https://api.telegram.org/bot${botToken}/getMe`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.description || 'دریافت اطلاعات ربات انجام نشد.');
    }

    return {
      success: true,
      bot: data.result
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}

/**
 * ساخت دکمه مشاهده سفارش
 * @param {string} orderNumber - شماره سفارش
 * @param {string} baseUrl - آدرس پایه سایت
 * @returns {Array} - آرایه دکمه‌های شیشه‌ای
 */
export function createOrderViewButton(orderNumber, baseUrl = '') {
  const siteUrl = baseUrl || 'https://takdaro-site.pages.dev';
  const url = `${siteUrl}/admin.html?panel=orders&order=${encodeURIComponent(orderNumber)}`;
  
  return [
    [
      {
        text: '🔍 مشاهده سفارش',
        url: url
      }
    ]
  ];
}

/**
 * ساخت دکمه مشاهده کاربر
 * @param {number} userId - شناسه کاربر
 * @param {string} baseUrl - آدرس پایه سایت
 * @returns {Array} - آرایه دکمه‌های شیشه‌ای
 */
export function createUserViewButton(userId, baseUrl = '') {
  const siteUrl = baseUrl || 'https://takdaro-site.pages.dev';
  const url = `${siteUrl}/admin.html?panel=users&user=${encodeURIComponent(userId)}`;
  
  return [
    [
      {
        text: '👤 مشاهده کاربر',
        url: url
      }
    ]
  ];
}

// ============================================
// توابع کمکی
// ============================================

function formatNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(Number(value || 0));
}

function formatDate(dateString) {
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
    return dateString || '-';
  }
}

// ⭐⭐⭐ تابع تبدیل وضعیت به فارسی - 16 وضعیت کامل
function getStatusText(status, type = 'order') {
  // 16 وضعیت کامل سفارش
  const orderMap = {
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

  // 4 وضعیت کامل پرداخت
  const paymentMap = {
    'payment_pending': 'در انتظار پرداخت',
    'payment_success': 'پرداخت موفق',
    'payment_failed': 'پرداخت ناموفق',
    'payment_review': 'بررسی پرداخت',
    'pending': 'در انتظار پرداخت',
    'paid': 'پرداخت شده',
    'completed': 'تکمیل شد',
    'failed': 'ناموفق',
    'refunded': 'بازگشت داده شده'
  };

  const withdrawalMap = {
    'pending': 'در انتظار بررسی',
    'approved': 'تأیید شد',
    'rejected': 'رد شد'
  };

  if (type === 'payment') {
    return paymentMap[String(status || '').toLowerCase()] || status || '-';
  }

  if (type === 'withdrawal') {
    return withdrawalMap[String(status || '').toLowerCase()] || status || '-';
  }

  return orderMap[String(status || '').toLowerCase()] || status || '-';
}

// ============================================
// 1. پیام سفارش جدید (ادمین) - اصلاح شده
// ============================================
export function buildOrderCreatedMessage(orderData, userData, items) {
  const {
    orderNumber,
    totalAmount,
    shippingAmount,
    walletUsedAmount,
    payableAmount,
    cashbackAmount,
    createdAt
  } = orderData;

  const { fullName, email, phone } = userData;

  let productsText = '';
  let itemsTotal = 0;
  
  if (Array.isArray(items) && items.length > 0) {
    productsText = items.map((item) => {
      const name = item.product_name || item.name || 'محصول';
      const qty = Number(item.quantity || 0);
      const total = Number(item.total_price || 0);
      itemsTotal += total;
      return `  • ${name} × ${qty} - ${formatNumber(total)} تومان`;
    }).join('\n');
  } else {
    productsText = '  • (آیتمی ثبت نشده)';
    itemsTotal = 0;
  }

  let message = `🛒 <b>سفارش جدید #${orderNumber}</b>\n\n`;

  message += `👤 <b>مشتری:</b>\n`;
  message += `  ${fullName || '-'}`;
  if (email) message += `\n  📧 ${email}`;
  if (phone) message += `\n  📱 ${phone}`;
  message += `\n\n`;

  message += `📦 <b>محصولات:</b>\n`;
  message += productsText;
  message += `\n\n`;

  message += `💰 <b>مبلغ کل:</b>\n`;
  message += `  جمع محصولات: ${formatNumber(itemsTotal)} تومان\n`;
  if (shippingAmount > 0) {
    message += `  هزینه ارسال: ${formatNumber(shippingAmount)} تومان\n`;
  }
  if (walletUsedAmount > 0) {
    message += `  برداشت از کیف پول: -${formatNumber(walletUsedAmount)} تومان\n`;
  }
  message += `  ─────────────────\n`;
  message += `  <b>مبلغ قابل پرداخت: ${formatNumber(payableAmount || totalAmount)} تومان</b>\n`;

  if (cashbackAmount > 0) {
    message += `\n  🎁 <b>کش‌بک این سفارش: ${formatNumber(cashbackAmount)} تومان</b>`;
    message += `\n  (پس از تکمیل سفارش به کیف پول اضافه می‌شود)`;
  }

  message += `\n\n`;

  message += `💳 <b>وضعیت پرداخت:</b>\n`;
  message += `  ${getStatusText(orderData.paymentStatus, 'payment')}\n\n`;

  message += `📦 <b>وضعیت سفارش:</b>\n`;
  message += `  ${getStatusText(orderData.status, 'order')}\n\n`;

  message += `🕐 <b>تاریخ و ساعت:</b>\n`;
  message += `  ${formatDate(createdAt)}\n`;

  return message;
}

// ============================================
// 2. پیام پرداخت موفق (ادمین)
// ============================================
export function buildPaymentSuccessMessage(orderData, userData, paymentMethod = '') {
  const { orderNumber, totalAmount, payableAmount, status, createdAt } = orderData;
  const { fullName, email, phone } = userData;

  let message = `✅ <b>پرداخت موفق</b>\n\n`;

  message += `🛒 <b>سفارش:</b>\n`;
  message += `  #${orderNumber}\n\n`;

  message += `👤 <b>مشتری:</b>\n`;
  message += `  ${fullName || '-'}`;
  if (email) message += `\n  📧 ${email}`;
  if (phone) message += `\n  📱 ${phone}`;
  message += `\n\n`;

  message += `💰 <b>مبلغ پرداخت:</b>\n`;
  message += `  ${formatNumber(payableAmount || totalAmount)} تومان\n\n`;

  if (paymentMethod) {
    message += `💳 <b>روش پرداخت:</b>\n`;
    message += `  ${paymentMethod}\n\n`;
  }

  message += `📦 <b>وضعیت سفارش:</b>\n`;
  message += `  ${getStatusText(status, 'order')}\n\n`;

  message += `🕐 <b>تاریخ و ساعت:</b>\n`;
  message += `  ${formatDate(createdAt)}\n`;

  return message;
}

// ============================================
// 3. پیام تغییر وضعیت پرداخت (ادمین)
// ============================================
export function buildPaymentStatusChangedMessage(orderData, userData, oldStatus, newStatus) {
  const { orderNumber, totalAmount, status: orderStatus, createdAt } = orderData;
  const { fullName, email } = userData;

  let message = `💳 <b>تغییر وضعیت پرداخت</b>\n\n`;

  message += `🛒 <b>سفارش:</b>\n`;
  message += `  #${orderNumber}\n\n`;

  message += `👤 <b>مشتری:</b>\n`;
  message += `  ${fullName || '-'}`;
  if (email) message += `\n  📧 ${email}`;
  message += `\n\n`;

  message += `🔄 <b>وضعیت قبلی:</b>\n`;
  message += `  ${getStatusText(oldStatus, 'payment')}\n\n`;

  message += `➡️ <b>وضعیت جدید:</b>\n`;
  message += `  ${getStatusText(newStatus, 'payment')}\n\n`;

  message += `💰 <b>مبلغ:</b>\n`;
  message += `  ${formatNumber(totalAmount)} تومان\n\n`;

  message += `📦 <b>وضعیت سفارش:</b>\n`;
  message += `  ${getStatusText(orderStatus, 'order')}\n\n`;

  message += `🕐 <b>تاریخ و ساعت:</b>\n`;
  message += `  ${formatDate(createdAt)}\n`;

  return message;
}

// ============================================
// 4. پیام تغییر وضعیت سفارش (ادمین)
// ============================================
export function buildOrderStatusChangedMessage(orderData, userData, oldStatus, newStatus) {
  const { orderNumber, totalAmount, paymentStatus, createdAt } = orderData;
  const { fullName, email } = userData;

  let message = `📦 <b>تغییر وضعیت سفارش</b>\n\n`;

  message += `🛒 <b>سفارش:</b>\n`;
  message += `  #${orderNumber}\n\n`;

  message += `👤 <b>مشتری:</b>\n`;
  message += `  ${fullName || '-'}`;
  if (email) message += `\n  📧 ${email}`;
  message += `\n\n`;

  message += `🔄 <b>وضعیت قبلی:</b>\n`;
  message += `  ${getStatusText(oldStatus, 'order')}\n\n`;

  message += `➡️ <b>وضعیت جدید:</b>\n`;
  message += `  ${getStatusText(newStatus, 'order')}\n\n`;

  message += `💳 <b>وضعیت پرداخت:</b>\n`;
  message += `  ${getStatusText(paymentStatus, 'payment')}\n\n`;

  message += `💰 <b>مبلغ:</b>\n`;
  message += `  ${formatNumber(totalAmount)} تومان\n\n`;

  message += `🕐 <b>تاریخ و ساعت:</b>\n`;
  message += `  ${formatDate(createdAt)}\n`;

  return message;
}

// ============================================
// 5. پیام لغو سفارش (ادمین)
// ============================================
export function buildOrderCancelledMessage(orderData, userData, refundAmount = 0) {
  const { orderNumber, totalAmount, paymentStatus, createdAt } = orderData;
  const { fullName, email, phone } = userData;

  let message = `❌ <b>سفارش لغو شد</b>\n\n`;

  message += `🛒 <b>سفارش:</b>\n`;
  message += `  #${orderNumber}\n\n`;

  message += `👤 <b>مشتری:</b>\n`;
  message += `  ${fullName || '-'}`;
  if (email) message += `\n  📧 ${email}`;
  if (phone) message += `\n  📱 ${phone}`;
  message += `\n\n`;

  message += `💰 <b>مبلغ:</b>\n`;
  message += `  ${formatNumber(totalAmount)} تومان\n\n`;

  if (refundAmount > 0) {
    message += `↩️ <b>مبلغ بازپرداخت:</b>\n`;
    message += `  ${formatNumber(refundAmount)} تومان\n\n`;
  }

  message += `💳 <b>وضعیت پرداخت:</b>\n`;
  message += `  ${getStatusText(paymentStatus, 'payment')}\n\n`;

  message += `📦 <b>وضعیت سفارش:</b>\n`;
  message += `  لغو شد\n\n`;

  message += `🕐 <b>تاریخ و ساعت:</b>\n`;
  message += `  ${formatDate(createdAt)}\n`;

  return message;
}

// ============================================
// 6. پیام بازپرداخت (Refund)
// ============================================
export function buildRefundMessage(orderData, userData, refundAmount, refundMethod = '') {
  const { orderNumber, totalAmount, createdAt } = orderData;
  const { fullName, email, phone } = userData;

  let message = `↩️ <b>بازپرداخت انجام شد</b>\n\n`;

  message += `🛒 <b>سفارش:</b>\n`;
  message += `  #${orderNumber}\n\n`;

  message += `👤 <b>مشتری:</b>\n`;
  message += `  ${fullName || '-'}`;
  if (email) message += `\n  📧 ${email}`;
  if (phone) message += `\n  📱 ${phone}`;
  message += `\n\n`;

  message += `💰 <b>مبلغ بازپرداخت:</b>\n`;
  message += `  ${formatNumber(refundAmount)} تومان\n\n`;

  if (refundMethod) {
    message += `💳 <b>روش بازپرداخت:</b>\n`;
    message += `  ${refundMethod}\n\n`;
  }

  message += `📦 <b>وضعیت سفارش:</b>\n`;
  message += `  ${getStatusText(orderData.status, 'order')}\n\n`;

  message += `🕐 <b>تاریخ و ساعت:</b>\n`;
  message += `  ${formatDate(createdAt)}\n`;

  return message;
}

// ============================================
// 7. پیام شارژ کیف پول
// ============================================
export function buildWalletTopupMessage(userData, amount, paymentMethod = '', newBalance = 0) {
  const { fullName, email, phone } = userData;

  let message = `💰 <b>شارژ کیف پول</b>\n\n`;

  message += `👤 <b>مشتری:</b>\n`;
  message += `  ${fullName || '-'}`;
  if (email) message += `\n  📧 ${email}`;
  if (phone) message += `\n  📱 ${phone}`;
  message += `\n\n`;

  message += `💵 <b>مبلغ شارژ:</b>\n`;
  message += `  ${formatNumber(amount)} تومان\n\n`;

  if (paymentMethod) {
    message += `💳 <b>روش پرداخت:</b>\n`;
    message += `  ${paymentMethod}\n\n`;
  }

  message += `📋 <b>وضعیت:</b>\n`;
  message += `  موفق\n\n`;

  if (newBalance > 0) {
    message += `👛 <b>موجودی جدید کیف پول:</b>\n`;
    message += `  ${formatNumber(newBalance)} تومان\n\n`;
  }

  message += `🕐 <b>تاریخ و ساعت:</b>\n`;
  message += `  ${formatDate(new Date().toISOString())}\n`;

  return message;
}

// ============================================
// 8. پیام درخواست برداشت کیف پول
// ============================================
export function buildWalletWithdrawalRequestMessage(userData, amount, destinationInfo = '', requestId = '') {
  const { fullName, email, phone } = userData;

  let message = `💸 <b>درخواست برداشت از کیف پول</b>\n\n`;

  message += `👤 <b>مشتری:</b>\n`;
  message += `  ${fullName || '-'}`;
  if (email) message += `\n  📧 ${email}`;
  if (phone) message += `\n  📱 ${phone}`;
  message += `\n\n`;

  message += `💰 <b>مبلغ برداشت:</b>\n`;
  message += `  ${formatNumber(amount)} تومان\n\n`;

  if (destinationInfo) {
    message += `🏦 <b>اطلاعات مقصد:</b>\n`;
    message += `  ${destinationInfo}\n\n`;
  }

  if (requestId) {
    message += `📋 <b>شناسه درخواست:</b>\n`;
    message += `  #${requestId}\n\n`;
  }

  message += `📋 <b>وضعیت درخواست:</b>\n`;
  message += `  در انتظار بررسی\n\n`;

  message += `🕐 <b>تاریخ و ساعت:</b>\n`;
  message += `  ${formatDate(new Date().toISOString())}\n`;

  return message;
}

// ============================================
// 9. پیام تغییر وضعیت برداشت کیف پول
// ============================================
export function buildWalletWithdrawalStatusMessage(userData, amount, oldStatus, newStatus, requestId = '', reason = '') {
  const { fullName, email } = userData;

  const statusEmoji = newStatus === 'approved' ? '✅' : newStatus === 'rejected' ? '❌' : '📋';
  const statusText = newStatus === 'approved' ? 'تأیید شد' : newStatus === 'rejected' ? 'رد شد' : getStatusText(newStatus, 'withdrawal');

  let message = `${statusEmoji} <b>برداشت کیف پول ${statusText}</b>\n\n`;

  message += `👤 <b>مشتری:</b>\n`;
  message += `  ${fullName || '-'}`;
  if (email) message += `\n  📧 ${email}`;
  message += `\n\n`;

  message += `💰 <b>مبلغ:</b>\n`;
  message += `  ${formatNumber(amount)} تومان\n\n`;

  if (requestId) {
    message += `📋 <b>شناسه درخواست:</b>\n`;
    message += `  #${requestId}\n\n`;
  }

  message += `🔄 <b>وضعیت قبلی:</b>\n`;
  message += `  ${getStatusText(oldStatus, 'withdrawal')}\n\n`;

  message += `➡️ <b>وضعیت جدید:</b>\n`;
  message += `  ${statusText}\n\n`;

  if (reason && newStatus === 'rejected') {
    message += `📝 <b>دلیل:</b>\n`;
    message += `  ${reason}\n\n`;
  }

  message += `🕐 <b>تاریخ و ساعت:</b>\n`;
  message += `  ${formatDate(new Date().toISOString())}\n`;

  return message;
}

// ============================================
// 10. پیام اعمال کش‌بک
// ============================================
export function buildCashbackAppliedMessage(orderData, userData, cashbackAmount, newBalance = 0) {
  const { orderNumber, createdAt } = orderData;
  const { fullName, email } = userData;

  let message = `🎁 <b>کش‌بک اعمال شد</b>\n\n`;

  message += `🛒 <b>سفارش:</b>\n`;
  message += `  #${orderNumber}\n\n`;

  message += `👤 <b>مشتری:</b>\n`;
  message += `  ${fullName || '-'}`;
  if (email) message += `\n  📧 ${email}`;
  message += `\n\n`;

  message += `💰 <b>مبلغ کش‌بک:</b>\n`;
  message += `  ${formatNumber(cashbackAmount)} تومان\n\n`;

  if (newBalance > 0) {
    message += `👛 <b>موجودی جدید کیف پول:</b>\n`;
    message += `  ${formatNumber(newBalance)} تومان\n\n`;
  }

  message += `📦 <b>وضعیت سفارش:</b>\n`;
  message += `  ${getStatusText(orderData.status, 'order')}\n\n`;

  message += `🕐 <b>تاریخ و ساعت:</b>\n`;
  message += `  ${formatDate(createdAt || new Date().toISOString())}\n`;

  return message;
}

// ============================================
// توابع جدید برای پیام‌های کاربران
// ============================================

/**
 * 11. پیام ثبت سفارش برای کاربر (تکمیل شده)
 */
export function buildUserOrderCreatedMessage(orderData, userData, items) {
  const {
    orderNumber,
    totalAmount,
    shippingAmount,
    walletUsedAmount,
    payableAmount,
    cashbackAmount,
    status,
    paymentStatus,
    createdAt
  } = orderData;

  const { fullName } = userData;

  let message = `🛍️ <b>سفارش شما با موفقیت ثبت شد</b>\n\n`;

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🧾 <b>شماره سفارش:</b> #${orderNumber}\n`;
  message += `📅 <b>تاریخ ثبت:</b> ${formatDate(createdAt)}\n\n`;

  // محصولات
  let productsText = '';
  let itemsTotal = 0;
  if (Array.isArray(items) && items.length > 0) {
    productsText = items.map((item) => {
      const name = item.product_name || item.name || 'محصول';
      const qty = Number(item.quantity || 0);
      const total = Number(item.total_price || 0);
      itemsTotal += total;
      return `  • ${name} × ${qty} - ${formatNumber(total)} تومان`;
    }).join('\n');
  } else {
    productsText = '  • (آیتمی ثبت نشده)';
  }

  message += `📦 <b>اقلام سفارش:</b>\n`;
  message += productsText;
  message += `\n\n`;

  message += `💰 <b>مبلغ کالاها:</b> ${formatNumber(itemsTotal)} تومان\n`;
  if (shippingAmount > 0) {
    message += `🚚 <b>هزینه ارسال:</b> ${formatNumber(shippingAmount)} تومان\n`;
  }
  if (walletUsedAmount > 0) {
    message += `👛 <b>برداشت از کیف پول:</b> -${formatNumber(walletUsedAmount)} تومان\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💳 <b>مبلغ نهایی:</b> ${formatNumber(payableAmount || totalAmount)} تومان\n\n`;

  if (cashbackAmount > 0) {
    message += `💰 <b>کش‌بک این سفارش:</b> ${formatNumber(cashbackAmount)} تومان\n`;
    message += `(پس از تکمیل سفارش به کیف پول شما اضافه می‌شود)\n\n`;
  }

  message += `📌 <b>وضعیت سفارش:</b> ${getStatusText(status, 'order')}\n`;
  message += `📌 <b>وضعیت پرداخت:</b> ${getStatusText(paymentStatus, 'payment')}\n\n`;

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `از خرید شما سپاسگزاریم ❤️\n`;

  return message;
}

/**
 * 12. پیام پرداخت موفق برای کاربر (تکمیل شده)
 */
export function buildUserPaymentSuccessMessage(orderData, userData, paymentMethod = '') {
  const { orderNumber, totalAmount, payableAmount, cashbackAmount, status, createdAt } = orderData;
  const { fullName } = userData;

  let message = `✅ <b>پرداخت با موفقیت انجام شد</b>\n\n`;

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🧾 <b>شماره سفارش:</b> #${orderNumber}\n`;
  message += `👤 <b>نام:</b> ${fullName || '-'}\n\n`;

  message += `💰 <b>مبلغ پرداخت‌شده:</b>\n`;
  message += `  ${formatNumber(payableAmount || totalAmount)} تومان\n\n`;

  if (paymentMethod) {
    message += `💳 <b>روش پرداخت:</b> ${paymentMethod}\n\n`;
  }

  if (cashbackAmount > 0) {
    message += `🎁 <b>کش‌بک این سفارش:</b> ${formatNumber(cashbackAmount)} تومان\n`;
    message += `(پس از تکمیل سفارش به کیف پول شما اضافه می‌شود)\n\n`;
  }

  message += `📌 <b>وضعیت سفارش:</b> ${getStatusText(status, 'order')}\n\n`;

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `از اعتماد شما سپاسگزاریم ❤️\n`;

  return message;
}

/**
 * 13. پیام تغییر وضعیت سفارش برای کاربر
 */
export function buildUserOrderStatusChangedMessage(orderData, userData, oldStatus, newStatus, trackingCode = '') {
  const { orderNumber, totalAmount, paymentStatus, createdAt } = orderData;
  const { fullName } = userData;

  const statusEmoji = {
    'pending': '⏳',
    'processing': '🔄',
    'preparing': '📦',
    'shipped': '🚚',
    'completed': '✅',
    'cancelled': '❌'
  };

  const emoji = statusEmoji[String(newStatus).toLowerCase()] || '📋';

  let message = `${emoji} <b>تغییر وضعیت سفارش</b>\n\n`;

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🧾 <b>شماره سفارش:</b> #${orderNumber}\n`;
  message += `👤 <b>نام:</b> ${fullName || '-'}\n\n`;

  message += `💰 <b>مبلغ سفارش:</b> ${formatNumber(totalAmount)} تومان\n\n`;

  message += `🔄 <b>وضعیت قبلی:</b>\n`;
  message += `  ${getStatusText(oldStatus, 'order')}\n\n`;

  message += `➡️ <b>وضعیت جدید:</b>\n`;
  message += `  ${getStatusText(newStatus, 'order')}\n\n`;

  message += `💳 <b>وضعیت پرداخت:</b>\n`;
  message += `  ${getStatusText(paymentStatus, 'payment')}\n\n`;

  if (trackingCode) {
    message += `📮 <b>کد رهگیری:</b>\n`;
    message += `  ${trackingCode}\n\n`;
  }

  message += `🕐 <b>تاریخ:</b> ${formatDate(createdAt)}\n\n`;

  if (newStatus === 'shipped') {
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📌 <b>نکته:</b>\n`;
    message += `  سفارش شما ارسال شده است. کد رهگیری را در بالا مشاهده کنید.\n`;
  } else if (newStatus === 'completed') {
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🎉 <b>سفارش شما تکمیل شد!</b>\n`;
    message += `  از خرید شما متشکریم.\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  return message;
}

/**
 * 14. پیام لغو سفارش برای کاربر (جدید)
 */
export function buildUserOrderCancelledMessage(orderData, userData, refundAmount = 0) {
  const { orderNumber, totalAmount, paymentStatus, createdAt } = orderData;
  const { fullName } = userData;

  let message = `❌ <b>سفارش شما لغو شد</b>\n\n`;

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🧾 <b>شماره سفارش:</b> #${orderNumber}\n`;
  message += `👤 <b>نام:</b> ${fullName || '-'}\n\n`;

  message += `💰 <b>مبلغ سفارش:</b> ${formatNumber(totalAmount)} تومان\n\n`;

  if (refundAmount > 0) {
    message += `↩️ <b>مبلغ بازپرداخت:</b>\n`;
    message += `  ${formatNumber(refundAmount)} تومان\n\n`;
  }

  message += `📌 <b>وضعیت:</b>\n`;
  message += `  لغو شده\n\n`;

  message += `💳 <b>وضعیت پرداخت:</b>\n`;
  message += `  ${getStatusText(paymentStatus, 'payment')}\n\n`;

  message += `🕐 <b>تاریخ:</b> ${formatDate(createdAt)}\n\n`;

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  return message;
}

/**
 * 15. پیام پیگیری سفارش (تکمیل شده)
 */
export function buildUserOrderTrackingMessage(orderData, userData, items = []) {
  const { orderNumber, totalAmount, payableAmount, status, paymentStatus, createdAt, updatedAt } = orderData;
  const { fullName } = userData;

  let message = `🔎 <b>وضعیت سفارش شما</b>\n\n`;

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🧾 <b>شماره سفارش:</b> #${orderNumber}\n`;
  message += `👤 <b>نام:</b> ${fullName || '-'}\n\n`;

  // محصولات
  let productsText = '';
  if (Array.isArray(items) && items.length > 0) {
    productsText = items.map((item) => {
      const name = item.product_name || item.name || 'محصول';
      const qty = Number(item.quantity || 0);
      return `  • ${name} × ${qty}`;
    }).join('\n');
  } else {
    productsText = '  -';
  }
  message += `📦 <b>محصولات:</b>\n`;
  message += productsText;
  message += `\n\n`;

  message += `📌 <b>وضعیت سفارش:</b>\n`;
  message += `  ${getStatusText(status, 'order')}\n\n`;

  message += `💳 <b>وضعیت پرداخت:</b>\n`;
  message += `  ${getStatusText(paymentStatus, 'payment')}\n\n`;

  message += `💰 <b>مبلغ:</b>\n`;
  message += `  ${formatNumber(payableAmount || totalAmount)} تومان\n\n`;

  message += `📅 <b>تاریخ ثبت:</b>\n`;
  message += `  ${formatDate(createdAt)}\n\n`;

  if (updatedAt && updatedAt !== createdAt) {
    message += `🕐 <b>آخرین بروزرسانی:</b>\n`;
    message += `  ${formatDate(updatedAt)}\n\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📌 برای مشاهده جزئیات کامل، روی دکمه زیر کلیک کنید.\n`;

  return message;
}

/**
 * 16. ساخت دکمه پیگیری سفارش برای کاربر
 */
export function createUserOrderTrackingButton(orderNumber, baseUrl = '') {
  const siteUrl = baseUrl || 'https://takdaro-site.pages.dev';
  const url = `${siteUrl}/invoice.html?order=${encodeURIComponent(orderNumber)}`;
  
  return [
    [
      {
        text: '🔍 مشاهده جزئیات سفارش',
        url: url
      }
    ],
    [
      {
        text: '📞 تماس با پشتیبانی',
        url: `${siteUrl}/contact.html`
      }
    ]
  ];
}

/**
 * 17. ساخت دکمه اتصال تلگرام
 */
export function createTelegramConnectButton(baseUrl = '') {
  const siteUrl = baseUrl || 'https://takdaro-site.pages.dev';
  return [
    [
      {
        text: '🔗 اتصال به تلگرام',
        url: `${siteUrl}/account.html?tab=telegram`
      }
    ]
  ];
}

// ============================================
// توابع موجود قبلی
// ============================================

export {
  formatNumber,
  formatDate,
  getStatusText
};