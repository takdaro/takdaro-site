import { getMobileUser, mobileUnauthorized } from "../../../lib/mobile-auth";

export async function onRequestGet(context) {
  const auth = await getMobileUser(context);
  if (!auth.ok) return mobileUnauthorized(auth.reason);
  const role = String(auth.user?.role || "").trim().toLowerCase();
  if (role !== "admin" && role !== "super_admin") return Response.json({ success: false, error: "forbidden" }, { status: 403 });

  const token = context.env.CHAT_ADMIN_TOKEN;
  if (!token) return Response.json({ success: false, error: "chat_api_not_configured" }, { status: 503 });
  try {
    const base = context.env.CHAT_WORKER_URL || "https://chat.takdaro.com";
    const response = await fetch(`${base}/admin/rooms`, {
      headers: { "x-chat-admin-token": token, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ success: false, error: "chat_service_unavailable" }, { status: 502 });
  }
}
