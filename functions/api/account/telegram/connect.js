// ============================================
// API اتصال تلگرام - تولید Token و لینک
// ============================================

import { getSessionUser } from '../../../lib/db.js';
import { createTelegramToken } from '../../../lib/db.js';
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

/**
 * ایجاد هش از توکن با استفاده از SHA-256
 */
async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * تولید توکن تصادفی
 */
function generateRandomToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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

    // بررسی اینکه کاربر قبلاً متصل است یا خیر
    const existingConnection = await findTelegramConnectionByUserId(env, user.id);

    if (existingConnection) {
      return json({
        success: false,
        error: 'شما قبلاً به تلگرام متصل هستید. در صورت نیاز، ابتدا اتصال را قطع کنید.'
      });
    }

    // تولید توکن
    const rawToken = generateRandomToken();
    const tokenHash = await hashToken(rawToken);

    // ذخیره توکن در دیتابیس
    await createTelegramToken(env, user.id, tokenHash);

    // دریافت اطلاعات ربات تلگرام
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return json({
        success: false,
        error: 'تنظیمات تلگرام کامل نیست.'
      });
    }

    // ساخت لینک عمیق تلگرام
    const botUsername = env.TELEGRAM_BOT_USERNAME || 'takdaro_bot';
    const baseUrl = env.SITE_BASE_URL || 'https://takdaro.com';
    const telegramLink = `https://t.me/${botUsername}?start=${rawToken}`;

    return json({
      success: true,
      telegram_link: telegramLink,
      token: rawToken,
      expires_in: '10 دقیقه'
    });

  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}