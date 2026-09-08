import { getCurrentUser } from "../../../lib/admin";

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const user = await getCurrentUser(request, env);

    if (!user || !user.id) {
      return json(
        {
          success: false,
          error: "دسترسی غیرمجاز است."
        },
        401
      );
    }

    const body = await request.json();

    const endpoint = String(
      body?.endpoint || ""
    ).trim();

    if (!endpoint) {
      return json(
        {
          success: false,
          error: "Endpoint مربوط به اعلان مشخص نشده است."
        },
        400
      );
    }

    await env.DB
      .prepare(
        `
        UPDATE push_subscriptions
        SET
          is_active = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE endpoint = ?
          AND user_id = ?
        `
      )
      .bind(endpoint, user.id)
      .run();

    return json({
      success: true,
      message: "اعلان‌های مرورگر با موفقیت غیرفعال شدند."
    });

  } catch (error) {
    console.error("Push unsubscribe error:", error);

    return json(
      {
        success: false,
        error: "خطا در غیرفعال‌سازی اعلان‌های مرورگر."
      },
      500
    );
  }
}