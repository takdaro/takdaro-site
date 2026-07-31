// ============================================
// API محاسبه هزینه ارسال
// ============================================

function json(data, status = 200) {
  return Response.json(data, { status });
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

// ✅ گروه تهران و شهرهای نزدیک
const TEHRAN_GROUP = ["تهران", "کرج", "فردیس", "رودهن", "بومهن"];

// ✅ تعیین slug روش ارسال بر اساس شهر
function getShippingMethodSlug(city) {
  if (TEHRAN_GROUP.includes(city)) {
    return "motor"; // اسنپ‌باکس
  } else {
    return "freight"; // باربری
  }
}

async function getShippingCost(db, province, city, subtotal = 0) {
  const normalizedProvince = normalizeText(province);
  const normalizedCity = normalizeText(city);

  // ✅ تعیین روش ارسال بر اساس شهر
  const methodSlug = getShippingMethodSlug(normalizedCity);

  // ✅ پیدا کردن روش ارسال از دیتابیس
  const method = await db.prepare(`
    SELECT 
      id, 
      name, 
      slug, 
      description, 
      delivery_time, 
      default_cost,
      is_active
    FROM shipping_methods
    WHERE slug = ? AND is_active = 1
    LIMIT 1
  `).bind(methodSlug).first();

  if (!method) {
    return {
      success: false,
      message: "روش ارسال برای این شهر فعال نیست."
    };
  }

  // ✅ پیدا کردن هزینه ارسال برای این شهر و روش
  let cost = await db.prepare(`
    SELECT 
      id,
      province,
      city,
      cost_type,
      cost_amount,
      extra_cost,
      delivery_time,
      is_active
    FROM shipping_costs
    WHERE province = ? AND city = ? AND shipping_method_id = ? AND is_active = 1
    LIMIT 1
  `).bind(normalizedProvince, normalizedCity, method.id).first();

  // ✅ اگر هزینه برای شهر پیدا نشد، هزینه پیش‌فرض استان را بررسی کن
  if (!cost) {
    cost = await db.prepare(`
      SELECT 
        id,
        province,
        city,
        cost_type,
        cost_amount,
        extra_cost,
        delivery_time,
        is_active
      FROM shipping_costs
      WHERE province = ? AND city = 'default' AND shipping_method_id = ? AND is_active = 1
      LIMIT 1
    `).bind(normalizedProvince, method.id).first();
  }

  // ✅ اگر هیچ هزینه‌ای پیدا نشد، از default_cost روش استفاده کن
  let finalCost = method.default_cost || 0;
  let extraCost = 0;
  let deliveryTime = method.delivery_time || "نامشخص";

  if (cost) {
    extraCost = cost.extra_cost || 0;
    finalCost = method.default_cost + extraCost;
    deliveryTime = cost.delivery_time || method.delivery_time || "نامشخص";
  }

  // ✅ بررسی ارسال رایگان
  let isFree = false;
  const freeThreshold = await db.prepare(`
    SELECT min_order_amount
    FROM shipping_free_thresholds
    WHERE shipping_method_id = ? AND is_active = 1
    ORDER BY min_order_amount ASC
    LIMIT 1
  `).bind(method.id).first();

  if (freeThreshold && subtotal >= normalizeNumber(freeThreshold.min_order_amount)) {
    finalCost = 0;
    isFree = true;
  }

  return {
    success: true,
    shipping: {
      method_id: method.id,
      method_name: method.name,
      method_slug: method.slug,
      province: normalizedProvince,
      city: normalizedCity,
      cost_type: cost?.cost_type || "fixed",
      extra_cost: extraCost,
      shipping_cost: finalCost,
      is_free: isFree,
      delivery_time: deliveryTime,
      free_threshold: freeThreshold ? normalizeNumber(freeThreshold.min_order_amount) : null
    }
  };
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => null);

    if (!body) {
      return json({ success: false, error: "invalid_payload" }, 400);
    }

    const province = normalizeText(body.province);
    const city = normalizeText(body.city);
    const subtotal = normalizeNumber(body.subtotal);

    if (!province || !city) {
      return json({ success: false, error: "province_and_city_required" }, 400);
    }

    const result = await getShippingCost(context.env.DB, province, city, subtotal);

    if (!result.success) {
      return json({ success: false, error: result.message }, 404);
    }

    return json({
      success: true,
      data: result.shipping
    });
  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}