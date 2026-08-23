// ============================================
// API دریافت وضعیت اتصال تلگرام
// ============================================

import { getSessionUser } from '../../../lib/db.js';
import { findTelegramConnectionByUserId } from '../../../lib/db.js';

function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split('; ');
  const target = cookies.find((item) => item.startsWith(key + '='));
  return target ? target.slice(key.length + 1) : null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestGet(context) {
  try {
    const { env, request } = context;

    // دریافت Session ID از Cookie
    const cookieString = request.headers.get('cookie') || '';
    const sessionId = getCookie(cookieString, 'session_id');

    if (!sessionId) {
      return json({ success: false, error: 'unauthorized' }, 401);
    }

    // دریافت اطلاعات کاربر از Session
    const user = await getSessionUser(env, sessionId);

    if (!user) {
      return json({ success: false, error: 'unauthorized' }, 401);
    }

    // دریافت اتصال تلگرام کاربر
    const connection = await findTelegramConnectionByUserId(env, user.id);

    if (!connection) {
      return json({
        success: true,
        connected: false,
        data: null
      });
    }

    return json({
      success: true,
      connected: true,
      data: {
        chat_id: connection.chat_id,
        telegram_user_id: connection.telegram_user_id,
        telegram_username: connection.telegram_username,
        first_name: connection.first_name,
        last_name: connection.last_name,
        connected_at: connection.connected_at,
        last_used_at: connection.last_used_at
      }
    });

  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}