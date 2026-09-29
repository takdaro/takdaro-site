function cookieValue(request, key) {
  const part = (request.headers.get("cookie") || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${key}=`));

  return part ? decodeURIComponent(part.slice(key.length + 1)) : null;
}

export async function onRequestPost(context) {
  const sessionId = cookieValue(context.request, "session_id");
  if (!sessionId) return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
  const user = await context.env.DB.prepare(`SELECT users.id, users.full_name, users.phone, users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=?`).bind(sessionId).first();
  if (!user) return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
  const expires = Date.now() + 2 * 60 * 1000;
  const raw = `${crypto.randomUUID()}.${user.id}.${expires}`;
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  const hash = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  await context.env.DB.prepare(`INSERT INTO chat_identity_tokens(token_hash,site_user_id,expires_at) VALUES(?,?,?)`).bind(hash, user.id, new Date(expires).toISOString()).run();
  return Response.json({ success: true, token: `${raw}.${hash}`, expiresAt: expires, user: { id: user.id, fullName: user.full_name, phone: user.phone, email: user.email } }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "https://chat.takdaro.com", "Access-Control-Allow-Credentials": "true" } });
}
