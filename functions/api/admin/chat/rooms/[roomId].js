import { requireAdmin } from "../../../../lib/admin";
async function forward(context, method) {
  const auth = await requireAdmin(context); if (!auth.ok) return auth.response;
  const token = context.env.CHAT_ADMIN_TOKEN; if (!token) return Response.json({ error: "chat_api_not_configured" }, { status: 503 });
  const roomId = encodeURIComponent(context.params.roomId);
  const body = method === "POST" ? await context.request.text() : undefined;
  const response = await fetch(`https://chat.takdaro.com/admin/rooms/${roomId}`, { method, body, headers: { "x-chat-admin-token": token, "content-type": "application/json" } });
  return new Response(await response.text(), { status: response.status, headers: { "content-type": "application/json; charset=utf-8" } });
}
export const onRequestGet = context => forward(context, "GET");
export const onRequestPost = context => forward(context, "POST");
export const onRequestDelete = context => forward(context, "DELETE");
