export async function onRequestGet(context) {
  try {
    const result = await context.env.DB.prepare(`SELECT setting_key, setting_value FROM delivery_settings WHERE setting_key IN ('checkout_placement','checkout_message')`).all();
    const settings = Object.fromEntries((result.results || []).map((row) => [row.setting_key, row.setting_value]));
    return Response.json({ success: true, settings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
}
