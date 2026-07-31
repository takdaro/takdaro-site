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

async function getShippingCost(db, province, city, subtotal = 0) {
  const normalizedProvince = normalizeText(province);
  const normalizedCity = normalizeText(city);

  // ✅ ابتدا هزینه ارسال را از دیتابیس بخوان (روش ارسال و هزینه)
  let cost = await db.prepare(`
    SELECT 
      sc.id,
      sc.province,
      sc.city,
      sc.shipping_method_id,
      sc.cost_type,
      sc.cost_amount,
      sc.extra_cost,
      sc.delivery_time,
      sc.is_active,
      sm.id as method_id,
      sm.name as method_name,
      sm.slug as method_slug,
      sm.default_cost,
      sm.delivery_time as method_delivery_time
    FROM shipping_costs sc
    INNER JOIN shipping_methods sm ON sm.id = sc.shipping_method_id
    WHERE sc.province = ? AND sc.city = ? AND sc.is_active = 1 AND sm.is_active = 1
    LIMIT 1
  `).bind(normalizedProvince, normalizedCity).first();

  // ✅ اگر هزینه برای شهر پیدا نشد، از هزینه پیش‌فرض استان استفاده کن
  if (!cost) {
    cost = await db.prepare(`
      SELECT 
        sc.id,
        sc.province,
        sc.city,
        sc.shipping_method_id,
        sc.cost_type,
        sc.cost_amount,
        sc.extra_cost,
        sc.delivery_time,
        sc.is_active,
        sm.id as method_id,
        sm.name as method_name,
        sm.slug as method_slug,
        sm.default_cost,
        sm.delivery_time as method_delivery_time
      FROM shipping_costs sc
      INNER JOIN shipping_methods sm ON sm.id = sc.shipping_method_id
      WHERE sc.province = ? AND sc.city = 'default' AND sc.is_active = 1 AND sm.is_active = 1
      LIMIT 1
    `).bind(normalizedProvince).first();
  }

  // ✅ اگر هیچ هزینه‌ای پیدا نشد، خطا برگردان
  if (!cost) {
    return {
      success: false,
      message: "هزینه ارسال برای این شهر تعیین نشده است."
    };
  }

  // محاسبه هزینه نهایی
  const baseCost = cost.default_cost || 0;
  const extraCost = cost.extra_cost || 0;
  let finalCost = baseCost + extraCost;
  let deliveryTime = cost.delivery_time || cost.method_delivery_time || "نامشخص";

  // بررسی ارسال رایگان
  let isFree = false;
  const freeThreshold = await db.prepare(`
    SELECT min_order_amount
    FROM shipping_free_thresholds
    WHERE shipping_method_id = ? AND is_active = 1
    ORDER BY min_order_amount ASC
    LIMIT 1
  `).bind(cost.method_id).first();

  if (freeThreshold && subtotal >= normalizeNumber(freeThreshold.min_order_amount)) {
    finalCost = 0;
    isFree = true;
  }

  return {
    success: true,
    shipping: {
      method_id: cost.method_id,
      method_name: cost.method_name,
      method_slug: cost.method_slug,
      province: cost.province,
      city: cost.city,
      cost_type: cost.cost_type || "fixed",
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