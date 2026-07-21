async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeMobile(value) {
  if (!value) return "";
  return String(value).trim().replace(/[^\d+]/g, "");
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const full_name = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const mobile = normalizeMobile(body.mobile || "");
    const password = String(body.password || "");

    if (!full_name || !email || !mobile || !password) {
      return Response.json(
        { success: false, error: "full_name, email, mobile, password required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json(
        { success: false, error: "password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const weakPasswords = ["123456", "12345678", "password", "qwerty", "111111"];
    if (weakPasswords.includes(password.toLowerCase())) {
      return Response.json(
        { success: false, error: "please choose a stronger password" },
        { status: 400 }
      );
    }

    const existingEmail = await context.env.DB
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (existingEmail) {
      return Response.json(
        { success: false, error: "email already exists" },
        { status: 409 }
      );
    }

    const existingMobile = await context.env.DB
      .prepare("SELECT id FROM users WHERE mobile = ?")
      .bind(mobile)
      .first();

    if (existingMobile) {
      return Response.json(
        { success: false, error: "mobile already exists" },
        { status: 409 }
      );
    }

    const password_hash = await sha256(password);

    const result = await context.env.DB
      .prepare(
        "INSERT INTO users (full_name, mobile, email, password_hash) VALUES (?, ?, ?, ?)"
      )
      .bind(full_name, mobile, email, password_hash)
      .run();

    return Response.json(
      {
        success: true,
        inserted: result.success === true,
        id: result.meta?.last_row_id ?? null
      },
      { status: 201 }
    );
  } catch (error) {
    const message = String(error?.message || error);

    if (message.toLowerCase().includes("unique")) {
      return Response.json(
        { success: false, error: "email or mobile already exists" },
        { status: 409 }
      );
    }

    return Response.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}