import { getMobileUser, mobileUnauthorized } from "../../../lib/mobile-auth";

export async function onRequestPost(context) {
  try {
    const result = await getMobileUser(context);
    if (!result.ok) {
      return mobileUnauthorized(result.reason);
    }

    await context.env.DB
      .prepare(`
        UPDATE admin_mobile_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND revoked_at IS NULL
      `)
      .bind(result.session.id)
      .run();

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Mobile auth logout error:", error);
    return Response.json(
      { success: false, error: "خطا در خروج از حساب مدیریت." },
      { status: 500 }
    );
  }
}
