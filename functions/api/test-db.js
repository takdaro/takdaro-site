export async function onRequestGet(context) {
  try {
    const row = await context.env.DB.prepare("SELECT 1 as ok").first();

    return Response.json({
      success: true,
      db: true,
      row
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        db: !!context.env.DB,
        error: String(error?.message || error)
      },
      { status: 500 }
    );
  }
}