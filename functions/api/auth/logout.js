function getCookie(cookieString, key) {
  if (!cookieString) return null;

  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  if (!target) return null;

  return target.slice(key.length + 1);
}

export async function onRequestPost(context) {
  try {
    const cookieString = context.request.headers.get("Cookie") || "";
    const sessionId = getCookie(cookieString, "session_id");

    if (sessionId) {
      await context.env.DB
        .prepare("DELETE FROM sessions WHERE id = ?")
        .bind(sessionId)
        .run();
    }

    const response = Response.json({
      success: true,
      message: "logged_out"
    });

    response.headers.append(
      "Set-Cookie",
      "session_id=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
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