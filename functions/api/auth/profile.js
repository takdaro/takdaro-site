import { getCurrentUser } from "../../lib/admin";
import { hashPassword, verifyPassword } from "../../lib/password";

function json(data, status = 200) {
  return Response.json(data, { status });
}

// ============================================
// ✅ تابع بررسی رمز عبور با پشتیبانی از هر دو روش
// ============================================
async function verifyPasswordCompatible(password, storedHash) {
  if (storedHash && storedHash.startsWith('pbkdf2$')) {
    return await verifyPassword(password, storedHash);
  }
  
  if (storedHash && storedHash.match(/^[a-f0-9]{64}$/)) {
    const sha256 = async (text) => {
      const data = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(hashBuffer)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    };
    const hashed = await sha256(password);
    return hashed === storedHash;
  }
  
  return false;
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
// POST - به‌روزرسانی پروفایل کاربر
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
    const current_password = String(body.current_password || "");
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
    // تغییر رمز عبور
    // ============================================
    if (password) {
      // اگر رمز فعلی وارد نشده باشد
      if (!current_password) {
        return json(
          { success: false, error: "برای تغییر رمز عبور، رمز فعلی را وارد کنید." },
          400
        );
      }

      // دریافت رمز فعلی از دیتابیس
      const currentUser = await context.env.DB
        .prepare("SELECT password_hash FROM users WHERE id = ?")
        .bind(user.id)
        .first();

      if (!currentUser) {
        return json(
          { success: false, error: "کاربر یافت نشد." },
          404
        );
      }

      // بررسی رمز فعلی
      const isPasswordValid = await verifyPasswordCompatible(current_password, currentUser.password_hash);
      
      if (!isPasswordValid) {
        return json(
          { success: false, error: "رمز عبور فعلی اشتباه است." },
          400
        );
      }

      // ✅ اعتبارسنجی رمز جدید - حداقل 8 کاراکتر با پیام فارسی
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