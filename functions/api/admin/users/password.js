import { requireAdmin, logAdminAction } from "../../../lib/admin";
import { hashPassword } from "../../../lib/password";

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await context.request.json();
    const user_id = Number(body.user_id || 0);
    const password = String(body.password || "");
    const password_confirm = String(body.password_confirm || "");

    if (!user_id) {
      return json({ success: false, error: "user_id required" }, 400);
    }

    if (!password || !password_confirm) {
      return json({ success: false, error: "password and password_confirm required" }, 400);
    }

    if (password.length < 8) {
      return json({ success: false, error: "password must be at least 8 characters" }, 400);
    }

    if (password !== password_confirm) {
      return json({ success: false, error: "password confirmation does not match" }, 400);
    }

    const targetUser = await context.env.DB
      .prepare("SELECT id, role FROM users WHERE id = ?")
      .bind(user_id)
      .first();

    if (!targetUser) {
      return json({ success: false, error: "user not found" }, 404);
    }

    // ✅ استفاده از hashPassword استاندارد (PBKDF2)
    const password_hash = await hashPassword(password);

    await context.env.DB
      .prepare(`
        UPDATE users
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(password_hash, user_id)
      .run();

    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "update_user_password",
      target_type: "user",
      target_id: String(user_id),
      description: `password updated for user #${user_id}`
    });

    return json({
      success: true,
      message: "password updated successfully"
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}