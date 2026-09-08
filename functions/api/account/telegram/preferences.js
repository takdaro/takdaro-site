// ============================================
// API تنظیمات اعلان تلگرام
// ============================================

import { getSessionUser } from '../../../lib/db.js';
import { getUserNotificationPreferences } from '../../../lib/db.js';
import { saveUserNotificationPreferences } from '../../../lib/db.js';

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
 * GET - دریافت تنظیمات اعلان کاربر
 */
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

    // دریافت تنظیمات کاربر
    const preferences = await getUserNotificationPreferences(env, user.id);

    // ⭐ تنظیمات پیش‌فرض بر اساس ۱۱ وضعیت رسمی
    const defaultPrefs = {
      payment_pending: true,
      payment_success: true,
      payment_failed: true,
      order_confirmed: true,
      courier_delivery: true,
      bus_shipping: true,
      shipped: true,
      delivered: true,
      completed: true,
      cancelled: true,
      returned: true,
      announcements: false,
      promotions: false,
      marketing: false
    };

    const prefs = preferences || defaultPrefs;

    return json({
      success: true,
      preferences: prefs
    });

  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}

/**
 * PUT - به‌روزرسانی تنظیمات اعلان کاربر
 */
export async function onRequestPut(context) {
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

    // دریافت داده‌های درخواست
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return json({
        success: false,
        error: 'داده‌های نامعتبر.'
      }, 400);
    }

    // ⭐ فیلدهای مجاز بر اساس ۱۱ وضعیت رسمی
    const allowedFields = [
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
      'returned',
      'announcements',
      'promotions',
      'marketing'
    ];

    // فیلتر کردن داده‌ها
    const preferences = {};
    let hasValidField = false;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        preferences[field] = Boolean(body[field]);
        hasValidField = true;
      }
    }

    if (!hasValidField) {
      return json({
        success: false,
        error: 'هیچ فیلد معتبری برای به‌روزرسانی ارسال نشده است.'
      }, 400);
    }

    // ذخیره تنظیمات
    await saveUserNotificationPreferences(env, user.id, preferences);

    // دریافت تنظیمات به‌روز شده
    const updatedPrefs = await getUserNotificationPreferences(env, user.id);

    return json({
      success: true,
      message: 'تنظیمات با موفقیت به‌روزرسانی شد.',
      preferences: updatedPrefs
    });

  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}