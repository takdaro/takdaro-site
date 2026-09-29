import { requireAdmin } from "../../../lib/admin";
export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.response;
  const base = context.env.CHAT_WORKER_URL || "https://chat.takdaro.com";
  if (!context.env.CHAT_ADMIN_TOKEN) return Response.json({ success: false, error: "chat_api_not_configured" }, { status: 503 });
  const response = await fetch(`${base}/admin/rooms`, { headers: { "x-chat-admin-token": context.env.CHAT_ADMIN_TOKEN } });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": "application/json; charset=utf-8" } });
}
