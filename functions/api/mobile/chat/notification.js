import { sendAdminChatMessageNotification } from '../../../lib/notification.js';

export async function onRequestPost(context) {
  const expectedToken = String(context.env.CHAT_ADMIN_TOKEN || '');
  const suppliedToken = String(context.request.headers.get('x-chat-admin-token') || '');

  if (!expectedToken) {
    return Response.json({ success: false, error: 'chat_api_not_configured' }, { status: 503 });
  }
  if (!suppliedToken || suppliedToken !== expectedToken) {
    return Response.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  if (Number(context.request.headers.get('content-length') || 0) > 4096) {
    return Response.json({ success: false, error: 'payload_too_large' }, { status: 413 });
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return Response.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const roomId = String(payload?.room_id || '').trim();
  if (!roomId || roomId.length > 160) {
    return Response.json({ success: false, error: 'invalid_room_id' }, { status: 400 });
  }

  const result = await sendAdminChatMessageNotification(context.env, {
    roomId,
    sender: payload?.sender,
    department: payload?.department,
    messageType: payload?.message_type === 'image' ? 'image' : 'message',
  });

  return Response.json({
    success: result?.success === true,
    skipped: result?.skipped === true,
    reason: result?.reason || null,
    event_key: 'chat_online',
    summary: result?.summary || null,
    error: result?.error || null,
  }, { status: result?.success === false ? 502 : 200, headers: { 'cache-control': 'no-store' } });
}
