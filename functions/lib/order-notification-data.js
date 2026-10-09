function notificationField(order, databaseName, clientName) {
  const value = Object.prototype.hasOwnProperty.call(order, databaseName)
    ? order[databaseName] : order[clientName];
  return String(value ?? '').trim();
}

function notificationDigits(value) {
  return value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

export function getOrderShippingDetails(order = {}) {
  const orderNumber = notificationField(order, 'order_number', 'orderNumber');
  // The existing delivery-code contract uses the invoice's last four digits.
  const shippingCode = notificationDigits(orderNumber).match(/\d{4}$/)?.[0] || '';
  return {
    orderNumber,
    status: notificationField(order, 'status', 'status'),
    paymentStatus: notificationField(order, 'payment_status', 'paymentStatus'),
    deliveryDate: notificationField(order, 'delivery_date', 'deliveryDate'),
    deliveryTimeFrom: notificationField(order, 'delivery_time_from', 'deliveryTimeFrom'),
    deliveryTimeTo: notificationField(order, 'delivery_time_to', 'deliveryTimeTo'),
    shippingCode,
    trackingCode: shippingCode,
  };
}

export function normalizeOrderNotificationData(order = {}) {
  return { ...order, ...getOrderShippingDetails(order) };
}

export function getDeliveryScheduleLabel(order = {}) {
  const status = notificationField(order, 'status', 'status') || notificationField(order, 'order_status', 'orderStatus');
  const payment = notificationField(order, 'payment_status', 'paymentStatus');
  const paid = ['paid', 'completed', 'success'].includes(payment.toLowerCase()) || status === 'payment_success';
  return status === 'payment_pending' || !paid ? 'زمان تقریبی ارسال' : 'زمان ارسال';
}

export async function loadOrderNotificationData(env, order = {}) {
  const hasSchedule = [
    ['delivery_date', 'deliveryDate'],
    ['delivery_time_from', 'deliveryTimeFrom'],
    ['delivery_time_to', 'deliveryTimeTo'],
  ].every(names => names.some(name => Object.prototype.hasOwnProperty.call(order, name)));
  const orderId = Number(order.orderId ?? order.id);
  // Older payment/notification callers omit the schedule; read it once before fan-out.
  if (!hasSchedule && Number.isSafeInteger(orderId) && orderId > 0) {
    const stored = await env.DB.prepare(`
      SELECT order_number, status, delivery_date, delivery_time_from, delivery_time_to, payment_status
      FROM orders WHERE id = ? LIMIT 1
    `).bind(orderId).first();
    if (stored) return normalizeOrderNotificationData({ ...order, ...stored });
  }
  return normalizeOrderNotificationData(order);
}

export function escapeShippingHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildTelegramShippingDetails(order = {}) {
  const details = getOrderShippingDetails(order);
  const time = [details.deliveryTimeFrom, details.deliveryTimeTo].filter(Boolean).join(' تا ');
  let message = '';
  if (details.deliveryDate || time) {
    message += `\n🚚 <b>${getDeliveryScheduleLabel(order)}:</b> ${escapeShippingHtml(details.deliveryDate || 'در حال تعیین')}`;
    if (time) message += ` (${escapeShippingHtml(time)})`;
    message += '\n';
  }
  if (details.shippingCode) message += `\n📮 <b>کد ارسال / رهگیری:</b> ${details.shippingCode}\n`;
  return message;
}
