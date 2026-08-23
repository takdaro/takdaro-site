// ============================================
// API قطع اتصال تلگرام
// ============================================

import { getSessionUser } from '../../../lib/db.js';
import { disconnectTelegram } from '../../../lib/db.js';
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

export async function onRequestPost(context) {
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

    // بررسی وجود اتصال
    const connection = await findTelegramConnectionByUserId(env, user.id);

    if (!connection) {
      return json({
        success: false,
        error: 'شما به تلگرام متصل نیستید.'
      });
    }

    // قطع اتصال
    await disconnectTelegram(env, user.id);

    return json({
      success: true,
      message: 'اتصال تلگرام با موفقیت قطع شد.'
    });

  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}