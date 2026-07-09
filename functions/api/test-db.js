export async function onRequestGet(context) {
  try {
    return Response.json({
      ok: true,
      hasDB: !!context.env.DB,
      keys: Object.keys(context.env || {})
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}