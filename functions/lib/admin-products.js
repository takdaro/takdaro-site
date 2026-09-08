import { getCurrentRate } from "./rate";

const COLUMNS = "id, slug, name, category, price, price_label, show_price, stock_quantity, in_stock, stock_label, short_description, description, primary_image, page_url, status, created_at, updated_at, price_type, base_price, profit_type, profit_value, fixed_fee, rounding_type, rounding_method, calculated_price, price_calculated_at";

function clean(value, max = 10000) {
  return String(value ?? "").trim().slice(0, max);
}
function idOf(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}
function nullableNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}
function formatNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
async function currentUsdRate(env) {
  try {
    const rate = await getCurrentRate(env, "USD");
    return rate ? Number(rate.rate) : null;
  } catch (_) {
    return null;
  }
}

export async function getProductImages(db, productIds) {
  const imagesByProductId = new Map();
  const ids = [...new Set((productIds || []).map(idOf).filter(Boolean))];
  if (!ids.length) return imagesByProductId;

  const placeholders = ids.map(() => "?").join(", ");
  const result = await db.prepare(
    `SELECT id, product_id, image_url, alt_text, sort_order, is_primary, created_at
     FROM product_images WHERE product_id IN (${placeholders})
     ORDER BY product_id ASC, is_primary DESC, sort_order ASC, id ASC`
  ).bind(...ids).all();

  for (const row of result?.results || []) {
    const productId = Number(row.product_id);
    if (!imagesByProductId.has(productId)) imagesByProductId.set(productId, []);
    imagesByProductId.get(productId).push({
      id: Number(row.id || 0),
      image_url: row.image_url || "",
      alt_text: row.alt_text || "",
      sort_order: Number(row.sort_order || 0),
      is_primary: Number(row.is_primary) === 1,
      created_at: row.created_at || null
    });
  }
  return imagesByProductId;
}

export function adminProductFromRow(row, imagesByProductId, currentRate = null) {
  if (!row) return null;
  const productId = Number(row.id || 0);
  const images = imagesByProductId.get(productId) || [];
  const primaryImage = row.primary_image || images.find((image) => image.is_primary)?.image_url || images[0]?.image_url || "";
  const priceType = row.price_type || "fixed";
  let displayPrice = null;
  if (priceType === "rate_based") {
    if (row.calculated_price !== null && row.calculated_price !== undefined) displayPrice = Number(row.calculated_price);
    else if (Number(row.base_price) > 0 && Number(currentRate) > 0) displayPrice = Number(row.base_price) * Number(currentRate);
  } else if (row.price !== null && row.price !== undefined) displayPrice = Number(row.price);

  return {
    id: productId, slug: row.slug || "", name: row.name || "", category: row.category || "",
    price: nullableNumber(row.price), price_label: row.price_label || "تماس بگیرید",
    show_price: Number(row.show_price) === 1, stock_quantity: Math.max(0, Number(row.stock_quantity || 0)),
    in_stock: Number(row.in_stock) === 1, stock_label: row.stock_label || "",
    short_description: row.short_description || "", description: row.description || "",
    primary_image: primaryImage, page_url: row.page_url || "", status: row.status || "draft",
    created_at: row.created_at || null, updated_at: row.updated_at || null, images,
    price_type: row.price_type || "fixed", base_price: nullableNumber(row.base_price),
    profit_type: row.profit_type || "none", profit_value: nullableNumber(row.profit_value),
    fixed_fee: nullableNumber(row.fixed_fee), rounding_type: row.rounding_type || "none",
    rounding_method: row.rounding_method || "nearest", calculated_price: nullableNumber(row.calculated_price),
    price_calculated_at: row.price_calculated_at || null, display_price: displayPrice,
    display_price_formatted: displayPrice !== null ? `${formatNumber(displayPrice)} تومان` : "تماس بگیرید"
  };
}

export async function getAdminProductById(env, productId, options = {}) {
  const id = idOf(productId);
  if (!env?.DB || !id) return null;
  const row = await env.DB.prepare(`SELECT ${COLUMNS} FROM products WHERE id = ? LIMIT 1`).bind(id).first();
  if (!row) return null;
  const rate = options.currentRate === undefined ? await currentUsdRate(env) : options.currentRate;
  return adminProductFromRow(row, await getProductImages(env.DB, [id]), rate);
}

export async function getAdminProductByIdentifier(env, identifier, options = {}) {
  const value = clean(identifier, 160);
  if (!env?.DB || !value) return null;
  const id = idOf(value);
  const row = id
    ? await env.DB.prepare(`SELECT ${COLUMNS} FROM products WHERE id = ? LIMIT 1`).bind(id).first()
    : await env.DB.prepare(`SELECT ${COLUMNS} FROM products WHERE slug = ? LIMIT 1`).bind(value).first();
  if (!row) return null;
  const rate = options.currentRate === undefined ? await currentUsdRate(env) : options.currentRate;
  return adminProductFromRow(row, await getProductImages(env.DB, [Number(row.id)]), rate);
}

export async function listAdminProducts(env, filters = {}) {
  if (!env?.DB) throw new Error("database_binding_missing");
  const search = clean(filters.search, 160);
  const status = clean(filters.status, 30).toLowerCase();
  const category = clean(filters.category, 120);
  const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(filters.limit, 10) || 50));
  const where = [], bindings = [];
  if (search) {
    const like = `%${search}%`;
    where.push("(name LIKE ? OR slug LIKE ? OR category LIKE ?)");
    bindings.push(like, like, like);
  }
  if (["published", "draft", "private"].includes(status)) { where.push("status = ?"); bindings.push(status); }
  if (category) { where.push("category = ?"); bindings.push(category); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [countRow, rowsResult, categoriesResult, current_rate] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS total FROM products ${whereSql}`).bind(...bindings).first(),
    env.DB.prepare(`SELECT ${COLUMNS} FROM products ${whereSql} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`).bind(...bindings, limit, (page - 1) * limit).all(),
    env.DB.prepare("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND TRIM(category) != '' ORDER BY category COLLATE NOCASE ASC").all(),
    currentUsdRate(env)
  ]);
  const rows = rowsResult?.results || [];
  const total = Number(countRow?.total || 0);
  const images = await getProductImages(env.DB, rows.map((row) => row.id));
  return {
    page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)), current_rate,
    categories: (categoriesResult?.results || []).map((row) => row.category).filter(Boolean),
    products: rows.map((row) => adminProductFromRow(row, images, current_rate))
  };
}
