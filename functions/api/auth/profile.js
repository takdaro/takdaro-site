import { getCurrentUser } from "../../lib/admin";
import { hashPassword } from "../../lib/password";

function json(data, status = 200) {
  return Response.json(data, { status });
}

// ============================================
// GET - دریافت اطلاعات پروفایل کاربر
// ============================================
export async function onRequestGet(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    return json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        wallet_balance: user.wallet_balance,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}

// ============================================
// POST - به‌روزرسانی پروفایل کاربر (بدون نیاز به رمز فعلی)
// ============================================
export async function onRequestPost(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const body = await context.request.json();

    const full_name = String(body.full_name ?? body.name ?? "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const password_confirm = String(body.password_confirm || "");

    // اعتبارسنجی
    if (!full_name || !email) {
      return json(
        { success: false, error: "full_name and email required" },
        400
      );
    }

    // بررسی ایمیل تکراری
    const existingUser = await context.env.DB
      .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
      .bind(email, user.id)
      .first();

    if (existingUser) {
      return json(
        { success: false, error: "email already exists" },
        409
      );
    }

    // ============================================
    // تغییر رمز عبور (بدون نیاز به رمز فعلی)
    // ============================================
    if (password) {
      // اعتبارسنجی رمز جدید - حداقل 8 کاراکتر
      if (password.length < 8) {
        return json(
          { success: false, error: "رمز عبور جدید باید حداقل ۸ کاراکتر باشد." },
          400
        );
      }

      if (password !== password_confirm) {
        return json(
          { success: false, error: "رمز عبور و تکرار آن یکسان نیست." },
          400
        );
      }

      // هش کردن رمز جدید با روش استاندارد PBKDF2
      const newPasswordHash = await hashPassword(password);

      // به‌روزرسانی با رمز جدید
      await context.env.DB
        .prepare(`
          UPDATE users
          SET full_name = ?, email = ?, phone = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(full_name, email, phone || null, newPasswordHash, user.id)
        .run();
    } else {
      // به‌روزرسانی بدون تغییر رمز
      await context.env.DB
        .prepare(`
          UPDATE users
          SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(full_name, email, phone || null, user.id)
        .run();
    }

    // دریافت اطلاعات به‌روز شده
    const updatedUser = await context.env.DB
      .prepare(`
        SELECT id, full_name, email, phone, role, wallet_balance, created_at, updated_at
        FROM users
        WHERE id = ?
      `)
      .bind(user.id)
      .first();

    return json({
      success: true,
      message: "پروفایل با موفقیت به‌روزرسانی شد.",
      user: updatedUser
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}