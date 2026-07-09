export async function onRequestGet(context) {
  try {
    const result = await context.env.DB
      .prepare("SELECT COUNT(*) AS count FROM users")
      .first();

    return Response.json({
      ok: true,
      hasDb: !!context.env.DB,
      result,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        hasDb: !!context.env.DB,
        error: error.message,
      },
      { status: 500 }
    );
  }
}