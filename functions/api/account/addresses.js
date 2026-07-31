import { getCurrentUser } from "../../lib/admin";

function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).trim().replace(/\s+/g, "");
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

function normalizeAddressInput(body = {}) {
  return {
    type: String(body.type || "shipping").trim().toLowerCase(),
    full_name: String(body.full_name ?? body.fullname ?? "").trim(),
    address_line: String(body.address_line ?? body.addressline ?? "").trim(),
    postal_code: String(body.postal_code ?? body.postalcode ?? "").trim(),
    phone: normalizePhone(body.phone ?? ""),
    city: String(body.city ?? "").trim(),
    state: String(body.state ?? "").trim(),
    is_default: Number(body.is_default ?? body.isdefault ?? 0) === 1 ? 1 : 0
  };
}

function validateAddressInput(data) {
  if (!["shipping", "billing"].includes(data.type)) return "نوع آدرس نامعتبر است.";
  if (!data.full_name) return "نام تحویل‌گیرنده الزامی است.";
  if (!data.address_line) return "نشانی کامل الزامی است.";
  if (!data.postal_code) return "کد پستی الزامی است.";
  if (!data.phone) return "شماره تماس الزامی است.";
  if (!data.city) return "شهر الزامی است.";
  if (!data.state) return "استان الزامی است.";
  return null;
}

// ============================================
// GET - دریافت لیست آدرس‌های کاربر
// ============================================
export async function onRequestGet(context) {
  try {
    const user = await getCurrentUser(context);
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    // توجه: جدول addresses است، نه user_addresses
    const result = await context.env.DB.prepare(`
      SELECT id, user_id, type, full_name, address_line, postal_code, phone, city, state, is_default, created_at, updated_at
      FROM addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, id DESC
    `).bind(user.id).all();

    return json({ success: true, addresses: result.results || [] });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

// ============================================
// POST - ایجاد آدرس جدید
// ============================================
export async function onRequestPost(context) {
  try {
    const user = await getCurrentUser(context);
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await context.request.json();
    const data = normalizeAddressInput(body);
    const validationError = validateAddressInput(data);

    if (validationError) {
      return json({ success: false, error: validationError }, 400);
    }

    // اگر آدرس جدید به عنوان پیش‌فرض انتخاب شده، آدرس‌های قبلی را غیرپیش‌فرض کن
    if (data.is_default === 1) {
      await context.env.DB.prepare(`
        UPDATE addresses
        SET is_default = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(user.id).run();
    }

    const result = await context.env.DB.prepare(`
      INSERT INTO addresses (
        user_id, type, full_name, address_line, postal_code, phone, city, state, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      user.id,
      data.type,
      data.full_name,
      data.address_line,
      data.postal_code,
      data.phone,
      data.city,
      data.state,
      data.is_default
    ).run();

    const insertedId = result.meta?.last_row_id || null;

    const address = insertedId
      ? await context.env.DB.prepare(`
          SELECT id, user_id, type, full_name, address_line, postal_code, phone, city, state, is_default, created_at, updated_at
          FROM addresses
          WHERE id = ? AND user_id = ?
          LIMIT 1
        `).bind(insertedId, user.id).first()
      : null;

    return json({ success: true, id: insertedId, address });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

// ============================================
// PUT - ویرایش آدرس
// ============================================
export async function onRequestPut(context) {
  try {
    const user = await getCurrentUser(context);
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    const url = new URL(context.request.url);
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();

    if (!id) {
      return json({ success: false, error: "آدرس مورد نظر یافت نشد." }, 400);
    }

    const body = await context.request.json();
    const data = normalizeAddressInput(body);
    const validationError = validateAddressInput(data);

    if (validationError) {
      return json({ success: false, error: validationError }, 400);
    }

    // بررسی وجود آدرس
    const existing = await context.env.DB.prepare(`
      SELECT id FROM addresses WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();

    if (!existing) {
      return json({ success: false, error: "آدرس مورد نظر یافت نشد." }, 404);
    }

    // اگر آدرس جدید به عنوان پیش‌فرض انتخاب شده، آدرس‌های قبلی را غیرپیش‌فرض کن
    if (data.is_default === 1) {
      await context.env.DB.prepare(`
        UPDATE addresses
        SET is_default = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND id != ?
      `).bind(user.id, id).run();
    }

    await context.env.DB.prepare(`
      UPDATE addresses
      SET
        type = ?,
        full_name = ?,
        address_line = ?,
        postal_code = ?,
        phone = ?,
        city = ?,
        state = ?,
        is_default = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(
      data.type,
      data.full_name,
      data.address_line,
      data.postal_code,
      data.phone,
      data.city,
      data.state,
      data.is_default,
      id,
      user.id
    ).run();

    const updated = await context.env.DB.prepare(`
      SELECT id, user_id, type, full_name, address_line, postal_code, phone, city, state, is_default, created_at, updated_at
      FROM addresses
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `).bind(id, user.id).first();

    return json({ success: true, address: updated });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}

// ============================================
// DELETE - حذف آدرس
// ============================================
export async function onRequestDelete(context) {
  try {
    const user = await getCurrentUser(context);
    if (!user) return json({ success: false, error: "Unauthorized" }, 401);

    const url = new URL(context.request.url);
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();

    if (!id) {
      return json({ success: false, error: "آدرس مورد نظر یافت نشد." }, 400);
    }

    const existing = await context.env.DB.prepare(`
      SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();

    if (!existing) {
      return json({ success: false, error: "آدرس مورد نظر یافت نشد." }, 404);
    }

    await context.env.DB.prepare(`
      DELETE FROM addresses WHERE id = ? AND user_id = ?
    `).bind(id, user.id).run();

    // اگر آدرس حذف شده پیش‌فرض بود، یکی دیگر را پیش‌فرض کن
    if (existing.is_default === 1) {
      const nextDefault = await context.env.DB.prepare(`
        SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1
      `).bind(user.id).first();

      if (nextDefault) {
        await context.env.DB.prepare(`
          UPDATE addresses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).bind(nextDefault.id).run();
      }
    }

    return json({ success: true, message: "آدرس با موفقیت حذف شد." });
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500);
  }
}