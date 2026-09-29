export async function onRequestPost(context) {
  const body = await context.request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token : "";
  const parts = token.split(".");
  if (parts.length !== 4 || token.length > 512) return Response.json({ success: false }, { status: 401 });
  const raw = parts.slice(0, 3).join('.');
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  const hash = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  if (hash !== parts[3]) return Response.json({ success: false }, { status: 401 });
  const row = await context.env.DB.prepare(`SELECT t.site_user_id, t.expires_at, t.used_at, u.full_name, u.phone, u.email FROM chat_identity_tokens t JOIN users u ON u.id=t.site_user_id WHERE t.token_hash=?`).bind(hash).first();
  if (!row || row.used_at || Date.parse(row.expires_at) <= Date.now()) return Response.json({ success: false }, { status: 401 });
  const consumed = await context.env.DB.prepare(`UPDATE chat_identity_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=? AND used_at IS NULL AND expires_at > ?`).bind(hash, new Date().toISOString()).run();
  if (consumed.meta?.changes !== 1) return Response.json({ success: false }, { status: 401 });
  return Response.json({ success: true, user: { id: row.site_user_id, fullName: row.full_name, phone: row.phone, email: row.email } }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "https://chat.takdaro.com" } });
}
