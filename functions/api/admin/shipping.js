// ============================================
// API مدیریت حمل‌ونقل (فقط ادمین)
// ============================================

function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

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

async function getCurrentUser(context) {
  const cookieString = context.request.headers.get("cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");

  if (!sessionId) return null;

  return await context.env.DB.prepare(`
    SELECT id, full_name, email, phone, role
    FROM users
    WHERE id = (SELECT user_id FROM sessions WHERE id = ? LIMIT 1)
    LIMIT 1
  `).bind(sessionId).first();
}

function isAdmin(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "admin" || role === "super_admin";
}

// ============================================
// GET - دریافت روش‌های حمل‌ونقل
// ============================================
export async function onRequestGet(context) {
  try {
    const user = await getCurrentUser(context);

    if (!user || !isAdmin(user)) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

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
          delivery_time, 
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
          sc.delivery_time,
          sc.is_active,
          sm.name as method_name,
          sm.slug as method_slug,
          sm.default_cost
        FROM shipping_costs sc
        INNER JOIN shipping_methods sm ON sm.id = sc.shipping_method_id
        WHERE sc.province = ? AND sc.city = ?
        ORDER BY sm.sort_order ASC
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
    const user = await getCurrentUser(context);

    if (!user || !isAdmin(user)) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

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
      const delivery_time = normalizeText(body.delivery_time);
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
        method: { id: newId, name, slug, description, delivery_time, default_cost, is_active, sort_order }
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
      const delivery_time = normalizeText(body.delivery_time);
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

      return json({
        success: true,
        message: "روش حمل‌ونقل با موفقیت به‌روزرسانی شد."
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
    // ذخیره هزینه ارسال (با پشتیبانی از extra_cost)
    // ============================================
    if (action === "save_cost") {
      const province = normalizeText(body.province);
      const city = normalizeText(body.city);
      const shipping_method_id = normalizeNumber(body.shipping_method_id);
      const cost_type = body.cost_type || "fixed";
      const cost_amount = normalizeNumber(body.cost_amount);
      const extra_cost = normalizeNumber(body.extra_cost);
      const delivery_time = normalizeText(body.delivery_time);
      const is_active = body.is_active === true || body.is_active === "true" ? 1 : 0;

      if (!province || !city || !shipping_method_id) {
        return json({ success: false, error: "province_city_method_required" }, 400);
      }

      const method = await context.env.DB.prepare(`
        SELECT id, default_cost FROM shipping_methods WHERE id = ?
      `).bind(shipping_method_id).first();

      if (!method) {
        return json({ success: false, error: "method_not_found" }, 404);
      }

      // محاسبه cost_amount نهایی = هزینه ثابت روش + extra_cost
      const defaultCost = method.default_cost || 0;
      const finalCost = defaultCost + extra_cost;

      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_costs 
        WHERE province = ? AND city = ? AND shipping_method_id = ?
      `).bind(province, city, shipping_method_id).first();

      let result;
      if (existing) {
        result = await context.env.DB.prepare(`
          UPDATE shipping_costs
          SET cost_type = ?, cost_amount = ?, extra_cost = ?, delivery_time = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE province = ? AND city = ? AND shipping_method_id = ?
        `).bind(cost_type, finalCost, extra_cost, delivery_time, is_active, province, city, shipping_method_id).run();
      } else {
        result = await context.env.DB.prepare(`
          INSERT INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, extra_cost, delivery_time, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(province, city, shipping_method_id, cost_type, finalCost, extra_cost, delivery_time, is_active).run();
      }

      return json({
        success: true,
        message: "هزینه ارسال با موفقیت ذخیره شد.",
        extra_cost: extra_cost,
        final_cost: finalCost,
        default_cost: defaultCost
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