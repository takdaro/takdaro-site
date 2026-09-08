// ============================================
// Central Canonical Status Source
// ============================================

// ۱۱ وضعیت رسمی (Canonical)
export const CANONICAL_STATUSES = [
  'payment_pending',
  'payment_success',
  'payment_failed',
  'order_confirmed',
  'courier_delivery',
  'bus_shipping',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'returned'
];

// ترجمه رسمی فارسی ۱۱ وضعیت
export const STATUS_LABELS = {
  payment_pending: 'در انتظار پرداخت',
  payment_success: 'پرداخت موفق',
  payment_failed: 'پرداخت ناموفق',
  order_confirmed: 'تأیید سفارش',
  courier_delivery: 'ارسال با پیک',
  bus_shipping: 'ارسال با باربری',
  shipped: 'ارسال شد',
  delivered: 'تحویل داده شد',
  completed: 'تکمیل شد',
  cancelled: 'لغو شد',
  returned: 'مرجوع شد'
};

// لیست Channelهای پشتیبانی‌شده
export const SUPPORTED_CHANNELS = [
  'telegram',
  'sms',
  'email',
  'whatsapp'
];

/**
 * دریافت ترجمه فارسی یک وضعیت
 * @param {string} status - وضعیت انگلیسی
 * @returns {string} - ترجمه فارسی
 */
export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || 'نامشخص';
}

/**
 * بررسی معتبر بودن یک وضعیت
 * @param {string} status - وضعیت موردنظر
 * @returns {boolean} - true اگر معتبر باشد
 */
export function isValidCanonicalStatus(status) {
  return CANONICAL_STATUSES.includes(status);
}

/**
 * دریافت لیست کامل وضعیت‌های رسمی
 * @returns {Array} - آرایه وضعیت‌ها
 */
export function getCanonicalStatuses() {
  return [...CANONICAL_STATUSES];
}

/**
 * دریافت لیست وضعیت‌ها با ترجمه فارسی
 * @returns {Array} - آرایه اشیاء { value, label }
 */
export function getCanonicalStatusesWithLabels() {
  return CANONICAL_STATUSES.map((status) => ({
    value: status,
    label: STATUS_LABELS[status] || status
  }));
}

// ============================================
// برای Migration آینده: نگاشت وضعیت‌های قدیمی به جدید
// ============================================
export const DEPRECATED_STATUS_MAP = {
  'order_created': 'payment_pending',
  'payment_review': 'payment_pending',
  'processing': 'order_confirmed',
  'ready_to_ship': 'shipped',
  'processing_failed': 'payment_failed'
};

/**
 * تبدیل وضعیت قدیمی به وضعیت رسمی
 * @param {string} status - وضعیت قدیمی
 * @returns {string} - وضعیت رسمی
 */
export function getCanonicalFromDeprecated(status) {
  return DEPRECATED_STATUS_MAP[status] || status;
}

/**
 * بررسی اینکه آیا وضعیت موردنظر جزء وضعیت‌های قدیمی است
 * @param {string} status - وضعیت موردنظر
 * @returns {boolean} - true اگر قدیمی باشد
 */
export function isDeprecatedStatus(status) {
  return Object.keys(DEPRECATED_STATUS_MAP).includes(status);
}