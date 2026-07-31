// ============================================
// API دریافت روش‌های حمل‌ونقل (عمومی)
// ============================================

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestGet(context) {
  try {
    const result = await context.env.DB.prepare(`
      SELECT 
        id, 
        name, 
        slug, 
        description, 
        delivery_time, 
        is_active, 
        sort_order
      FROM shipping_methods
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `).all();

    const methods = Array.isArray(result?.results) ? result.results : [];

    return json({
      success: true,
      methods
    });
  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}