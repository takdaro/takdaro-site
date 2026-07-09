export async function onRequestGet(context) {
  const result = await context.env.DB
    .prepare('SELECT COUNT(*) as count FROM users')
    .first();

  return Response.json({ ok: true, result });
}