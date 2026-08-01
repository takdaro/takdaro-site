import { verifyPassword } from "../../lib/password";

function normalizeEmail(email) {
  if (!email) return "";
  return String(email).trim().toLowerCase();
}

// ============================================
// تابع بررسی رمز عبور با پشتیبانی از هر دو روش
// ============================================
async function verifyPasswordCompatible(password, storedHash) {
  // اگر هش با PBKDF2 شروع شود (روش جدید)
  if (storedHash && storedHash.startsWith('pbkdf2$')) {
    return await verifyPassword(password, storedHash);
  }
  
  // اگر هش با SHA-256 باشد (روش قدیمی)
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

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const email = normalizeEmail(body.email || "");
    const password = String(body.password || "");

    if (!email || !password) {
      return Response.json(
        { success: false, error: "email and password required" },
        { status: 400 }
      );
    }

    const user = await context.env.DB
      .prepare(`
        SELECT
          id,
          full_name,
          phone,
          email,
          role,
          wallet_balance,
          password_hash,
          created_at,
          updated_at
        FROM users
        WHERE email = ?
      `)
      .bind(email)
      .first();

    if (!user) {
      return Response.json(
        { success: false, error: "invalid credentials" },
        { status: 401 }
      );
    }

    // ✅ استفاده از تابع جدید برای بررسی رمز
    const isPasswordValid = await verifyPasswordCompatible(password, user.password_hash);

    if (!isPasswordValid) {
      return Response.json(
        { success: false, error: "invalid credentials" },
        { status: 401 }
      );
    }

    const sessionId = crypto.randomUUID();

    await context.env.DB
      .prepare(`
        INSERT INTO sessions (id, user_id, created_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(sessionId, user.id)
      .run();

    const response = Response.json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        wallet_balance: user.wallet_balance,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

    response.headers.set(
      "Set-Cookie",
      `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
    );

    return response;
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: String(error?.message || error)
      },
      { status: 500 }
    );
  }
}