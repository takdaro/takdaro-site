import { getChannelSettings } from '../../lib/notification.js';

function json(data, status = 200) { return Response.json(data, { status }); }
function cookieValue(request, key) {
  const item = (request.headers.get('cookie') || '').split('; ').find((part) => part.startsWith(`${key}=`));
  return item ? item.slice(key.length + 1) : null;
}
async function currentUserId(context) {
  const sessionId = cookieValue(context.request, 'session_id');
  if (!sessionId) return null;
  const row = await context.env.DB.prepare('SELECT user_id FROM sessions WHERE id = ? LIMIT 1').bind(sessionId).first();
  return row?.user_id || null;
}

export async function onRequestPost(context) {
  try {
    const userId = await currentUserId(context);
    if (!userId) return json({ success: false, error: 'unauthorized' }, 401);
    const form = await context.request.formData();
    const orderNumber = String(form.get('order_number') || '').trim();
    const file = form.get('receipt');
    if (!orderNumber || !(file instanceof File)) return json({ success: false, error: 'receipt_required' }, 400);
    if (!String(file.type || '').startsWith('image/')) return json({ success: false, error: 'image_only' }, 400);
    if (file.size > 8 * 1024 * 1024) return json({ success: false, error: 'file_too_large' }, 400);
    const order = await context.env.DB.prepare('SELECT id, order_number, payable_amount FROM orders WHERE user_id = ? AND order_number = ? LIMIT 1').bind(userId, orderNumber).first();
    if (!order) return json({ success: false, error: 'order_not_found' }, 404);
    const settings = await getChannelSettings(context.env, 'telegram');
    const botToken = context.env.TELEGRAM_BOT_TOKEN;
    const chatId = settings?.config?.chat_id;
    if (!botToken || !chatId) return json({ success: false, error: 'telegram_not_configured' }, 503);
    const body = new FormData();
    body.append('chat_id', String(chatId));
    body.append('photo', file, file.name || 'receipt.jpg');
    body.append('caption', `🧾 <b>رسید پرداخت جدید</b>\n\n📌 فاکتور: <b>${order.order_number}</b>\n💰 مبلغ: ${Number(order.payable_amount || 0).toLocaleString('fa-IR')} تومان\n⏳ وضعیت: در انتظار بررسی`);
    body.append('parse_mode', 'HTML');
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method: 'POST', body });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) return json({ success: false, error: 'telegram_send_failed' }, 502);
    const photo = result.result?.photo || [];
    const fileId = photo[photo.length - 1]?.file_id || null;
    await context.env.DB.prepare(`UPDATE orders SET receipt_file_id = ?, receipt_uploaded_at = CURRENT_TIMESTAMP, receipt_status = 'pending', payment_status = 'review', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`).bind(fileId, order.id, userId).run();

    // اگر مشتری تلگرام خود را متصل کرده باشد، رسید و پیام دریافت برای او هم ارسال شود.
    const customerTelegram = await context.env.DB.prepare(
      'SELECT chat_id FROM user_telegram_connections WHERE user_id = ? AND is_active = 1 LIMIT 1'
    ).bind(userId).first();
    if (customerTelegram?.chat_id && fileId) {
      const customerBody = new FormData();
      customerBody.append('chat_id', String(customerTelegram.chat_id));
      customerBody.append('photo', file, file.name || 'receipt.jpg');
      customerBody.append('caption', `✅ <b>رسید واریزی دریافت شد</b>\n\nفاکتور <b>${order.order_number}</b> را دریافت کرده‌ایم.\nرسید شما برای بررسی مدیریت ارسال شد و نتیجهٔ تأیید پرداخت پس از بررسی اطلاع‌رسانی می‌شود.`);
      customerBody.append('parse_mode', 'HTML');
      await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method: 'POST', body: customerBody }).catch(() => null);
    }

    await context.env.DB.prepare(`UPDATE orders SET receipt_file_id = NULL, receipt_uploaded_at = NULL, receipt_status = 'none' WHERE receipt_uploaded_at IS NOT NULL AND receipt_uploaded_at < datetime('now', '-60 days')`).run();
    return json({ success: true, status: 'pending' });
  } catch (error) { return json({ success: false, error: String(error?.message || error) }, 500); }
}
