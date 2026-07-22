function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  if (!target) return null;
  return target.slice(key.length + 1);
}

export async function onRequestGet(context) {
  try {
    const cookieString = context.request.headers.get("Cookie") || "";
    const sessionId = getCookie(cookieString, "session_id");

    if (!sessionId) {
      return Response.json({ success: false, user: null }, { status: 401 });
    }

    const user = await context.env.DB
      .prepare(`
        SELECT
          users.id,
          users.full_name,
          users.phone,
          users.email,
          users.role,
          users.wallet_balance,
          users.created_at,
          users.updated_at
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.id = ?
      `)
      .bind(sessionId)
      .first();

    if (!user) {
      return Response.json({ success: false, user: null }, { status: 401 });
    }

    return Response.json({
      success: true,
      user
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