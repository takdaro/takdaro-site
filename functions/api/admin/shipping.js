import { requireAdmin } from "../../lib/admin";
// ============================================
// API مدیریت حمل‌ونقل (فقط ادمین)
// ============================================

function json(data, status = 200) {
  return Response.json(data, { status });
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeNumber(value) {
  const normalized = String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬,،\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}


// ============================================
// GET - دریافت روش‌های حمل‌ونقل
// ============================================
export async function onRequestGet(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const url = new URL(context.request.url);
    const action = url.searchParams.get("action");

    // دریافت لیست روش‌های حمل‌ونقل
    if (action === "methods" || !action) {
      const result = await context.env.DB.prepare(`
        SELECT 
          id, 
          name, 
          slug, 
          description, 
          default_cost,
          is_active, 
          sort_order,
          created_at,
          updated_at
        FROM shipping_methods
        ORDER BY sort_order ASC, id ASC
      `).all();

      const methods = Array.isArray(result?.results) ? result.results : [];
      return json({ success: true, methods });
    }

    if (action === "locations") {
      const result = await context.env.DB.prepare(`
        SELECT DISTINCT province, city
        FROM shipping_costs
        WHERE province IS NOT NULL AND province != ''
          AND city IS NOT NULL AND city != '' AND LOWER(city) != 'default'
        ORDER BY province ASC, city ASC
      `).all();

      const provinces = {};
      for (const row of (Array.isArray(result?.results) ? result.results : [])) {
        const province = normalizeText(row.province);
        const city = normalizeText(row.city);
        if (!province || !city || city.toLowerCase() === "default") continue;
        if (!provinces[province]) provinces[province] = [];
        if (!provinces[province].includes(city)) provinces[province].push(city);
      }

      return json({ success: true, provinces });
    }

    if (action === "province-costs") {
      const province = normalizeText(url.searchParams.get("province"));
      if (!province) return json({ success: false, error: "province_required" }, 400);

      const result = await context.env.DB.prepare(`
        SELECT
          sc.id,
          sc.province,
          sc.city,
          sc.shipping_method_id,
          sc.cost_type,
          sc.cost_amount,
          sc.extra_cost,
          sc.is_active,
          sm.name as method_name,
          sm.slug as method_slug,
          sm.default_cost
        FROM shipping_costs sc
        INNER JOIN shipping_methods sm ON sm.id = sc.shipping_method_id
        WHERE sc.province = ? AND LOWER(sc.city) != 'default'
        ORDER BY sc.city ASC, sc.is_active DESC, sc.updated_at DESC, sc.id DESC, sm.sort_order ASC, sm.id ASC
      `).bind(province).all();

      return json({ success: true, costs: Array.isArray(result?.results) ? result.results : [] });
    }

    // دریافت هزینه‌های ارسال برای یک استان/شهر
    if (action === "costs") {
      const province = normalizeText(url.searchParams.get("province"));
      const city = normalizeText(url.searchParams.get("city"));

      if (!province || !city) {
        return json({ success: false, error: "province_and_city_required" }, 400);
      }

      const result = await context.env.DB.prepare(`
        SELECT 
          sc.id,
          sc.province,
          sc.city,
          sc.shipping_method_id,
          sc.cost_type,
          sc.cost_amount,
          sc.extra_cost,
          sc.is_active,
          sm.name as method_name,
          sm.slug as method_slug,
          sm.default_cost
        FROM shipping_costs sc
        INNER JOIN shipping_methods sm ON sm.id = sc.shipping_method_id
        WHERE sc.province = ? AND sc.city = ?
        ORDER BY sc.is_active DESC, sc.updated_at DESC, sc.id DESC, sm.sort_order ASC
      `).bind(province, city).all();

      const costs = Array.isArray(result?.results) ? result.results : [];
      return json({ success: true, costs });
    }

    // دریافت تنظیمات ارسال رایگان
    if (action === "free-thresholds") {
      const result = await context.env.DB.prepare(`
        SELECT 
          id,
          shipping_method_id,
          min_order_amount,
          is_active,
          created_at,
          updated_at
        FROM shipping_free_thresholds
        ORDER BY shipping_method_id ASC
      `).all();

      const thresholds = Array.isArray(result?.results) ? result.results : [];
      
      const methods = await context.env.DB.prepare(`
        SELECT id, name FROM shipping_methods WHERE is_active = 1
      `).all();
      
      const methodMap = {};
      for (const m of (Array.isArray(methods?.results) ? methods.results : [])) {
        methodMap[m.id] = m.name;
      }

      const enriched = thresholds.map(t => ({
        ...t,
        method_name: methodMap[t.shipping_method_id] || "نامشخص"
      }));

      return json({ success: true, thresholds: enriched });
    }

    return json({ success: false, error: "invalid_action" }, 400);
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

// ============================================
// POST - مدیریت روش‌های حمل‌ونقل
// ============================================
export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await context.request.json().catch(() => null);
    if (!body) {
      return json({ success: false, error: "invalid_payload" }, 400);
    }

    const action = body.action || "create_method";

    // ============================================
    // ایجاد روش حمل‌ونقل جدید (با default_cost)
    // ============================================
    if (action === "create_method") {
      const name = normalizeText(body.name);
      const slug = normalizeText(body.slug).toLowerCase().replace(/\s+/g, "-");
      const description = normalizeText(body.description);
      const delivery_time = "";
      const default_cost = normalizeNumber(body.default_cost);
      const is_active = body.is_active === true || body.is_active === "true" ? 1 : 0;
      const sort_order = normalizeNumber(body.sort_order);

      if (!name || !slug) {
        return json({ success: false, error: "name_and_slug_required" }, 400);
      }

      // بررسی تکراری نبودن slug
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE slug = ?
      `).bind(slug).first();

      if (existing) {
        return json({ success: false, error: "slug_already_exists" }, 400);
      }

      const result = await context.env.DB.prepare(`
        INSERT INTO shipping_methods (name, slug, description, delivery_time, default_cost, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(name, slug, description, delivery_time, default_cost, is_active, sort_order).run();

      const newId = result.meta?.last_row_id || null;

      return json({
        success: true,
        message: "روش حمل‌ونقل با موفقیت ایجاد شد.",
        method: { id: newId, name, slug, description, default_cost, is_active, sort_order }
      });
    }

    // ============================================
    // ویرایش روش حمل‌ونقل (با default_cost)
    // ============================================
    if (action === "update_method") {
      const id = normalizeNumber(body.id);
      const name = normalizeText(body.name);
      const slug = normalizeText(body.slug).toLowerCase().replace(/\s+/g, "-");
      const description = normalizeText(body.description);
      const delivery_time = "";
      const default_cost = normalizeNumber(body.default_cost);
      const is_active = body.is_active === true || body.is_active === "true" ? 1 : 0;
      const sort_order = normalizeNumber(body.sort_order);

      if (!id || !name || !slug) {
        return json({ success: false, error: "id_name_slug_required" }, 400);
      }

      // بررسی وجود روش
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE id = ?
      `).bind(id).first();

      if (!existing) {
        return json({ success: false, error: "method_not_found" }, 404);
      }

      // بررسی تکراری نبودن slug (به جز خودش)
      const duplicate = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE slug = ? AND id != ?
      `).bind(slug, id).first();

      if (duplicate) {
        return json({ success: false, error: "slug_already_exists" }, 400);
      }

      await context.env.DB.prepare(`
        UPDATE shipping_methods
        SET name = ?, slug = ?, description = ?, delivery_time = ?, default_cost = ?, is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(name, slug, description, delivery_time, default_cost, is_active, sort_order, id).run();

      const savedMethod = await context.env.DB.prepare(`
        SELECT id, name, slug, description, default_cost, is_active, sort_order
        FROM shipping_methods WHERE id = ?
      `).bind(id).first();

      if (!savedMethod || Number(savedMethod.default_cost) !== default_cost) {
        return json({ success: false, error: "method_update_not_persisted" }, 500);
      }

      return json({
        success: true,
        message: "روش حمل‌ونقل با موفقیت به‌روزرسانی شد.",
        method: savedMethod
      });
    }

    // ============================================
    // حذف روش حمل‌ونقل
    // ============================================
    if (action === "delete_method") {
      const id = normalizeNumber(body.id);

      if (!id) {
        return json({ success: false, error: "id_required" }, 400);
      }

      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE id = ?
      `).bind(id).first();

      if (!existing) {
        return json({ success: false, error: "method_not_found" }, 404);
      }

      await context.env.DB.prepare(`
        DELETE FROM shipping_methods WHERE id = ?
      `).bind(id).run();

      return json({
        success: true,
        message: "روش حمل‌ونقل با موفقیت حذف شد."
      });
    }

    // ============================================
    // حذف هزینه ارسال
    // ============================================
    if (action === "delete_cost") {
      const cost_id = normalizeNumber(body.cost_id);

      if (!cost_id) {
        return json({ success: false, error: "cost_id_required" }, 400);
      }

      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_costs WHERE id = ?
      `).bind(cost_id).first();

      if (!existing) {
        return json({ success: false, error: "cost_not_found" }, 404);
      }

      await context.env.DB.prepare(`
        DELETE FROM shipping_costs WHERE id = ?
      `).bind(cost_id).run();

      return json({
        success: true,
        message: "هزینه ارسال با موفقیت حذف شد."
      });
    }

    // ============================================
    // ذخیره هزینه ارسال ثابت یا متغیر
    // ============================================
    if (action === "save_cost") {
      const province = normalizeText(body.province);
      const city = normalizeText(body.city);
      const shipping_method_id = normalizeNumber(body.shipping_method_id);
      const cost_type = body.cost_type || "fixed";
      const costAmountProvided = body.cost_amount !== null && body.cost_amount !== undefined && String(body.cost_amount).trim() !== "";
      const cost_amount = normalizeNumber(body.cost_amount);
      const extra_cost = normalizeNumber(body.extra_cost);
      const delivery_time = "";
      const is_active = body.is_active === true || body.is_active === "true" ? 1 : 0;

      if (!province || !city || !shipping_method_id) {
        return json({ success: false, error: "province_city_method_required" }, 400);
      }
      if (cost_type !== "fixed" && cost_type !== "extra") {
        return json({ success: false, error: "invalid_cost_type" }, 400);
      }

      const method = await context.env.DB.prepare(`
        SELECT id, default_cost FROM shipping_methods WHERE id = ?
      `).bind(shipping_method_id).first();

      if (!method) {
        return json({ success: false, error: "method_not_found" }, 404);
      }

      const defaultCost = method.default_cost || 0;
      const finalCost = cost_type === "fixed" ? (costAmountProvided ? cost_amount : defaultCost) : defaultCost + extra_cost;
      const savedExtraCost = cost_type === "extra" ? extra_cost : 0;

      await context.env.DB.batch([
        context.env.DB.prepare(`
          UPDATE shipping_costs
          SET is_active = 0, updated_at = CURRENT_TIMESTAMP
          WHERE province = ? AND city = ? AND shipping_method_id != ? AND is_active = 1
        `).bind(province, city, shipping_method_id),
        context.env.DB.prepare(`
          INSERT INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, extra_cost, delivery_time, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(province, city, shipping_method_id) DO UPDATE SET
            cost_type = excluded.cost_type,
            cost_amount = excluded.cost_amount,
            extra_cost = excluded.extra_cost,
            delivery_time = excluded.delivery_time,
            is_active = excluded.is_active,
            updated_at = CURRENT_TIMESTAMP
        `).bind(province, city, shipping_method_id, cost_type, finalCost, savedExtraCost, delivery_time, is_active)
      ]);

      return json({
        success: true,
        message: "هزینه ارسال با موفقیت ذخیره شد.",
        extra_cost: savedExtraCost,
        final_cost: finalCost,
        default_cost: defaultCost
      });
    }

    // اعمال روش و هزینهٔ ثابت/متغیر روی یک یا چند شهر به‌صورت یک عملیات دسته‌ای
    if (action === "bulk_save_city_costs") {
      const province = normalizeText(body.province);
      const shipping_method_id = normalizeNumber(body.shipping_method_id);
      const cost_type = body.cost_type;
      const amount = normalizeNumber(body.amount);
      const cities = Array.isArray(body.cities)
        ? [...new Set(body.cities.map(normalizeText).filter((city) => city && city.toLowerCase() !== "default"))]
        : [];

      if (!province || !shipping_method_id || !cities.length) {
        return json({ success: false, error: "province_method_cities_required" }, 400);
      }
      if (cities.length > 100) {
        return json({ success: false, error: "too_many_cities" }, 400);
      }
      if (cost_type !== "fixed" && cost_type !== "extra") {
        return json({ success: false, error: "invalid_cost_type" }, 400);
      }

      const method = await context.env.DB.prepare(`
        SELECT id, name, default_cost FROM shipping_methods WHERE id = ?
      `).bind(shipping_method_id).first();
      if (!method) return json({ success: false, error: "method_not_found" }, 404);

      const methodBaseCost = Number(method.default_cost || 0);
      if (methodBaseCost <= 0) {
        return json({ success: false, error: "method_base_cost_required" }, 400);
      }

      const extra_cost = cost_type === "extra" ? amount : 0;
      const cost_amount = cost_type === "fixed"
        ? methodBaseCost
        : methodBaseCost + amount;
      const statements = cities.flatMap((city) => [
        context.env.DB.prepare(`
          UPDATE shipping_costs
          SET is_active = 0, updated_at = CURRENT_TIMESTAMP
          WHERE province = ? AND city = ? AND shipping_method_id != ? AND is_active = 1
        `).bind(province, city, shipping_method_id),
        context.env.DB.prepare(`
          INSERT INTO shipping_costs
            (province, city, shipping_method_id, cost_type, cost_amount, extra_cost, delivery_time, is_active)
          VALUES (?, ?, ?, ?, ?, ?, '', 1)
            ON CONFLICT(province, city, shipping_method_id) DO UPDATE SET
              cost_type = excluded.cost_type,
              cost_amount = excluded.cost_amount,
              extra_cost = excluded.extra_cost,
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP
        `).bind(province, city, shipping_method_id, cost_type, cost_amount, extra_cost)
      ]);

      await context.env.DB.batch(statements);

      return json({
        success: true,
        message: `روش «${method.name}» و هزینهٔ ${cost_type === "fixed" ? "ثابت" : "متغیر"} برای ${cities.length} شهر ذخیره شد.`,
        updated_count: cities.length,
        cost_amount,
        extra_cost
      });
    }

    // ============================================
    // ✅ اضافه کردن شهر جدید به استان
    // ============================================
    if (action === "add_city") {
      const province = normalizeText(body.province);
      const city = normalizeText(body.city);

      if (!province || !city) {
        return json({ success: false, error: "province_and_city_required" }, 400);
      }

      // بررسی وجود استان در لیست استان‌ها
      // شهر جدید را در جدول shipping_costs ایجاد می‌کنیم با روش پیش‌فرض
      const defaultMethod = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE slug = 'freight' AND is_active = 1 LIMIT 1
      `).first();

      if (!defaultMethod) {
        return json({ success: false, error: "default_method_not_found" }, 404);
      }

      // بررسی اینکه آیا این شهر قبلاً برای این استان وجود دارد
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_costs 
        WHERE province = ? AND city = ?
        LIMIT 1
      `).bind(province, city).first();

      if (existing) {
        return json({ success: false, error: "city_already_exists" }, 400);
      }

      // ایجاد رکورد جدید با هزینه مازاد 0
      const result = await context.env.DB.prepare(`
        INSERT INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, extra_cost, delivery_time, is_active)
        VALUES (?, ?, ?, 'extra', 0, 0, '', 1)
      `).bind(province, city, defaultMethod.id).run();

      return json({
        success: true,
        message: "شهر با موفقیت اضافه شد.",
        city: city,
        province: province
      });
    }

    // ============================================
    // ✅ حذف شهر از استان
    // ============================================
    if (action === "delete_city") {
      const province = normalizeText(body.province);
      const city = normalizeText(body.city);

      if (!province || !city) {
        return json({ success: false, error: "province_and_city_required" }, 400);
      }

      // حذف تمام رکوردهای هزینه برای این شهر
      await context.env.DB.prepare(`
        DELETE FROM shipping_costs 
        WHERE province = ? AND city = ?
      `).bind(province, city).run();

      return json({
        success: true,
        message: "شهر با موفقیت حذف شد."
      });
    }

    // ============================================
    // ذخیره تنظیمات ارسال رایگان
    // ============================================
    if (action === "save_free_threshold") {
      const shipping_method_id = normalizeNumber(body.shipping_method_id);
      const min_order_amount = normalizeNumber(body.min_order_amount);
      const is_active = body.is_active === true || body.is_active === "true" ? 1 : 0;

      if (!shipping_method_id || !min_order_amount) {
        return json({ success: false, error: "method_and_amount_required" }, 400);
      }

      const method = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE id = ?
      `).bind(shipping_method_id).first();

      if (!method) {
        return json({ success: false, error: "method_not_found" }, 404);
      }

      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_free_thresholds WHERE shipping_method_id = ?
      `).bind(shipping_method_id).first();

      if (existing) {
        await context.env.DB.prepare(`
          UPDATE shipping_free_thresholds
          SET min_order_amount = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE shipping_method_id = ?
        `).bind(min_order_amount, is_active, shipping_method_id).run();
      } else {
        await context.env.DB.prepare(`
          INSERT INTO shipping_free_thresholds (shipping_method_id, min_order_amount, is_active)
          VALUES (?, ?, ?)
        `).bind(shipping_method_id, min_order_amount, is_active).run();
      }

      return json({
        success: true,
        message: "تنظیمات ارسال رایگان با موفقیت ذخیره شد."
      });
    }

    return json({ success: false, error: "invalid_action" }, 400);
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}
