function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  if (!target) return null;
  return target.slice(key.length + 1);
}

async function getCurrentUserId(context) {
  const cookieString = context.request.headers.get("Cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");
  if (!sessionId) return null;

  const session = await context.env.DB
    .prepare("SELECT user_id FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first();

  return session?.user_id ?? null;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestGet(context) {
  try {
    const userId = await getCurrentUserId(context);

    if (!userId) {
      return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const user = await context.env.DB
      .prepare(`
        SELECT id, full_name, email, phone, created_at, updated_at
        FROM users
        WHERE id = ?
      `)
      .bind(userId)
      .first();

    if (!user) {
      return Response.json({ success: false, error: "user not found" }, { status: 404 });
    }

    return Response.json({ success: true, user });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function onRequestPost(context) {
  try {
    const userId = await getCurrentUserId(context);

    if (!userId) {
      return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await context.request.json();

    const full_name = String(body.full_name ?? body.name ?? "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const password_confirm = String(body.password_confirm || "");

    if (!full_name || !email) {
      return Response.json(
        { success: false, error: "full_name and email required" },
        { status: 400 }
      );
    }

    if (password) {
      if (password.length < 6) {
        return Response.json(
          { success: false, error: "password must be at least 6 characters" },
          { status: 400 }
        );
      }

      if (password !== password_confirm) {
        return Response.json(
          { success: false, error: "password confirmation does not match" },
          { status: 400 }
        );
      }
    }

    const existingUser = await context.env.DB
      .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
      .bind(email, userId)
      .first();

    if (existingUser) {
      return Response.json(
        { success: false, error: "email already exists" },
        { status: 409 }
      );
    }

    if (password) {
      const password_hash = await sha256(password);

      await context.env.DB
        .prepare(`
          UPDATE users
          SET full_name = ?, email = ?, phone = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(full_name, email, phone || null, password_hash, userId)
        .run();
    } else {
      await context.env.DB
        .prepare(`
          UPDATE users
          SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(full_name, email, phone || null, userId)
        .run();
    }

    const user = await context.env.DB
      .prepare(`
        SELECT id, full_name, email, phone, created_at, updated_at
        FROM users
        WHERE id = ?
      `)
      .bind(userId)
      .first();

    return Response.json({ success: true, user });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}