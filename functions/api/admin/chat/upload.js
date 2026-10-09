import { requireAdmin } from "../../../lib/admin";
export async function onRequestPost(context) {
  const auth = await requireAdmin(context); if (!auth.ok) return auth.response;
  const token = context.env.CHAT_ADMIN_TOKEN; if (!token) return Response.json({ error: "chat_api_not_configured" }, { status: 503 });
  const contentType = context.request.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/")) return Response.json({ error: "image_required" }, { status: 415 });
  if (Number(context.request.headers.get("content-length")) > 20 * 1024 * 1024) return Response.json({ error: "image_too_large" }, { status: 413 });
  const file = await context.request.arrayBuffer();
  if (file.byteLength > 20 * 1024 * 1024) return Response.json({ error: "image_too_large", maxBytes: 20 * 1024 * 1024 }, { status: 413 });
  if (!file.byteLength) return Response.json({ error: "empty_image" }, { status: 400 });
  try {
  const response = await fetch("https://chat.takdaro.com/upload", { method: "POST", body: file, headers: { "x-chat-admin-token": token, "x-file-name": context.request.headers.get("x-file-name") || "admin-image", "content-type": contentType }, signal: AbortSignal.timeout(120000) });
  const raw = await response.text();
  if (!response.ok) return new Response(raw, { status: response.status, headers: { "content-type": "application/json" } });
  try {
    const saved = JSON.parse(raw);
    if (saved.path) {
      const image = await fetch(`https://chat.takdaro.com/image-url?path=${encodeURIComponent(saved.path)}`, { headers: { 'x-chat-admin-token': token }, signal: AbortSignal.timeout(30000) });
      if (image.ok) {
        const signed = await image.json();
        if (typeof signed.url === "string" && signed.url.startsWith("https://")) return Response.json({ ...saved, url: signed.url });
      }
    }
  } catch {}
  return Response.json({ error: "image_url_failed" }, { status: 502 });
  } catch {
    return Response.json({ error: "upload_unavailable" }, { status: 502 });
  }
}
