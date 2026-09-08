import { getCurrentUser } from "../../../lib/admin";

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // ============================================
    // بررسی کاربر واردشده
    // ============================================

    const user = await getCurrentUser(context);

    if (!user || !user.id) {
      return json(
        {
          success: false,
          error:
            "برای فعال‌سازی اعلان‌ها باید وارد حساب کاربری شوید."
        },
        401
      );
    }

    // ============================================
    // دریافت Body
    // ============================================

    const body = await request
      .json()
      .catch(() => null);

    const subscription =
      body?.subscription;

    if (!subscription?.endpoint) {
      return json(
        {
          success: false,
          error:
            "اطلاعات Push Subscription معتبر نیست."
        },
        400
      );
    }

    const p256dh =
      subscription?.keys?.p256dh;

    const auth =
      subscription?.keys?.auth;

    if (!p256dh || !auth) {
      return json(
        {
          success: false,
          error:
            "کلیدهای Push Subscription ناقص هستند."
        },
        400
      );
    }

    const userAgent =
      request.headers.get("user-agent") || "";

    // ============================================
    // ذخیره Subscription
    // ============================================

    const result = await env.DB
      .prepare(
        `
        INSERT INTO push_subscriptions (
          user_id,
          endpoint,
          p256dh,
          auth,
          user_agent,
          is_active,
          created_at,
          updated_at,
          last_used_at
        )
        VALUES (
          ?, ?, ?, ?, ?, 1,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )

        ON CONFLICT(endpoint)
        DO UPDATE SET
          user_id = excluded.user_id,
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          user_agent = excluded.user_agent,
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP,
          last_used_at = CURRENT_TIMESTAMP
        `
      )
      .bind(
        Number(user.id),
        String(subscription.endpoint),
        String(p256dh),
        String(auth),
        String(userAgent)
      )
      .run();

    // ============================================
    // موفقیت
    // ============================================

    return json({
      success: true,
      message:
        "اعلان‌های مرورگر با موفقیت فعال شدند.",
      id:
        result?.meta?.last_row_id ||
        null
    });

  } catch (error) {
    // ============================================
    // نمایش خطای واقعی برای تشخیص
    // ============================================

    console.error(
      "Push subscribe error:",
      error
    );

    console.error(
      "Push subscribe error message:",
      error?.message
    );

    console.error(
      "Push subscribe error stack:",
      error?.stack
    );

    return json(
      {
        success: false,
        error:
          String(
            error?.message ||
            error ||
            "خطای ناشناخته در فعال‌سازی اعلان‌ها."
          ),
        debug: {
          name:
            String(
              error?.name || ""
            ),
          user_id:
            Number(user?.id || 0)
        }
      },
      500
    );
  }
}