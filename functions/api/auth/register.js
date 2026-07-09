async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const full_name = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!full_name || !email || !password) {
      return Response.json(
        { success: false, error: "full_name, email, password required" },
        { status: 400 }
      );
    }

    const password_hash = await sha256(password);

    const result = await context.env.DB
      .prepare(
        "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)"
      )
      .bind(full_name, email, password_hash)
      .run();

    return Response.json({
      success: true,
      inserted: result.success === true,
      id: result.meta?.last_row_id ?? null
    });
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