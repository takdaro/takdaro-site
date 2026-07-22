import { requireAdmin, logAdminAction } from "../../../lib/admin";

async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await context.request.json();
    const user_id = Number(body.user_id || 0);
    const password = String(body.password || "");
    const password_confirm = String(body.password_confirm || "");

    if (!user_id || !password || !password_confirm) {
      return Response.json(
        { success: false, error: "user_id, password, password_confirm required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return Response.json(
        { success: false, error: "password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (password !== password_confirm) {
      return Response.json(
        { success: false, error: "password confirmation mismatch" },
        { status: 400 }
      );
    }

    const targetUser = await context.env.DB
      .prepare(`SELECT id, role, email FROM users WHERE id = ?`)
      .bind(user_id)
      .first();

    if (!targetUser) {
      return Response.json(
        { success: false, error: "user not found" },
        { status: 404 }
      );
    }

    if (
      String(targetUser.role || "") === "super_admin" &&
      String(adminCheck.user.role || "") !== "super_admin"
    ) {
      return Response.json(
        { success: false, error: "cannot change super admin password" },
        { status: 403 }
      );
    }

    const password_hash = await sha256Hex(password);

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
      action: "change_user_password",
      target_type: "user",
      target_id: String(user_id),
      description: `password changed for ${targetUser.email || `user#${user_id}`}`
    });

    return Response.json({
      success: true,
      message: "password updated successfully"
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}