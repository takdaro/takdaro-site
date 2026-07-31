// ============================================
// API دریافت لیست استان‌ها و شهرها (داینامیک از دیتابیس)
// ============================================

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestGet(context) {
  try {
    // دریافت همه شهرهای موجود از دیتابیس
    const result = await context.env.DB.prepare(`
      SELECT DISTINCT province, city 
      FROM shipping_costs 
      WHERE is_active = 1
      ORDER BY province, city ASC
    `).all();

    const rows = Array.isArray(result?.results) ? result.results : [];
    
    // ساخت آبجکت استان‌ها و شهرها
    const provinces = {};
    for (const row of rows) {
      const province = row.province || "نامشخص";
      const city = row.city || "";
      if (!provinces[province]) {
        provinces[province] = [];
      }
      if (city && !provinces[province].includes(city)) {
        provinces[province].push(city);
      }
    }

    // اگر دیتابیس خالی بود، از لیست ثابت استفاده کن (فال‌بک)
    if (Object.keys(provinces).length === 0) {
      const fallbackData = {
        "تهران": ["تهران", "کرج", "فردیس", "رودهن", "بومهن"],
        "اصفهان": ["اصفهان", "کاشان", "نجف‌آباد"],
        "فارس": ["شیراز", "مرودشت", "جهرم"],
        "خراسان رضوی": ["مشهد", "نیشابور", "سبزوار"],
        "آذربایجان شرقی": ["تبریز", "مراغه", "مرند"]
      };
      
      return json({
        success: true,
        provinces: fallbackData,
        provinceList: Object.keys(fallbackData)
      });
    }

    return json({
      success: true,
      provinces: provinces,
      provinceList: Object.keys(provinces)
    });
  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}