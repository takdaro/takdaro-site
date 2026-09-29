import { getMobileUser, mobileUnauthorized } from "../../../../lib/mobile-auth";

async function forward(context, method) {
  const auth = await getMobileUser(context);
  if (!auth.ok) return mobileUnauthorized(auth.reason);
  const role = String(auth.user?.role || "").trim().toLowerCase();
  if (role !== "admin" && role !== "super_admin") return Response.json({ success: false, error: "forbidden" }, { status: 403 });

  const token = context.env.CHAT_ADMIN_TOKEN;
  if (!token) return Response.json({ success: false, error: "chat_api_not_configured" }, { status: 503 });
  const roomId = String(context.params.roomId || "");
  if (!roomId || roomId.length > 200) return Response.json({ success: false, error: "invalid_room_id" }, { status: 400 });

  try {
    const base = context.env.CHAT_WORKER_URL || "https://chat.takdaro.com";
    const response = await fetch(`${base}/admin/rooms/${encodeURIComponent(roomId)}`, {
      method,
      ...(method === "POST" ? { body: await context.request.text() } : {}),
      headers: { "x-chat-admin-token": token, "content-type": "application/json", Accept: "application/json" },
      signal: AbortSignal.timeout(method === "DELETE" ? 120000 : 30000),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ success: false, error: "chat_service_unavailable" }, { status: 502 });
  }
}

export const onRequestGet = (context) => forward(context, "GET");
export const onRequestPost = (context) => forward(context, "POST");
export const onRequestDelete = (context) => forward(context, "DELETE");
