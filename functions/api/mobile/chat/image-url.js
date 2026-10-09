import { getMobileUser, mobileUnauthorized } from "../../../lib/mobile-auth";

export async function onRequestGet(context) {
  const auth = await getMobileUser(context);
  if (!auth.ok) return mobileUnauthorized(auth.reason);
  if (!["admin", "super_admin"].includes(String(auth.user?.role || "").trim().toLowerCase())) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (!context.env.CHAT_ADMIN_TOKEN) return Response.json({ error: "chat_api_not_configured" }, { status: 503 });
  const path = new URL(context.request.url).searchParams.get("path");
  if (!path || path.length > 1024 || path.startsWith("/") || path.includes("..") || /[\\\x00-\x1f]/.test(path)) {
    return Response.json({ error: "invalid_image_path" }, { status: 400 });
  }
  try {
    const base = context.env.CHAT_WORKER_URL || "https://chat.takdaro.com";
    const response = await fetch(`${base}/image-url?path=${encodeURIComponent(path)}`, {
      headers: { "x-chat-admin-token": context.env.CHAT_ADMIN_TOKEN },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return Response.json({ error: response.status === 404 ? "image_not_found" : "image_url_failed" }, { status: response.status });
    const image = await response.json();
    if (typeof image?.url !== "string" || !image.url.startsWith("https://")) return Response.json({ error: "image_url_failed" }, { status: 502 });
    return Response.json({ url: image.url }, { headers: { "cache-control": "no-store" } });
  } catch { return Response.json({ error: "image_url_unavailable" }, { status: 502 }); }
}
