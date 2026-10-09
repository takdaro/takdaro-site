import { getMobileUser, mobileUnauthorized } from "../../../lib/mobile-auth";

export async function onRequestPost(context) {
  const auth = await getMobileUser(context);
  if (!auth.ok) return mobileUnauthorized(auth.reason);
  const role = String(auth.user?.role || "").trim().toLowerCase();
  if (role !== "admin" && role !== "super_admin") return Response.json({ success: false, error: "forbidden" }, { status: 403 });
  if (!context.env.CHAT_ADMIN_TOKEN) return Response.json({ success: false, error: "chat_api_not_configured" }, { status: 503 });

  const requestedType = context.request.headers.get("content-type") || "";
  const fileName = context.request.headers.get("x-file-name") || "";
  const extensionType = /\.png$/i.test(fileName) ? "image/png" : /\.webp$/i.test(fileName) ? "image/webp" : /\.gif$/i.test(fileName) ? "image/gif" : /\.(jpe?g|heic|heif)$/i.test(fileName) ? "image/jpeg" : "";
  const contentType = requestedType.toLowerCase().startsWith("image/") ? requestedType : extensionType;
  if (!contentType) return Response.json({ success: false, error: "image_required" }, { status: 415 });
  if (Number(context.request.headers.get("content-length") || 0) > 20 * 1024 * 1024) return Response.json({ success: false, error: "image_too_large" }, { status: 413 });
  const file = await context.request.arrayBuffer();
  if (!file.byteLength) return Response.json({ success: false, error: "empty_image" }, { status: 400 });
  if (file.byteLength > 20 * 1024 * 1024) return Response.json({ success: false, error: "image_too_large" }, { status: 413 });

  try {
    const base = context.env.CHAT_WORKER_URL || "https://chat.takdaro.com";
    const uploaded = await fetch(`${base}/upload`, {
      method: "POST",
      body: file,
      headers: {
        "x-chat-admin-token": context.env.CHAT_ADMIN_TOKEN,
        "content-type": contentType,
        "x-file-name": fileName || "admin-image",
      },
      signal: AbortSignal.timeout(120000),
    });
    const raw = await uploaded.text();
    if (!uploaded.ok) return new Response(raw, { status: uploaded.status, headers: { "content-type": "application/json; charset=utf-8" } });
    const saved = JSON.parse(raw);
    if (!saved?.path) return Response.json({ success: false, error: "image_upload_failed" }, { status: 502 });

    const signed = await fetch(`${base}/image-url?path=${encodeURIComponent(saved.path)}`, {
      headers: { "x-chat-admin-token": context.env.CHAT_ADMIN_TOKEN },
      signal: AbortSignal.timeout(30000),
    });
    const image = await signed.json().catch(() => null);
    if (!signed.ok || typeof image?.url !== "string" || !image.url.startsWith("https://")) {
      return Response.json({ success: false, error: "image_url_failed" }, { status: 502 });
    }
    return Response.json({ ...saved, url: image.url }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ success: false, error: "upload_unavailable" }, { status: 502 });
  }
}
