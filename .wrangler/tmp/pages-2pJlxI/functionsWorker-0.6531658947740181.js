var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// api/account/addresses/[id]/default.js
function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
async function getCurrentUser(request, env) {
  const sessionId = getCookie(request.headers.get("cookie"), "session_id");
  if (!sessionId) return null;
  const row = await env.DB.prepare(`
    SSELECT users.id, users.email, users.full_name, users.phone
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ?
    LIMIT 1
  `).bind(sessionId).first();
  return row || null;
}
function json(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestPost(context) {
  try {
    const user = await getCurrentUser(context.request, context.env);
    if (!user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }
    const addressId = Number(context.params.id);
    if (!addressId) {
      return json({ success: false, error: "\u0634\u0646\u0627\u0633\u0647 \u0622\u062F\u0631\u0633 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." }, 400);
    }
    const existing = await context.env.DB.prepare(`
      SELECT id
      FROM addresses
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `).bind(addressId, user.id).first();
    if (!existing) {
      return json({ success: false, error: "\u0622\u062F\u0631\u0633 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
    }
    await context.env.DB.prepare(`
      UPDATE addresses
      SET is_default = 0, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(user.id).run();
    await context.env.DB.prepare(`
      UPDATE addresses
      SET is_default = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(addressId, user.id).run();
    const address = await context.env.DB.prepare(`
      SELECT
        id,
        user_id,
        type,
        full_name,
        address_line,
        postal_code,
        phone,
        city,
        state,
        is_default,
        created_at,
        updated_at
      FROM addresses
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `).bind(addressId, user.id).first();
    return json({
      success: true,
      address
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_default = __esm({
  "api/account/addresses/[id]/default.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(getCookie, "getCookie");
    __name(getCurrentUser, "getCurrentUser");
    __name(json, "json");
    __name(onRequestPost, "onRequestPost");
  }
});

// lib/admin.js
function json2(data, status = 200) {
  return Response.json(data, { status });
}
function getHeader(request, name) {
  return request.headers.get(name) || request.headers.get(name.toLowerCase()) || request.headers.get(name.toUpperCase()) || null;
}
function getCookie2(cookieString, key) {
  if (!cookieString) return null;
  const cookies = String(cookieString).split("; ");
  const target = cookies.find((item) => item.startsWith(`${key}=`));
  return target ? target.slice(key.length + 1) : null;
}
async function ensureAdminLogsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      description TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}
async function getCurrentUser2(context) {
  const cookieString = getHeader(context.request, "Cookie") || getHeader(context.request, "cookie") || "";
  const sessionId = getCookie2(cookieString, "session_id");
  if (!sessionId) return null;
  return await context.env.DB.prepare(`
      SELECT
        users.id,
        users.full_name,
        users.email,
        users.phone,
        users.role,
        COALESCE(users.wallet_balance, 0) AS wallet_balance,
        users.created_at,
        users.updated_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
      LIMIT 1
    `).bind(sessionId).first();
}
async function requireAdmin(context) {
  const user = await getCurrentUser2(context);
  if (!user) {
    return {
      ok: false,
      user: null,
      response: json2({ success: false, error: "unauthorized" }, 401)
    };
  }
  const role = String(user.role || "").toLowerCase();
  if (!["admin", "super_admin"].includes(role)) {
    return {
      ok: false,
      user,
      response: json2({ success: false, error: "forbidden" }, 403)
    };
  }
  return { ok: true, user };
}
async function logAdminAction(context, payload = {}) {
  try {
    await ensureAdminLogsTable(context.env.DB);
    const forwardedFor = getHeader(context.request, "CF-Connecting-IP") || getHeader(context.request, "X-Forwarded-For") || "";
    const ip = String(forwardedFor).split(",")[0].trim();
    await context.env.DB.prepare(`
        INSERT INTO admin_activity_logs (
          admin_user_id,
          action,
          target_type,
          target_id,
          description,
          ip_address
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
      Number(payload.admin_user_id || 0) || null,
      String(payload.action || ""),
      String(payload.target_type || ""),
      String(payload.target_id || ""),
      String(payload.description || ""),
      ip
    ).run();
  } catch (_) {
  }
}
var init_admin = __esm({
  "lib/admin.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(json2, "json");
    __name(getHeader, "getHeader");
    __name(getCookie2, "getCookie");
    __name(ensureAdminLogsTable, "ensureAdminLogsTable");
    __name(getCurrentUser2, "getCurrentUser");
    __name(requireAdmin, "requireAdmin");
    __name(logAdminAction, "logAdminAction");
  }
});

// lib/password.js
function encoder() {
  return new TextEncoder();
}
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function deriveBits(password, salt, iterations = PBKDF2_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: DIGEST,
      salt,
      iterations
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
}
async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return ["pbkdf2", DIGEST.toLowerCase(), PBKDF2_ITERATIONS, toBase64(salt), toBase64(hash)].join("$");
}
async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  const [algorithm, digest, iterations, saltB64, hashB64] = String(storedHash).split("$");
  if (algorithm !== "pbkdf2" || digest !== DIGEST.toLowerCase()) return false;
  const salt = fromBase64(saltB64);
  const expectedHash = fromBase64(hashB64);
  const actualHash = new Uint8Array(await deriveBits(password, salt, Number(iterations)));
  return timingSafeEqual(actualHash, expectedHash);
}
var PBKDF2_ITERATIONS, SALT_LENGTH, KEY_LENGTH, DIGEST;
var init_password = __esm({
  "lib/password.js"() {
    init_functionsRoutes_0_6149654476194794();
    PBKDF2_ITERATIONS = 1e5;
    SALT_LENGTH = 16;
    KEY_LENGTH = 32;
    DIGEST = "SHA-256";
    __name(encoder, "encoder");
    __name(toBase64, "toBase64");
    __name(fromBase64, "fromBase64");
    __name(timingSafeEqual, "timingSafeEqual");
    __name(deriveBits, "deriveBits");
    __name(hashPassword, "hashPassword");
    __name(verifyPassword, "verifyPassword");
  }
});

// api/admin/users/password.js
function json3(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestPost2(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const body = await context.request.json();
    const user_id = Number(body.user_id || 0);
    const password = String(body.password || "");
    const password_confirm = String(body.password_confirm || "");
    if (!user_id) {
      return json3({ success: false, error: "user_id required" }, 400);
    }
    if (!password || !password_confirm) {
      return json3({ success: false, error: "password and password_confirm required" }, 400);
    }
    if (password.length < 8) {
      return json3({ success: false, error: "password must be at least 8 characters" }, 400);
    }
    if (password !== password_confirm) {
      return json3({ success: false, error: "password confirmation does not match" }, 400);
    }
    const targetUser = await context.env.DB.prepare("SELECT id, role FROM users WHERE id = ?").bind(user_id).first();
    if (!targetUser) {
      return json3({ success: false, error: "user not found" }, 404);
    }
    const password_hash = await hashPassword(password);
    await context.env.DB.prepare(`
        UPDATE users
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(password_hash, user_id).run();
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "update_user_password",
      target_type: "user",
      target_id: String(user_id),
      description: `password updated for user #${user_id}`
    });
    return json3({
      success: true,
      message: "password updated successfully"
    });
  } catch (error) {
    return json3(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_password2 = __esm({
  "api/admin/users/password.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    init_password();
    __name(json3, "json");
    __name(onRequestPost2, "onRequestPost");
  }
});

// api/account/addresses/[id].js
function getCookie3(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).trim().replace(/\s+/g, "");
}
async function getCurrentUser3(request, env) {
  const sessionId = getCookie3(request.headers.get("cookie"), "session_id");
  if (!sessionId) return null;
  const row = await env.DB.prepare(`
    SELECT users.id, users.email, users.full_name, users.phone
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ?
    LIMIT 1
  `).bind(sessionId).first();
  return row || null;
}
function json4(data, status = 200) {
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
  if (!["shipping", "billing"].includes(data.type)) {
    return "\u0646\u0648\u0639 \u0622\u062F\u0631\u0633 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
  }
  if (!data.full_name) return "\u0646\u0627\u0645 \u062A\u062D\u0648\u06CC\u0644\u200C\u06AF\u06CC\u0631\u0646\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  if (!data.address_line) return "\u0646\u0634\u0627\u0646\u06CC \u06A9\u0627\u0645\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  if (!data.postal_code) return "\u06A9\u062F \u067E\u0633\u062A\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  if (!data.phone) return "\u0634\u0645\u0627\u0631\u0647 \u062A\u0645\u0627\u0633 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  if (!data.city) return "\u0634\u0647\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  if (!data.state) return "\u0627\u0633\u062A\u0627\u0646 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  return null;
}
async function getOwnedAddress(env, userId, addressId) {
  return env.DB.prepare(`
    SELECT
      id,
      user_id,
      type,
      full_name,
      address_line,
      postal_code,
      phone,
      city,
      state,
      is_default,
      created_at,
      updated_at
    FROM addresses
    WHERE id = ? AND user_id = ?
    LIMIT 1
  `).bind(addressId, userId).first();
}
async function onRequestPut(context) {
  try {
    const user = await getCurrentUser3(context.request, context.env);
    if (!user) {
      return json4({ success: false, error: "Unauthorized" }, 401);
    }
    const addressId = Number(context.params.id);
    if (!addressId) {
      return json4({ success: false, error: "\u0634\u0646\u0627\u0633\u0647 \u0622\u062F\u0631\u0633 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." }, 400);
    }
    const existing = await getOwnedAddress(context.env, user.id, addressId);
    if (!existing) {
      return json4({ success: false, error: "\u0622\u062F\u0631\u0633 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
    }
    const body = await context.request.json();
    const data = normalizeAddressInput(body);
    const validationError = validateAddressInput(data);
    if (validationError) {
      return json4({ success: false, error: validationError }, 400);
    }
    if (data.is_default === 1) {
      await context.env.DB.prepare(`
        UPDATE addresses
        SET is_default = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(user.id).run();
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
      addressId,
      user.id
    ).run();
    const address = await getOwnedAddress(context.env, user.id, addressId);
    return json4({
      success: true,
      address
    });
  } catch (error) {
    return json4(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
async function onRequestDelete(context) {
  try {
    const user = await getCurrentUser3(context.request, context.env);
    if (!user) {
      return json4({ success: false, error: "Unauthorized" }, 401);
    }
    const addressId = Number(context.params.id);
    if (!addressId) {
      return json4({ success: false, error: "\u0634\u0646\u0627\u0633\u0647 \u0622\u062F\u0631\u0633 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." }, 400);
    }
    const existing = await getOwnedAddress(context.env, user.id, addressId);
    if (!existing) {
      return json4({ success: false, error: "\u0622\u062F\u0631\u0633 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
    }
    await context.env.DB.prepare(`
      DELETE FROM addresses
      WHERE id = ? AND user_id = ?
    `).bind(addressId, user.id).run();
    if (Number(existing.is_default) === 1) {
      const fallback = await context.env.DB.prepare(`
        SELECT id
        FROM addresses
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).bind(user.id).first();
      if (fallback?.id) {
        await context.env.DB.prepare(`
          UPDATE addresses
          SET is_default = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).bind(fallback.id, user.id).run();
      }
    }
    return json4({
      success: true
    });
  } catch (error) {
    return json4(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_id = __esm({
  "api/account/addresses/[id].js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(getCookie3, "getCookie");
    __name(normalizePhone, "normalizePhone");
    __name(getCurrentUser3, "getCurrentUser");
    __name(json4, "json");
    __name(normalizeAddressInput, "normalizeAddressInput");
    __name(validateAddressInput, "validateAddressInput");
    __name(getOwnedAddress, "getOwnedAddress");
    __name(onRequestPut, "onRequestPut");
    __name(onRequestDelete, "onRequestDelete");
  }
});

// api/account/orders/[order].js
function getCookie4(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json5(data, status = 200) {
  return Response.json(data, { status });
}
async function getCurrentUserId(context) {
  const cookieString = context.request.headers.get("cookie") || "";
  const sessionId = getCookie4(cookieString, "session_id");
  if (!sessionId) return null;
  const session = await context.env.DB.prepare(`
      SELECT user_id
      FROM sessions
      WHERE id = ?
      LIMIT 1
    `).bind(sessionId).first();
  return session?.user_id ?? null;
}
async function onRequestGet(context) {
  try {
    const userId = await getCurrentUserId(context);
    if (!userId) {
      return json5({ success: false, error: "unauthorized" }, 401);
    }
    const orderNumber = decodeURIComponent(String(context.params?.order || "")).trim();
    if (!orderNumber) {
      return json5({ success: false, error: "order_number_required" }, 400);
    }
    const order = await context.env.DB.prepare(`
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.payment_status,
          COALESCE(o.subtotal_amount, 0) AS subtotal_amount,
          COALESCE(o.shipping_amount, 0) AS shipping_amount,
          COALESCE(o.total_amount, 0) AS total_amount,
          COALESCE(o.wallet_used_amount, 0) AS wallet_used_amount,
          COALESCE(o.payable_amount, 0) AS payable_amount,
          COALESCE(o.cashback_amount, 0) AS cashback_amount,
          COALESCE(o.cashback_status, 'none') AS cashback_status,
          COALESCE(o.notes, '') AS notes,
          o.created_at,
          o.updated_at,
          o.address_id,

          a.full_name AS shipping_full_name,
          a.address_line AS shipping_address_line,
          a.postal_code AS shipping_postal_code,
          a.phone AS shipping_phone,
          a.city AS shipping_city,
          a.state AS shipping_state
        FROM orders o
        LEFT JOIN addresses a ON a.id = o.address_id
        WHERE o.user_id = ?
          AND o.order_number = ?
        LIMIT 1
      `).bind(userId, orderNumber).first();
    if (!order) {
      return json5({ success: false, error: "order_not_found" }, 404);
    }
    const itemsResult = await context.env.DB.prepare(`
        SELECT
          id,
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price,
          created_at,
          updated_at
        FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `).bind(order.id).all();
    const items = Array.isArray(itemsResult?.results) ? itemsResult.results.map((item) => ({
      id: Number(item.id || 0),
      product_id: item.product_id == null ? null : Number(item.product_id || 0),
      product_name: item.product_name || "",
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0),
      created_at: item.created_at || null,
      updated_at: item.updated_at || null
    })) : [];
    const shippingAddress = order.address_id ? {
      full_name: order.shipping_full_name || "",
      address_line: order.shipping_address_line || "",
      postal_code: order.shipping_postal_code || "",
      phone: order.shipping_phone || "",
      city: order.shipping_city || "",
      state: order.shipping_state || ""
    } : null;
    return json5({
      success: true,
      order: {
        id: Number(order.id || 0),
        order_number: order.order_number || "",
        status: order.status || "pending",
        payment_status: order.payment_status || "pending",
        subtotal_amount: Number(order.subtotal_amount || 0),
        shipping_amount: Number(order.shipping_amount || 0),
        total_amount: Number(order.total_amount || 0),
        wallet_used_amount: Number(order.wallet_used_amount || 0),
        payable_amount: Number(order.payable_amount || 0),
        cashback_amount: Number(order.cashback_amount || 0),
        cashback_status: order.cashback_status || "none",
        notes: order.notes || "",
        created_at: order.created_at || null,
        updated_at: order.updated_at || null,
        items_count: items.length,
        items,
        shipping_address: shippingAddress,
        address: shippingAddress
        // برای سازگاری با صفحه فاکتور
      }
    });
  } catch (error) {
    return json5(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_order = __esm({
  "api/account/orders/[order].js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(getCookie4, "getCookie");
    __name(json5, "json");
    __name(getCurrentUserId, "getCurrentUserId");
    __name(onRequestGet, "onRequestGet");
  }
});

// api/admin/orders/[order].js
function getCookie5(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json6(data, status = 200) {
  return Response.json(data, { status });
}
function normalizeText(value) {
  return String(value ?? "").trim();
}
function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
async function getCurrentUser4(context) {
  const cookieString = context.request.headers.get("cookie") || "";
  const sessionId = getCookie5(cookieString, "session_id");
  if (!sessionId) return null;
  return await context.env.DB.prepare(`
    SELECT
      id,
      full_name,
      email,
      phone,
      role
    FROM users
    WHERE id = (
      SELECT user_id
      FROM sessions
      WHERE id = ?
      LIMIT 1
    )
    LIMIT 1
  `).bind(sessionId).first();
}
function isAdmin(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "admin" || role === "super_admin";
}
async function getOrderByNumber(db, orderNumber) {
  return await db.prepare(`
    SELECT
      o.id,
      o.user_id,
      o.order_number,
      o.address_id,
      o.status,
      o.payment_status,
      o.subtotal_amount,
      o.shipping_amount,
      o.total_amount,
      COALESCE(o.wallet_used_amount, 0) AS wallet_used_amount,
      COALESCE(o.cashback_amount, 0) AS cashback_amount,
      COALESCE(o.cashback_status, 'none') AS cashback_status,
      o.notes,
      o.created_at,
      o.updated_at,
      u.full_name,
      u.email,
      u.phone,
      a.full_name AS address_full_name,
      a.phone AS address_phone,
      a.address_line,
      a.postal_code,
      a.city,
      a.state
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN addresses a ON a.id = o.address_id
    WHERE o.order_number = ?
    LIMIT 1
  `).bind(orderNumber).first();
}
async function getOrderItems(db, orderId) {
  const result = await db.prepare(`
    SELECT
      id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price
    FROM order_items
    WHERE order_id = ?
    ORDER BY id ASC
  `).bind(orderId).all();
  return Array.isArray(result?.results) ? result.results : [];
}
function buildShippingAddress(order) {
  return {
    full_name: order?.address_full_name || order?.full_name || "",
    address_line: order?.address_line || "",
    postal_code: order?.postal_code || "",
    city: order?.city || "",
    state: order?.state || "",
    phone: order?.address_phone || order?.phone || ""
  };
}
function buildOrderPayload(order, items = []) {
  return {
    ...order,
    subtotal_amount: normalizeNumber(order?.subtotal_amount),
    shipping_amount: normalizeNumber(order?.shipping_amount),
    total_amount: normalizeNumber(order?.total_amount),
    wallet_used_amount: normalizeNumber(order?.wallet_used_amount),
    cashback_amount: normalizeNumber(order?.cashback_amount),
    shipping_address: buildShippingAddress(order),
    items: Array.isArray(items) ? items.map((item) => ({
      ...item,
      quantity: normalizeNumber(item?.quantity),
      unit_price: normalizeNumber(item?.unit_price),
      total_price: normalizeNumber(item?.total_price)
    })) : []
  };
}
async function hasCompletedCashbackTx(db, userId, orderId) {
  const row = await db.prepare(`
    SELECT id
    FROM wallet_transactions
    WHERE user_id = ?
      AND order_id = ?
      AND type = 'cashback'
      AND status = 'completed'
    LIMIT 1
  `).bind(userId, orderId).first();
  return !!row;
}
async function hasCashbackReversalTx(db, userId, orderId) {
  const row = await db.prepare(`
    SELECT id
    FROM wallet_transactions
    WHERE user_id = ?
      AND order_id = ?
      AND type = 'debit'
      AND source = 'cashback_reversal'
      AND status = 'completed'
    LIMIT 1
  `).bind(userId, orderId).first();
  return !!row;
}
async function applyCashbackIfNeeded(db, order, actorUserId) {
  const orderId = Number(order?.id || 0);
  const userId = Number(order?.user_id || 0);
  const cashbackAmount = Math.max(0, Math.round(normalizeNumber(order?.cashback_amount)));
  if (!orderId || !userId || cashbackAmount <= 0) {
    if (orderId) {
      await db.prepare(`
        UPDATE orders
        SET cashback_status = 'none',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(orderId).run();
    }
    return { applied: false, reason: "no_cashback" };
  }
  if (String(order.cashback_status || "").toLowerCase() === "completed") {
    return { applied: false, reason: "already_completed" };
  }
  const alreadyDone = await hasCompletedCashbackTx(db, userId, orderId);
  if (alreadyDone) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();
    return { applied: false, reason: "transaction_exists" };
  }
  const user = await db.prepare(`
    SELECT
      id,
      COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();
  if (!user) {
    return { applied: false, reason: "user_not_found" };
  }
  const balanceBefore = Math.max(0, normalizeNumber(user.wallet_balance));
  const balanceAfter = balanceBefore + cashbackAmount;
  await db.batch([
    db.prepare(`
      UPDATE users
      SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(balanceAfter, userId),
    db.prepare(`
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        status,
        source,
        description,
        note,
        order_id,
        order_number,
        reference_type,
        reference_id,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, 'cashback', ?, ?, ?, 'completed', 'order_completion', ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      userId,
      cashbackAmount,
      balanceBefore,
      balanceAfter,
      `Cashback for completed order ${order.order_number}`,
      `\u06A9\u0634\u200C\u0628\u06A9 \u0633\u0641\u0627\u0631\u0634 ${order.order_number}`,
      orderId,
      order.order_number,
      String(orderId),
      actorUserId || null
    ),
    db.prepare(`
      UPDATE orders
      SET cashback_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId)
  ]);
  return { applied: true, amount: cashbackAmount };
}
async function reverseCashbackIfNeeded(db, order, actorUserId) {
  const orderId = Number(order?.id || 0);
  const userId = Number(order?.user_id || 0);
  const cashbackAmount = Math.max(0, Math.round(normalizeNumber(order?.cashback_amount)));
  if (!orderId || !userId || cashbackAmount <= 0) {
    return { reversed: false, reason: "no_cashback" };
  }
  if (String(order.cashback_status || "").toLowerCase() !== "completed") {
    return { reversed: false, reason: "not_completed" };
  }
  const alreadyReversed = await hasCashbackReversalTx(db, userId, orderId);
  if (alreadyReversed) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'reversed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();
    return { reversed: false, reason: "already_reversed" };
  }
  const cashbackExists = await hasCompletedCashbackTx(db, userId, orderId);
  if (!cashbackExists) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'none',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();
    return { reversed: false, reason: "cashback_tx_missing" };
  }
  const user = await db.prepare(`
    SELECT
      id,
      COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();
  if (!user) {
    return { reversed: false, reason: "user_not_found" };
  }
  const balanceBefore = Math.max(0, normalizeNumber(user.wallet_balance));
  const reversalAmount = Math.min(balanceBefore, cashbackAmount);
  const balanceAfter = Math.max(0, balanceBefore - reversalAmount);
  await db.batch([
    db.prepare(`
      UPDATE users
      SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(balanceAfter, userId),
    db.prepare(`
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        status,
        source,
        description,
        note,
        order_id,
        order_number,
        reference_type,
        reference_id,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, 'debit', ?, ?, ?, 'completed', 'cashback_reversal', ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      userId,
      reversalAmount,
      balanceBefore,
      balanceAfter,
      `Cashback reversal for order ${order.order_number}`,
      `\u0628\u0631\u06AF\u0634\u062A \u06A9\u0634\u200C\u0628\u06A9 \u0633\u0641\u0627\u0631\u0634 ${order.order_number}`,
      orderId,
      order.order_number,
      String(orderId),
      actorUserId || null
    ),
    db.prepare(`
      UPDATE orders
      SET cashback_status = 'reversed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId)
  ]);
  return { reversed: true, amount: reversalAmount };
}
async function updateOrderAndCashback(db, orderNumber, payload, actorUserId) {
  const nextStatus = normalizeText(payload?.status).toLowerCase();
  const nextPaymentStatus = normalizeText(payload?.payment_status).toLowerCase();
  const allowedOrderStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];
  const allowedPaymentStatuses = ["pending", "paid", "completed", "failed"];
  if (nextStatus && !allowedOrderStatuses.includes(nextStatus)) {
    return { ok: false, response: json6({ success: false, error: "invalid_order_status" }, 400) };
  }
  if (nextPaymentStatus && !allowedPaymentStatuses.includes(nextPaymentStatus)) {
    return { ok: false, response: json6({ success: false, error: "invalid_payment_status" }, 400) };
  }
  const currentOrder = await getOrderByNumber(db, orderNumber);
  if (!currentOrder) {
    return { ok: false, response: json6({ success: false, error: "order_not_found" }, 404) };
  }
  const oldStatus = String(currentOrder.status || "pending").toLowerCase();
  const oldPaymentStatus = String(currentOrder.payment_status || "pending").toLowerCase();
  const finalStatus = nextStatus || oldStatus;
  const finalPaymentStatus = nextPaymentStatus || oldPaymentStatus;
  await db.prepare(`
    UPDATE orders
    SET
      status = ?,
      payment_status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(finalStatus, finalPaymentStatus, currentOrder.id).run();
  const updatedOrder = await getOrderByNumber(db, orderNumber);
  let cashbackResult = null;
  const shouldApplyCashback = oldStatus !== "completed" && finalStatus === "completed";
  const shouldReverseCashback = oldStatus === "completed" && finalStatus !== "completed" && String(updatedOrder.cashback_status || "").toLowerCase() === "completed";
  if (shouldApplyCashback) {
    cashbackResult = await applyCashbackIfNeeded(db, updatedOrder, actorUserId);
  } else if (shouldReverseCashback) {
    cashbackResult = await reverseCashbackIfNeeded(db, updatedOrder, actorUserId);
  }
  const finalOrder = await getOrderByNumber(db, orderNumber);
  const items = await getOrderItems(db, finalOrder.id);
  return {
    ok: true,
    data: {
      success: true,
      message: "order_updated",
      cashback_result: cashbackResult,
      order: buildOrderPayload(finalOrder, items)
    }
  };
}
async function onRequestGet2(context) {
  try {
    const user = await getCurrentUser4(context);
    if (!user || !isAdmin(user)) {
      return json6({ success: false, error: "unauthorized" }, 401);
    }
    const orderNumber = decodeURIComponent(context.params.order || "").trim();
    if (!orderNumber) {
      return json6({ success: false, error: "order_number_required" }, 400);
    }
    const order = await getOrderByNumber(context.env.DB, orderNumber);
    if (!order) {
      return json6({ success: false, error: "order_not_found" }, 404);
    }
    const items = await getOrderItems(context.env.DB, order.id);
    return json6({
      success: true,
      order: buildOrderPayload(order, items)
    });
  } catch (error) {
    return json6({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPost3(context) {
  try {
    const user = await getCurrentUser4(context);
    if (!user || !isAdmin(user)) {
      return json6({ success: false, error: "unauthorized" }, 401);
    }
    const orderNumber = decodeURIComponent(context.params.order || "").trim();
    if (!orderNumber) {
      return json6({ success: false, error: "order_number_required" }, 400);
    }
    const body = await context.request.json().catch(() => null);
    const result = await updateOrderAndCashback(context.env.DB, orderNumber, body, user.id);
    if (!result.ok) {
      return result.response;
    }
    return json6(result.data);
  } catch (error) {
    return json6({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPatch(context) {
  try {
    const user = await getCurrentUser4(context);
    if (!user || !isAdmin(user)) {
      return json6({ success: false, error: "unauthorized" }, 401);
    }
    const orderNumber = decodeURIComponent(context.params.order || "").trim();
    if (!orderNumber) {
      return json6({ success: false, error: "order_number_required" }, 400);
    }
    const body = await context.request.json().catch(() => null);
    const result = await updateOrderAndCashback(context.env.DB, orderNumber, body, user.id);
    if (!result.ok) {
      return result.response;
    }
    return json6(result.data);
  } catch (error) {
    return json6({ success: false, error: String(error?.message || error) }, 500);
  }
}
var init_order2 = __esm({
  "api/admin/orders/[order].js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(getCookie5, "getCookie");
    __name(json6, "json");
    __name(normalizeText, "normalizeText");
    __name(normalizeNumber, "normalizeNumber");
    __name(getCurrentUser4, "getCurrentUser");
    __name(isAdmin, "isAdmin");
    __name(getOrderByNumber, "getOrderByNumber");
    __name(getOrderItems, "getOrderItems");
    __name(buildShippingAddress, "buildShippingAddress");
    __name(buildOrderPayload, "buildOrderPayload");
    __name(hasCompletedCashbackTx, "hasCompletedCashbackTx");
    __name(hasCashbackReversalTx, "hasCashbackReversalTx");
    __name(applyCashbackIfNeeded, "applyCashbackIfNeeded");
    __name(reverseCashbackIfNeeded, "reverseCashbackIfNeeded");
    __name(updateOrderAndCashback, "updateOrderAndCashback");
    __name(onRequestGet2, "onRequestGet");
    __name(onRequestPost3, "onRequestPost");
    __name(onRequestPatch, "onRequestPatch");
  }
});

// api/admin/products/[id].js
function json7(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
function cleanText(value, maxLength = 1e4) {
  return String(value ?? "").trim().slice(0, maxLength);
}
function cleanSlug(value) {
  return cleanText(value, 160).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}
function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function toOptionalPrice(value) {
  if (value === null || value === void 0 || value === "") {
    return null;
  }
  const normalized = String(value).replace(/[,\s]/g, "");
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}
function toBooleanInteger(value, fallback = 0) {
  if (typeof value === "boolean") return value ? 1 : 0;
  const normalized = String(value ?? "").toLowerCase().trim();
  if (["1", "true", "yes", "on"].includes(normalized)) return 1;
  if (["0", "false", "no", "off", ""].includes(normalized)) return 0;
  return fallback ? 1 : 0;
}
function normalizeStatus(value) {
  const status = cleanText(value, 30).toLowerCase();
  if (["published", "draft", "private"].includes(status)) {
    return status;
  }
  return "draft";
}
function normalizeImageUrl(value) {
  const url = cleanText(value, 2e3);
  if (!url) return "";
  if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `/${url.replace(/^\.?\//, "")}`;
}
function normalizeImages(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = /* @__PURE__ */ new Set();
  const images = [];
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    const imageUrl = normalizeImageUrl(
      typeof item === "string" ? item : item?.image_url ?? item?.imageUrl
    );
    if (!imageUrl || seen.has(imageUrl)) continue;
    seen.add(imageUrl);
    images.push({
      image_url: imageUrl,
      alt_text: cleanText(
        typeof item === "string" ? "" : item?.alt_text ?? item?.altText,
        300
      ),
      sort_order: Math.max(
        0,
        toInteger(
          typeof item === "string" ? index + 1 : item?.sort_order ?? item?.sortOrder,
          index + 1
        )
      ),
      is_primary: toBooleanInteger(
        typeof item === "string" ? index === 0 : item?.is_primary ?? item?.isPrimary,
        index === 0
      )
    });
  }
  if (images.length > 0 && !images.some((image) => image.is_primary === 1)) {
    images[0].is_primary = 1;
  }
  return images;
}
function productFromRow(row, images) {
  const primaryImage = row.primary_image || images.find((image) => image.is_primary === 1)?.image_url || images[0]?.image_url || "";
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    category: row.category || "",
    price: row.price === null ? null : Number(row.price),
    price_label: row.price_label || "\u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F",
    show_price: Number(row.show_price) === 1,
    stock_quantity: Math.max(0, Number(row.stock_quantity || 0)),
    in_stock: Number(row.in_stock) === 1,
    stock_label: row.stock_label || "",
    short_description: row.short_description || "",
    description: row.description || "",
    primary_image: primaryImage,
    page_url: row.page_url || "",
    status: row.status || "draft",
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    images
  };
}
async function getProduct(context, productId) {
  const product = await context.env.DB.prepare(`
      SELECT
        id,
        slug,
        name,
        category,
        price,
        price_label,
        show_price,
        stock_quantity,
        in_stock,
        stock_label,
        short_description,
        description,
        primary_image,
        page_url,
        status,
        created_at,
        updated_at
      FROM products
      WHERE id = ?
      LIMIT 1
    `).bind(productId).first();
  if (!product) return null;
  const imagesResult = await context.env.DB.prepare(`
      SELECT
        id,
        product_id,
        image_url,
        alt_text,
        sort_order,
        is_primary,
        created_at
      FROM product_images
      WHERE product_id = ?
      ORDER BY is_primary DESC, sort_order ASC, id ASC
    `).bind(productId).all();
  const images = (imagesResult.results || []).map((image) => ({
    id: Number(image.id),
    image_url: image.image_url,
    alt_text: image.alt_text || "",
    sort_order: Number(image.sort_order || 0),
    is_primary: Number(image.is_primary) === 1,
    created_at: image.created_at || null
  }));
  return productFromRow(product, images);
}
function getProductId(context) {
  const productId = Number.parseInt(context.params?.id, 10);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}
async function onRequestGet3(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const productId = getProductId(context);
    if (!productId) {
      return json7({ success: false, error: "invalid_product_id" }, 400);
    }
    const product = await getProduct(context, productId);
    if (!product) {
      return json7({ success: false, error: "\u0645\u062D\u0635\u0648\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
    }
    return json7({ success: true, product });
  } catch (error) {
    return json7(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
async function onRequestPut2(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const productId = getProductId(context);
    if (!productId) {
      return json7({ success: false, error: "invalid_product_id" }, 400);
    }
    const currentProduct = await getProduct(context, productId);
    if (!currentProduct) {
      return json7({ success: false, error: "\u0645\u062D\u0635\u0648\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
    }
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json7({ success: false, error: "invalid_request_body" }, 400);
    }
    const name = cleanText(body.name ?? currentProduct.name, 250);
    const slug = cleanSlug(body.slug ?? currentProduct.slug);
    if (!name) {
      return json7({ success: false, error: "\u0646\u0627\u0645 \u0645\u062D\u0635\u0648\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." }, 400);
    }
    if (!slug) {
      return json7(
        {
          success: false,
          error: "slug \u0645\u062D\u0635\u0648\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A."
        },
        400
      );
    }
    const duplicateSlug = await context.env.DB.prepare("SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1").bind(slug, productId).first();
    if (duplicateSlug) {
      return json7(
        {
          success: false,
          error: "\u0627\u06CC\u0646 slug \u0642\u0628\u0644\u0627\u064B \u0628\u0631\u0627\u06CC \u06CC\u06A9 \u0645\u062D\u0635\u0648\u0644 \u062F\u06CC\u06AF\u0631 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A."
        },
        409
      );
    }
    const category = cleanText(body.category ?? currentProduct.category, 120);
    const price = Object.prototype.hasOwnProperty.call(body, "price") ? toOptionalPrice(body.price) : currentProduct.price;
    const priceLabel = cleanText(
      body.price_label ?? body.priceLabel ?? currentProduct.price_label,
      100
    ) || "\u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F";
    const showPrice = Object.prototype.hasOwnProperty.call(body, "show_price") || Object.prototype.hasOwnProperty.call(body, "showPrice") ? toBooleanInteger(body.show_price ?? body.showPrice, price !== null) : currentProduct.show_price ? 1 : 0;
    const stockQuantity = Object.prototype.hasOwnProperty.call(body, "stock_quantity") || Object.prototype.hasOwnProperty.call(body, "stockQuantity") ? Math.max(0, toInteger(body.stock_quantity ?? body.stockQuantity, 0)) : currentProduct.stock_quantity;
    const inStock = Object.prototype.hasOwnProperty.call(body, "in_stock") || Object.prototype.hasOwnProperty.call(body, "inStock") ? toBooleanInteger(body.in_stock ?? body.inStock, stockQuantity > 0) : currentProduct.in_stock ? 1 : 0;
    const stockLabel = cleanText(
      body.stock_label ?? body.stockLabel ?? currentProduct.stock_label,
      100
    ) || (inStock ? "\u0645\u0648\u062C\u0648\u062F" : "\u0646\u0627\u0645\u0648\u062C\u0648\u062F");
    const shortDescription = cleanText(
      body.short_description ?? body.shortDescription ?? currentProduct.short_description,
      1e3
    );
    const description = cleanText(
      body.description ?? currentProduct.description,
      2e4
    );
    const pageUrl = cleanText(
      body.page_url ?? body.pageUrl ?? currentProduct.page_url,
      500
    );
    const status = normalizeStatus(body.status ?? currentProduct.status);
    const shouldReplaceImages = Array.isArray(body.images);
    const images = shouldReplaceImages ? normalizeImages(body.images) : currentProduct.images.map((image, index) => ({
      image_url: image.image_url,
      alt_text: image.alt_text,
      sort_order: index + 1,
      is_primary: image.is_primary ? 1 : 0
    }));
    const primaryImage = normalizeImageUrl(
      body.primary_image ?? body.primaryImage ?? currentProduct.primary_image
    ) || images.find((image) => image.is_primary === 1)?.image_url || images[0]?.image_url || "";
    await context.env.DB.prepare(`
        UPDATE products
        SET
          slug = ?,
          name = ?,
          category = ?,
          price = ?,
          price_label = ?,
          show_price = ?,
          stock_quantity = ?,
          in_stock = ?,
          stock_label = ?,
          short_description = ?,
          description = ?,
          primary_image = ?,
          page_url = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
      slug,
      name,
      category || null,
      price,
      priceLabel,
      showPrice,
      stockQuantity,
      inStock,
      stockLabel,
      shortDescription || null,
      description || null,
      primaryImage || null,
      pageUrl || null,
      status,
      productId
    ).run();
    if (shouldReplaceImages) {
      await context.env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(productId).run();
      if (images.length > 0) {
        const imageStatements = images.map(
          (image, index) => context.env.DB.prepare(`
              INSERT INTO product_images (
                product_id,
                image_url,
                alt_text,
                sort_order,
                is_primary
              )
              VALUES (?, ?, ?, ?, ?)
            `).bind(
            productId,
            image.image_url,
            image.alt_text || name,
            index + 1,
            index === 0 || image.is_primary === 1 ? 1 : 0
          )
        );
        await context.env.DB.batch(imageStatements);
      }
    }
    const updatedProduct = await getProduct(context, productId);
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "product_updated",
      target_type: "product",
      target_id: productId,
      description: `Updated product: ${name} (${slug})`
    });
    return json7({
      success: true,
      message: "\u0645\u062D\u0635\u0648\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.",
      product: updatedProduct
    });
  } catch (error) {
    return json7(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
async function onRequestDelete2(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const productId = getProductId(context);
    if (!productId) {
      return json7({ success: false, error: "invalid_product_id" }, 400);
    }
    const product = await getProduct(context, productId);
    if (!product) {
      return json7({ success: false, error: "\u0645\u062D\u0635\u0648\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
    }
    await context.env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(productId).run();
    await context.env.DB.prepare("DELETE FROM products WHERE id = ?").bind(productId).run();
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "product_deleted",
      target_type: "product",
      target_id: productId,
      description: `Deleted product: ${product.name} (${product.slug})`
    });
    return json7({
      success: true,
      message: "\u0645\u062D\u0635\u0648\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F.",
      deleted_product: {
        id: productId,
        name: product.name,
        slug: product.slug
      }
    });
  } catch (error) {
    return json7(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
var init_id2 = __esm({
  "api/admin/products/[id].js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    __name(json7, "json");
    __name(cleanText, "cleanText");
    __name(cleanSlug, "cleanSlug");
    __name(toInteger, "toInteger");
    __name(toOptionalPrice, "toOptionalPrice");
    __name(toBooleanInteger, "toBooleanInteger");
    __name(normalizeStatus, "normalizeStatus");
    __name(normalizeImageUrl, "normalizeImageUrl");
    __name(normalizeImages, "normalizeImages");
    __name(productFromRow, "productFromRow");
    __name(getProduct, "getProduct");
    __name(getProductId, "getProductId");
    __name(onRequestGet3, "onRequestGet");
    __name(onRequestPut2, "onRequestPut");
    __name(onRequestDelete2, "onRequestDelete");
  }
});

// api/account/addresses.js
function normalizePhone2(phone) {
  if (!phone) return null;
  return String(phone).trim().replace(/\s+/g, "");
}
function json8(data, status = 200) {
  return Response.json(data, { status });
}
function normalizeAddressInput2(body = {}) {
  return {
    type: String(body.type || "shipping").trim().toLowerCase(),
    full_name: String(body.full_name ?? body.fullname ?? "").trim(),
    address_line: String(body.address_line ?? body.addressline ?? "").trim(),
    postal_code: String(body.postal_code ?? body.postalcode ?? "").trim(),
    phone: normalizePhone2(body.phone ?? ""),
    city: String(body.city ?? "").trim(),
    state: String(body.state ?? "").trim(),
    is_default: Number(body.is_default ?? body.isdefault ?? 0) === 1 ? 1 : 0
  };
}
function validateAddressInput2(data) {
  if (!["shipping", "billing"].includes(data.type)) return "\u0646\u0648\u0639 \u0622\u062F\u0631\u0633 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A.";
  if (!data.full_name) return "\u0646\u0627\u0645 \u062A\u062D\u0648\u06CC\u0644\u200C\u06AF\u06CC\u0631\u0646\u062F\u0647 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  if (!data.address_line) return "\u0646\u0634\u0627\u0646\u06CC \u06A9\u0627\u0645\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  if (!data.postal_code) return "\u06A9\u062F \u067E\u0633\u062A\u06CC \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  if (!data.phone) return "\u0634\u0645\u0627\u0631\u0647 \u062A\u0645\u0627\u0633 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  if (!data.city) return "\u0634\u0647\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  if (!data.state) return "\u0627\u0633\u062A\u0627\u0646 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A.";
  return null;
}
async function onRequestGet4(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) return json8({ success: false, error: "Unauthorized" }, 401);
    const result = await context.env.DB.prepare(`
      SELECT id, user_id, type, full_name, address_line, postal_code, phone, city, state, is_default, created_at, updated_at
      FROM addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, id DESC
    `).bind(user.id).all();
    return json8({ success: true, addresses: result.results || [] });
  } catch (error) {
    return json8({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPost4(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) return json8({ success: false, error: "Unauthorized" }, 401);
    const body = await context.request.json();
    const data = normalizeAddressInput2(body);
    const validationError = validateAddressInput2(data);
    if (validationError) {
      return json8({ success: false, error: validationError }, 400);
    }
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
    const address = insertedId ? await context.env.DB.prepare(`
          SELECT id, user_id, type, full_name, address_line, postal_code, phone, city, state, is_default, created_at, updated_at
          FROM addresses
          WHERE id = ? AND user_id = ?
          LIMIT 1
        `).bind(insertedId, user.id).first() : null;
    return json8({ success: true, id: insertedId, address });
  } catch (error) {
    return json8({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPut3(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) return json8({ success: false, error: "Unauthorized" }, 401);
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();
    if (!id) {
      return json8({ success: false, error: "\u0622\u062F\u0631\u0633 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." }, 400);
    }
    const body = await context.request.json();
    const data = normalizeAddressInput2(body);
    const validationError = validateAddressInput2(data);
    if (validationError) {
      return json8({ success: false, error: validationError }, 400);
    }
    const existing = await context.env.DB.prepare(`
      SELECT id FROM addresses WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();
    if (!existing) {
      return json8({ success: false, error: "\u0622\u062F\u0631\u0633 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." }, 404);
    }
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
    return json8({ success: true, address: updated });
  } catch (error) {
    return json8({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestDelete3(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) return json8({ success: false, error: "Unauthorized" }, 401);
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();
    if (!id) {
      return json8({ success: false, error: "\u0622\u062F\u0631\u0633 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." }, 400);
    }
    const existing = await context.env.DB.prepare(`
      SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();
    if (!existing) {
      return json8({ success: false, error: "\u0622\u062F\u0631\u0633 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." }, 404);
    }
    await context.env.DB.prepare(`
      DELETE FROM addresses WHERE id = ? AND user_id = ?
    `).bind(id, user.id).run();
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
    return json8({ success: true, message: "\u0622\u062F\u0631\u0633 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F." });
  } catch (error) {
    return json8({ success: false, error: String(error?.message || error) }, 500);
  }
}
var init_addresses = __esm({
  "api/account/addresses.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    __name(normalizePhone2, "normalizePhone");
    __name(json8, "json");
    __name(normalizeAddressInput2, "normalizeAddressInput");
    __name(validateAddressInput2, "validateAddressInput");
    __name(onRequestGet4, "onRequestGet");
    __name(onRequestPost4, "onRequestPost");
    __name(onRequestPut3, "onRequestPut");
    __name(onRequestDelete3, "onRequestDelete");
  }
});

// lib/db.js
function getDb(env) {
  const db = env?.DB || env?.db;
  if (!db) {
    throw new Error("D1 binding not found. Expected env.DB");
  }
  return db;
}
var init_db = __esm({
  "lib/db.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(getDb, "getDb");
  }
});

// lib/rate.js
var rate_exports = {};
__export(rate_exports, {
  calculateProductPrice: () => calculateProductPrice,
  fetchRateFromApi: () => fetchRateFromApi,
  getCalculatedProductPrice: () => getCalculatedProductPrice,
  getCurrentRate: () => getCurrentRate,
  getCurrentRateWithPrevious: () => getCurrentRateWithPrevious,
  getRateApiSettings: () => getRateApiSettings,
  getRateHistory: () => getRateHistory,
  recalculateAllProductPrices: () => recalculateAllProductPrices,
  updateRate: () => updateRate
});
async function getCurrentRate(env, currencyCode = "USD") {
  const db = getDb(env);
  const result = await db.prepare(`
      SELECT 
        id,
        currency_code,
        currency_name,
        rate,
        source_type,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
      FROM rates
      WHERE currency_code = ? AND is_active = 1
      LIMIT 1
    `).bind(currencyCode).first();
  return result || null;
}
async function getCurrentRateWithPrevious(env, currencyCode = "USD") {
  const db = getDb(env);
  const current = await getCurrentRate(env, currencyCode);
  if (!current) return null;
  const history = await db.prepare(`
      SELECT rate
      FROM rate_history
      WHERE rate_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(current.id).first();
  return {
    ...current,
    previous_rate: history?.rate || current.rate
  };
}
async function getRateHistory(env, currencyCode = "USD", limit = 50) {
  const db = getDb(env);
  const rate = await db.prepare(`SELECT id FROM rates WHERE currency_code = ?`).bind(currencyCode).first();
  if (!rate) return [];
  const result = await db.prepare(`
      SELECT 
        rh.id,
        rh.rate,
        rh.source_type,
        rh.created_at,
        u.full_name as changed_by
      FROM rate_history rh
      LEFT JOIN users u ON u.id = rh.changed_by_user_id
      WHERE rh.rate_id = ?
      ORDER BY rh.created_at DESC
      LIMIT ?
    `).bind(rate.id, limit).all();
  return Array.isArray(result?.results) ? result.results : [];
}
async function updateRate(env, currencyCode, newRate, sourceType = "manual", userId = null) {
  const db = getDb(env);
  const rateValue = Number(newRate);
  if (!Number.isFinite(rateValue) || rateValue <= 0) {
    throw new Error("\u0646\u0631\u062E \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  }
  const current = await getCurrentRate(env, currencyCode);
  if (!current) {
    throw new Error(`\u0627\u0631\u0632 ${currencyCode} \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.`);
  }
  if (current.rate === rateValue) {
    return {
      success: true,
      message: "\u0646\u0631\u062E \u062A\u063A\u06CC\u06CC\u0631\u06CC \u0646\u06A9\u0631\u062F\u0647 \u0627\u0633\u062A.",
      rate: current,
      changed: false
    };
  }
  await db.prepare(`
      INSERT INTO rate_history (
        rate_id,
        rate,
        source_type,
        changed_by_user_id,
        created_at
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
    current.id,
    current.rate,
    current.source_type,
    userId
  ).run();
  await db.prepare(`
      UPDATE rates
      SET 
        rate = ?,
        source_type = ?,
        updated_by_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
    rateValue,
    sourceType,
    userId,
    current.id
  ).run();
  const updated = await getCurrentRate(env, currencyCode);
  return {
    success: true,
    message: `\u0646\u0631\u062E ${currencyCode} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.`,
    rate: updated,
    previous_rate: current.rate,
    changed: true
  };
}
function calculateProductPrice(product, rate, options = {}) {
  if (product.price_type !== "rate_based") {
    return Number(product.price || 0);
  }
  const basePrice = Number(product.base_price || 0);
  if (basePrice <= 0) {
    return 0;
  }
  let finalPrice = basePrice * rate;
  const profitType = product.profit_type || "none";
  const profitValue = Number(product.profit_value || 0);
  if (profitType === "percentage" && profitValue > 0) {
    finalPrice += finalPrice * profitValue / 100;
  } else if (profitType === "fixed" && profitValue > 0) {
    finalPrice += profitValue;
  }
  const fixedFee = Number(product.fixed_fee || 0);
  if (fixedFee > 0) {
    finalPrice += fixedFee;
  }
  const roundingType = product.rounding_type || "none";
  const roundingMethod = product.rounding_method || "nearest";
  if (roundingType !== "none") {
    const roundTo = parseInt(roundingType, 10);
    if (roundTo > 0) {
      if (roundingMethod === "up") {
        finalPrice = Math.ceil(finalPrice / roundTo) * roundTo;
      } else if (roundingMethod === "down") {
        finalPrice = Math.floor(finalPrice / roundTo) * roundTo;
      } else {
        finalPrice = Math.round(finalPrice / roundTo) * roundTo;
      }
    }
  }
  return Math.max(0, Math.round(finalPrice));
}
async function recalculateAllProductPrices(env, currencyCode = "USD") {
  const db = getDb(env);
  const rate = await getCurrentRate(env, currencyCode);
  if (!rate) {
    throw new Error(`\u0646\u0631\u062E \u0627\u0631\u0632 ${currencyCode} \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.`);
  }
  const productsResult = await db.prepare(`
      SELECT 
        id,
        name,
        slug,
        price_type,
        base_price,
        profit_type,
        profit_value,
        fixed_fee,
        rounding_type,
        rounding_method
      FROM products
      WHERE price_type = 'rate_based'
        AND base_price IS NOT NULL
        AND base_price > 0
    `).all();
  const products = Array.isArray(productsResult?.results) ? productsResult.results : [];
  if (products.length === 0) {
    return {
      success: true,
      message: "\u0647\u06CC\u0686 \u0645\u062D\u0635\u0648\u0644 \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u0646\u0631\u062E \u0627\u0631\u0632\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.",
      updated_count: 0,
      rate: rate.rate
    };
  }
  const updates = products.map((product) => {
    const calculatedPrice = calculateProductPrice(product, rate.rate);
    return db.prepare(`
        UPDATE products
        SET 
          calculated_price = ?,
          price_calculated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(calculatedPrice, product.id);
  });
  await db.batch(updates);
  return {
    success: true,
    message: `\u0642\u06CC\u0645\u062A ${products.length} \u0645\u062D\u0635\u0648\u0644 \u0628\u0627 \u0646\u0631\u062E ${rate.rate} \u062A\u0648\u0645\u0627\u0646 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.`,
    updated_count: products.length,
    rate: rate.rate
  };
}
async function getCalculatedProductPrice(env, productId, currencyCode = "USD") {
  const db = getDb(env);
  const product = await db.prepare(`
      SELECT 
        id,
        name,
        slug,
        price,
        price_type,
        base_price,
        profit_type,
        profit_value,
        fixed_fee,
        rounding_type,
        rounding_method,
        calculated_price,
        price_calculated_at
      FROM products
      WHERE id = ?
    `).bind(productId).first();
  if (!product) {
    throw new Error("\u0645\u062D\u0635\u0648\u0644 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");
  }
  if (product.price_type !== "rate_based") {
    return Number(product.price || 0);
  }
  const rate = await getCurrentRate(env, currencyCode);
  if (!rate) {
    throw new Error(`\u0646\u0631\u062E \u0627\u0631\u0632 ${currencyCode} \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.`);
  }
  return calculateProductPrice(product, rate.rate);
}
async function getRateApiSettings(env) {
  const db = getDb(env);
  const result = await db.prepare(`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key LIKE 'rate_%'
    `).all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  const settings = {};
  for (const row of rows) {
    const key = String(row.setting_key || "").trim();
    const value = String(row.setting_value || "").trim();
    settings[key] = value;
  }
  const defaults = {
    rate_default_currency: "USD",
    rate_api_provider: "tgju",
    rate_api_url: "https://api.tgju.org/v1/market/price/price_dollar_rl",
    rate_api_key: "",
    rate_update_interval: "3600",
    rate_auto_update_enabled: "false"
  };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (!settings[key] || settings[key] === "") {
      settings[key] = defaultValue;
    }
  }
  return settings;
}
async function fetchRateFromApi(env, provider = "tgju", apiUrl = null, apiKey = null) {
  console.warn("\u062F\u0631\u06CC\u0627\u0641\u062A \u062E\u0648\u062F\u06A9\u0627\u0631 \u0627\u0632 API \u0647\u0646\u0648\u0632 \u067E\u06CC\u0627\u062F\u0647\u200C\u0633\u0627\u0632\u06CC \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
  return null;
}
var init_rate = __esm({
  "lib/rate.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_db();
    __name(getCurrentRate, "getCurrentRate");
    __name(getCurrentRateWithPrevious, "getCurrentRateWithPrevious");
    __name(getRateHistory, "getRateHistory");
    __name(updateRate, "updateRate");
    __name(calculateProductPrice, "calculateProductPrice");
    __name(recalculateAllProductPrices, "recalculateAllProductPrices");
    __name(getCalculatedProductPrice, "getCalculatedProductPrice");
    __name(getRateApiSettings, "getRateApiSettings");
    __name(fetchRateFromApi, "fetchRateFromApi");
  }
});

// api/account/create-order.js
function json9(data, status = 200) {
  return Response.json(data, { status });
}
function normalizeDigits(value) {
  const map = {
    "\u06F0": "0",
    "\u06F1": "1",
    "\u06F2": "2",
    "\u06F3": "3",
    "\u06F4": "4",
    "\u06F5": "5",
    "\u06F6": "6",
    "\u06F7": "7",
    "\u06F8": "8",
    "\u06F9": "9"
  };
  return String(value ?? "").replace(/[۰-۹]/g, (digit) => map[digit]);
}
function normalizeText2(value) {
  return String(value ?? "").trim();
}
function normalizeNumber2(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  const normalized = normalizeDigits(value).replace(/[^\d]/g, "");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}
function generateOrderNumber() {
  const now = /* @__PURE__ */ new Date();
  const datePart = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0")
  ].join("");
  const randomPart = Math.floor(1e5 + Math.random() * 9e5);
  return `TT-${datePart}-${randomPart}`;
}
function validatePayload(body) {
  if (!body || typeof body !== "object") return "payload-invalid";
  const address = body.address || {};
  const order = body.order || {};
  const items = Array.isArray(order.items) ? order.items : [];
  if (!address.full_name || !address.address_line || !address.city || !address.state) {
    return "address-invalid";
  }
  if (!items.length) {
    return "items-empty";
  }
  if (!Number.isFinite(Number(order.total_amount)) || Number(order.total_amount) <= 0) {
    return "total-invalid";
  }
  return null;
}
function extractItemName(item) {
  return normalizeText2(
    item?.product_name || item?.name || item?.title || item?.product?.name || "\u0645\u062D\u0635\u0648\u0644"
  );
}
function extractItemQuantity(item) {
  const quantity = normalizeNumber2(
    item?.qty ?? item?.quantity ?? item?.count ?? item?.amount
  );
  return quantity > 0 ? quantity : 1;
}
function extractItemUnitPrice(item) {
  if (item?.displayPrice !== void 0 && item?.displayPrice !== null) {
    const displayPrice = normalizeNumber2(item.displayPrice);
    if (displayPrice > 0) return displayPrice;
  }
  const directPrice = normalizeNumber2(item?.unit_price);
  if (directPrice > 0) return directPrice;
  const price = normalizeNumber2(item?.price);
  if (price > 0) return price;
  const productPrice = normalizeNumber2(item?.product?.price);
  if (productPrice > 0) return productPrice;
  const rowTotal = normalizeNumber2(
    item?.row_total ?? item?.total_price ?? item?.total
  );
  const quantity = extractItemQuantity(item);
  if (rowTotal > 0 && quantity > 0) {
    return Math.round(rowTotal / quantity);
  }
  return 0;
}
function extractItemTotalPrice(item) {
  const directTotal = normalizeNumber2(
    item?.row_total ?? item?.total_price ?? item?.line_total ?? item?.total
  );
  if (directTotal > 0) return directTotal;
  const quantity = extractItemQuantity(item);
  const unitPrice = extractItemUnitPrice(item);
  return quantity * unitPrice;
}
function extractProductId(item) {
  const raw = item?.product_id ?? item?.product?.id ?? null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function extractRateAtPurchase(item) {
  const rate = normalizeNumber2(
    item?.rate_at_purchase ?? item?.rateAtPurchase ?? item?.rate
  );
  return rate > 0 ? rate : null;
}
function extractCurrencyCode(item) {
  return normalizeText2(
    item?.currency_code ?? item?.currencyCode ?? "USD"
  ) || "USD";
}
function normalizeStatuses(rawValue) {
  if (!rawValue) return ["completed"];
  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      const list2 = parsed.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
      return list2.length ? list2 : ["completed"];
    }
  } catch (_) {
  }
  const list = String(rawValue).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : ["completed"];
}
async function getCashbackSettings(db) {
  const defaults = {
    cashbackPercent: 0,
    cashbackStatuses: ["completed"]
  };
  try {
    const rows = await db.prepare(`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key IN ('cashback_percent', 'cashback_statuses')
    `).all();
    const results = Array.isArray(rows?.results) ? rows.results : [];
    if (!results.length) return defaults;
    const settingsMap = {};
    for (const row of results) {
      settingsMap[String(row?.setting_key || "").trim()] = row?.setting_value;
    }
    let cashbackPercent = Math.max(
      0,
      Math.min(100, Number(settingsMap.cashback_percent || 0))
    );
    if (!Number.isFinite(cashbackPercent)) cashbackPercent = 0;
    const cashbackStatuses = normalizeStatuses(settingsMap.cashback_statuses);
    return {
      cashbackPercent,
      cashbackStatuses
    };
  } catch (error) {
    return defaults;
  }
}
async function createOrUpdateAddress(context, user, address) {
  const fullName = normalizeText2(address.full_name) || normalizeText2(user.full_name);
  const addressLine = normalizeText2(address.address_line);
  const postalCode = normalizeDigits(address.postal_code).replace(/[^\d]/g, "");
  const phone = normalizeDigits(address.phone || user.phone).replace(/[^\d]/g, "");
  const city = normalizeText2(address.city);
  const state = normalizeText2(address.state);
  const existingAddress = await context.env.DB.prepare(`
    SELECT id
    FROM addresses
    WHERE user_id = ?
    ORDER BY is_default DESC, id DESC
    LIMIT 1
  `).bind(user.id).first();
  if (existingAddress?.id) {
    await context.env.DB.prepare(`
      UPDATE addresses
      SET
        type = 'shipping',
        full_name = ?,
        address_line = ?,
        postal_code = ?,
        phone = ?,
        city = ?,
        state = ?,
        is_default = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(
      fullName,
      addressLine,
      postalCode,
      phone,
      city,
      state,
      existingAddress.id,
      user.id
    ).run();
    return {
      id: existingAddress.id,
      full_name: fullName,
      address_line: addressLine,
      postal_code: postalCode,
      phone,
      city,
      state
    };
  }
  await context.env.DB.prepare(`
    UPDATE addresses
    SET is_default = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).bind(user.id).run();
  const addressInsert = await context.env.DB.prepare(`
    INSERT INTO addresses (
      user_id,
      type,
      full_name,
      address_line,
      postal_code,
      phone,
      city,
      state,
      is_default,
      created_at,
      updated_at
    )
    VALUES (?, 'shipping', ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(
    user.id,
    fullName,
    addressLine,
    postalCode,
    phone,
    city,
    state
  ).run();
  return {
    id: addressInsert.meta?.last_row_id ?? null,
    full_name: fullName,
    address_line: addressLine,
    postal_code: postalCode,
    phone,
    city,
    state
  };
}
async function generateUniqueOrderNumber(db) {
  let orderNumber = generateOrderNumber();
  let existingOrder = await db.prepare(`
    SELECT id
    FROM orders
    WHERE order_number = ?
    LIMIT 1
  `).bind(orderNumber).first();
  while (existingOrder) {
    orderNumber = generateOrderNumber();
    existingOrder = await db.prepare(`
      SELECT id
      FROM orders
      WHERE order_number = ?
      LIMIT 1
    `).bind(orderNumber).first();
  }
  return orderNumber;
}
async function hasWalletUseTransaction(db, userId, orderId) {
  const row = await db.prepare(`
    SELECT id
    FROM wallet_transactions
    WHERE user_id = ?
      AND order_id = ?
      AND type = 'debit'
      AND source = 'checkout'
      AND status = 'completed'
    LIMIT 1
  `).bind(userId, orderId).first();
  return !!row;
}
async function onRequestPost5(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) {
      return json9({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json().catch(() => null);
    const validationError = validatePayload(body);
    if (validationError) {
      return json9({ success: false, error: validationError }, 400);
    }
    let currentRate = null;
    try {
      const rateResult = await getCurrentRate(context.env, "USD");
      if (rateResult) {
        currentRate = rateResult.rate;
      }
    } catch (_) {
      currentRate = 196e3;
    }
    const address = body.address || {};
    const order = body.order || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const shippingAmount = normalizeNumber2(order.shipping_amount);
    const submittedSubtotalAmount = normalizeNumber2(order.subtotal_amount);
    const submittedTotalAmount = normalizeNumber2(order.total_amount);
    let recalculatedSubtotal = 0;
    const normalizedItems = items.map((item) => {
      const productId = extractProductId(item);
      const productName = extractItemName(item);
      const quantity = extractItemQuantity(item);
      const unitPrice = extractItemUnitPrice(item);
      const totalPrice = extractItemTotalPrice(item);
      const rateAtPurchase = extractRateAtPurchase(item) || currentRate;
      const currencyCode = extractCurrencyCode(item);
      recalculatedSubtotal += totalPrice;
      return {
        product_id: productId,
        product_name: productName,
        quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        // ⭐ فیلدهای جدید برای ذخیره نرخ لحظه‌ای
        rate_at_purchase: rateAtPurchase,
        currency_code: currencyCode
      };
    });
    const subtotalAmount = recalculatedSubtotal > 0 ? recalculatedSubtotal : submittedSubtotalAmount;
    const totalAmount = subtotalAmount + shippingAmount;
    if (submittedTotalAmount > 0 && totalAmount !== submittedTotalAmount) {
      return json9({ success: false, error: "total-mismatch" }, 400);
    }
    const requestedWalletUse = normalizeNumber2(
      order.wallet_used_amount ?? order.wallet_amount ?? body.wallet_used_amount
    );
    const balanceBefore = normalizeNumber2(user.wallet_balance);
    const maxWalletUsable = Math.min(balanceBefore, totalAmount);
    const walletUsedAmount = Math.min(requestedWalletUse, maxWalletUsable);
    const payableAmount = Math.max(0, totalAmount - walletUsedAmount);
    const { cashbackPercent } = await getCashbackSettings(context.env.DB);
    const cashbackBase = totalAmount;
    const cashbackAmount = cashbackBase > 0 ? Math.round(cashbackBase * cashbackPercent / 100) : 0;
    const savedAddress = await createOrUpdateAddress(context, user, address);
    const orderNumber = await generateUniqueOrderNumber(context.env.DB);
    const orderInsert = await context.env.DB.prepare(`
      INSERT INTO orders (
        user_id,
        order_number,
        address_id,
        status,
        payment_status,
        subtotal_amount,
        shipping_amount,
        total_amount,
        wallet_used_amount,
        payable_amount,
        cashback_amount,
        cashback_status,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      user.id,
      orderNumber,
      savedAddress.id,
      subtotalAmount,
      shippingAmount,
      totalAmount,
      walletUsedAmount,
      payableAmount,
      cashbackAmount,
      cashbackAmount > 0 ? "pending" : "none",
      normalizeText2(order.notes || body.notes)
    ).run();
    const orderId = orderInsert.meta?.last_row_id ?? null;
    if (!orderId) {
      return json9({ success: false, error: "order-create-failed" }, 500);
    }
    for (const item of normalizedItems) {
      await context.env.DB.prepare(`
        INSERT INTO order_items (
          order_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price,
          rate_at_purchase,
          currency_code,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        orderId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.total_price,
        item.rate_at_purchase,
        item.currency_code
      ).run();
    }
    if (walletUsedAmount > 0) {
      const alreadyHasWalletTx = await hasWalletUseTransaction(context.env.DB, user.id, orderId);
      if (!alreadyHasWalletTx) {
        const balanceAfter = Math.max(0, balanceBefore - walletUsedAmount);
        await context.env.DB.batch([
          context.env.DB.prepare(`
            UPDATE users
            SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(balanceAfter, user.id),
          context.env.DB.prepare(`
            INSERT INTO wallet_transactions (
              user_id,
              type,
              amount,
              balance_before,
              balance_after,
              status,
              source,
              description,
              note,
              order_id,
              order_number,
              reference_type,
              reference_id,
              created_by_user_id,
              created_at,
              updated_at
            )
            VALUES (?, 'debit', ?, ?, ?, 'completed', 'checkout', ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(
            user.id,
            walletUsedAmount,
            balanceBefore,
            balanceAfter,
            `\u0628\u0631\u062F\u0627\u0634\u062A \u06A9\u06CC\u0641 \u067E\u0648\u0644 \u0628\u0631\u0627\u06CC \u0633\u0641\u0627\u0631\u0634 ${orderNumber}`,
            `\u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0627\u0632 \u06A9\u06CC\u0641 \u067E\u0648\u0644 \u062F\u0631 \u062B\u0628\u062A \u0633\u0641\u0627\u0631\u0634`,
            orderId,
            orderNumber,
            String(orderId),
            user.id
          )
        ]);
      }
    }
    return json9({
      success: true,
      order: {
        id: orderId,
        order_number: orderNumber,
        status: "pending",
        payment_status: "pending",
        address_id: savedAddress.id,
        address: {
          full_name: savedAddress.full_name,
          address_line: savedAddress.address_line,
          postal_code: savedAddress.postal_code,
          phone: savedAddress.phone,
          city: savedAddress.city,
          state: savedAddress.state
        },
        subtotal_amount: subtotalAmount,
        shipping_amount: shippingAmount,
        total_amount: totalAmount,
        wallet_used_amount: walletUsedAmount,
        payable_amount: payableAmount,
        cashback_percent: cashbackPercent,
        cashback_base: cashbackBase,
        cashback_amount: cashbackAmount,
        cashback_status: cashbackAmount > 0 ? "pending" : "none",
        items_count: normalizedItems.length,
        // ⭐ نرخ لحظه‌ای ثبت شده در سفارش
        rate_at_purchase: currentRate
      }
    });
  } catch (error) {
    return json9(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_create_order = __esm({
  "api/account/create-order.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    init_rate();
    __name(json9, "json");
    __name(normalizeDigits, "normalizeDigits");
    __name(normalizeText2, "normalizeText");
    __name(normalizeNumber2, "normalizeNumber");
    __name(generateOrderNumber, "generateOrderNumber");
    __name(validatePayload, "validatePayload");
    __name(extractItemName, "extractItemName");
    __name(extractItemQuantity, "extractItemQuantity");
    __name(extractItemUnitPrice, "extractItemUnitPrice");
    __name(extractItemTotalPrice, "extractItemTotalPrice");
    __name(extractProductId, "extractProductId");
    __name(extractRateAtPurchase, "extractRateAtPurchase");
    __name(extractCurrencyCode, "extractCurrencyCode");
    __name(normalizeStatuses, "normalizeStatuses");
    __name(getCashbackSettings, "getCashbackSettings");
    __name(createOrUpdateAddress, "createOrUpdateAddress");
    __name(generateUniqueOrderNumber, "generateUniqueOrderNumber");
    __name(hasWalletUseTransaction, "hasWalletUseTransaction");
    __name(onRequestPost5, "onRequestPost");
  }
});

// api/account/orders.js
function json10(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet5(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) {
      return json10({ success: false, error: "unauthorized" }, 401);
    }
    const orders = await context.env.DB.prepare(`
        SELECT
          id,
          order_number,
          status,
          payment_status,
          total_amount,
          shipping_amount,
          wallet_used_amount,
          payable_amount,
          cashback_amount,
          cashback_status,
          created_at,
          updated_at
        FROM orders
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).bind(user.id).all();
    return json10({
      success: true,
      orders: orders.results || []
    });
  } catch (error) {
    return json10(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_orders = __esm({
  "api/account/orders.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    __name(json10, "json");
    __name(onRequestGet5, "onRequestGet");
  }
});

// api/account/wallet.js
function getCookie6(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json11(data, status = 200) {
  return Response.json(data, { status });
}
async function getCurrentUser5(request, env) {
  const sessionId = getCookie6(request.headers.get("cookie") || "", "session_id");
  if (!sessionId) return null;
  return await env.DB.prepare(`
    SELECT
      id,
      full_name,
      email,
      phone,
      role,
      COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = (
      SELECT user_id
      FROM sessions
      WHERE id = ?
      LIMIT 1
    )
    LIMIT 1
  `).bind(sessionId).first();
}
function normalizeStatuses2(rawValue) {
  if (!rawValue) return ["completed"];
  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      const list2 = parsed.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
      return list2.length ? list2 : ["completed"];
    }
  } catch (_) {
  }
  const list = String(rawValue).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : ["completed"];
}
async function getWalletSettings(env) {
  const defaults = {
    cashback_percent: 0,
    cashback_statuses: ["completed"]
  };
  const attempts = [
    {
      table: "app_settings",
      keyColumn: "setting_key",
      valueColumn: "setting_value"
    },
    {
      table: "site_settings",
      keyColumn: "key",
      valueColumn: "value"
    }
  ];
  for (const attempt of attempts) {
    try {
      const rows = await env.DB.prepare(`
        SELECT ${attempt.keyColumn} AS setting_key, ${attempt.valueColumn} AS setting_value
        FROM ${attempt.table}
        WHERE ${attempt.keyColumn} IN ('cashback_percent', 'cashback_statuses')
      `).all();
      const results = Array.isArray(rows?.results) ? rows.results : [];
      if (!results.length) continue;
      const map = {};
      for (const row of results) {
        map[String(row?.setting_key || "").trim()] = row?.setting_value;
      }
      let cashbackPercent = Number(map.cashback_percent || 0);
      if (!Number.isFinite(cashbackPercent) || cashbackPercent < 0) {
        cashbackPercent = 0;
      }
      return {
        cashback_percent: cashbackPercent,
        cashback_statuses: normalizeStatuses2(map.cashback_statuses)
      };
    } catch (error) {
      const message = String(error?.message || error || "");
      const ignorable = message.includes("no such table") || message.includes("no such column");
      if (!ignorable) {
        throw error;
      }
    }
  }
  return defaults;
}
async function onRequestGet6(context) {
  try {
    const user = await getCurrentUser5(context.request, context.env);
    if (!user) {
      return json11({ success: false, error: "unauthorized" }, 401);
    }
    const [transactionsQuery, settings] = await Promise.all([
      context.env.DB.prepare(`
        SELECT
          id,
          type,
          amount,
          balance_before,
          balance_after,
          status,
          reference_type,
          reference_id,
          note,
          created_by_user_id,
          created_at
        FROM wallet_transactions
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 100
      `).bind(user.id).all(),
      getWalletSettings(context.env)
    ]);
    const transactions = Array.isArray(transactionsQuery?.results) ? transactionsQuery.results.map((tx) => ({
      id: Number(tx.id || 0),
      type: tx.type || "",
      amount: Number(tx.amount || 0),
      balance_before: Number(tx.balance_before || 0),
      balance_after: Number(tx.balance_after || 0),
      status: tx.status || "",
      reference_type: tx.reference_type || "",
      reference_id: tx.reference_id || "",
      note: tx.note || "",
      created_by_user_id: tx.created_by_user_id ? Number(tx.created_by_user_id) : null,
      created_at: tx.created_at || null
    })) : [];
    return json11({
      success: true,
      user: {
        id: Number(user.id || 0),
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "customer",
        wallet_balance: Number(user.wallet_balance || 0)
      },
      wallet_balance: Number(user.wallet_balance || 0),
      cashback_percent: Number(settings.cashback_percent || 0),
      settings: {
        cashback_percent: Number(settings.cashback_percent || 0),
        cashback_statuses: settings.cashback_statuses
      },
      transactions
    });
  } catch (error) {
    return json11(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_wallet = __esm({
  "api/account/wallet.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(getCookie6, "getCookie");
    __name(json11, "json");
    __name(getCurrentUser5, "getCurrentUser");
    __name(normalizeStatuses2, "normalizeStatuses");
    __name(getWalletSettings, "getWalletSettings");
    __name(onRequestGet6, "onRequestGet");
  }
});

// api/admin/me.js
async function onRequestGet7(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    return Response.json({
      success: true,
      user: adminCheck.user
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
var init_me = __esm({
  "api/admin/me.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    __name(onRequestGet7, "onRequestGet");
  }
});

// api/admin/orders.js
function getCookie7(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json12(data, status = 200) {
  return Response.json(data, { status });
}
function normalizeText3(value) {
  return String(value ?? "").trim();
}
function normalizeNumber3(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
async function getCurrentUser6(context) {
  const cookieString = context.request.headers.get("cookie") || "";
  const sessionId = getCookie7(cookieString, "session_id");
  if (!sessionId) return null;
  return await context.env.DB.prepare(`
    SELECT
      id,
      full_name,
      email,
      phone,
      role
    FROM users
    WHERE id = (
      SELECT user_id
      FROM sessions
      WHERE id = ?
      LIMIT 1
    )
    LIMIT 1
  `).bind(sessionId).first();
}
function isAdmin2(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "admin" || role === "super_admin";
}
async function getOrderByNumber2(db, orderNumber) {
  return await db.prepare(`
    SELECT
      o.id,
      o.user_id,
      o.order_number,
      o.address_id,
      o.status,
      o.payment_status,
      o.subtotal_amount,
      o.shipping_amount,
      o.total_amount,
      COALESCE(o.wallet_used_amount, 0) AS wallet_used_amount,
      COALESCE(o.cashback_amount, 0) AS cashback_amount,
      COALESCE(o.cashback_status, 'none') AS cashback_status,
      o.notes,
      o.created_at,
      o.updated_at,
      u.full_name,
      u.email,
      u.phone,
      a.full_name AS address_full_name,
      a.address_line AS address_address_line,
      a.postal_code AS address_postal_code,
      a.phone AS address_phone,
      a.city AS address_city,
      a.state AS address_state
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN addresses a ON a.id = o.address_id
    WHERE o.order_number = ?
    LIMIT 1
  `).bind(orderNumber).first();
}
async function getOrderItems2(db, orderId) {
  const result = await db.prepare(`
    SELECT
      id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price
    FROM order_items
    WHERE order_id = ?
    ORDER BY id DESC
  `).bind(orderId).all();
  return Array.isArray(result?.results) ? result.results : [];
}
async function hasCompletedCashbackTx2(db, userId, orderId) {
  const row = await db.prepare(`
    SELECT id
    FROM wallet_transactions
    WHERE user_id = ?
      AND order_id = ?
      AND type = 'cashback'
      AND status = 'completed'
    LIMIT 1
  `).bind(userId, orderId).first();
  return !!row;
}
async function hasCashbackReversalTx2(db, userId, orderId) {
  const row = await db.prepare(`
    SELECT id
    FROM wallet_transactions
    WHERE user_id = ?
      AND order_id = ?
      AND type = 'debit'
      AND source = 'cashback_reversal'
      AND status = 'completed'
    LIMIT 1
  `).bind(userId, orderId).first();
  return !!row;
}
async function applyCashbackIfNeeded2(db, order, actorUserId) {
  const orderId = Number(order?.id || 0);
  const userId = Number(order?.user_id || 0);
  const cashbackAmount = Math.max(0, Math.round(normalizeNumber3(order?.cashback_amount)));
  if (!orderId || !userId || cashbackAmount <= 0) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'none',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();
    return { applied: false, reason: "no_cashback" };
  }
  if (String(order.cashback_status || "").toLowerCase() === "completed") {
    return { applied: false, reason: "already_completed" };
  }
  const alreadyDone = await hasCompletedCashbackTx2(db, userId, orderId);
  if (alreadyDone) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();
    return { applied: false, reason: "transaction_exists" };
  }
  const user = await db.prepare(`
    SELECT
      id,
      COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();
  if (!user) {
    return { applied: false, reason: "user_not_found" };
  }
  const balanceBefore = Math.max(0, normalizeNumber3(user.wallet_balance));
  const balanceAfter = balanceBefore + cashbackAmount;
  await db.batch([
    db.prepare(`
      UPDATE users
      SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(balanceAfter, userId),
    db.prepare(`
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        status,
        source,
        description,
        note,
        order_id,
        order_number,
        reference_type,
        reference_id,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, 'cashback', ?, ?, ?, 'completed', 'order_completion', ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      userId,
      cashbackAmount,
      balanceBefore,
      balanceAfter,
      `Cashback for completed order ${order.order_number}`,
      `\u06A9\u0634\u200C\u0628\u06A9 \u0633\u0641\u0627\u0631\u0634 ${order.order_number}`,
      orderId,
      order.order_number,
      String(orderId),
      actorUserId || null
    ),
    db.prepare(`
      UPDATE orders
      SET cashback_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId)
  ]);
  return { applied: true, amount: cashbackAmount };
}
async function reverseCashbackIfNeeded2(db, order, actorUserId) {
  const orderId = Number(order?.id || 0);
  const userId = Number(order?.user_id || 0);
  const cashbackAmount = Math.max(0, Math.round(normalizeNumber3(order?.cashback_amount)));
  if (!orderId || !userId || cashbackAmount <= 0) {
    return { reversed: false, reason: "no_cashback" };
  }
  if (String(order.cashback_status || "").toLowerCase() !== "completed") {
    return { reversed: false, reason: "not_completed" };
  }
  const alreadyReversed = await hasCashbackReversalTx2(db, userId, orderId);
  if (alreadyReversed) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'reversed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();
    return { reversed: false, reason: "already_reversed" };
  }
  const cashbackExists = await hasCompletedCashbackTx2(db, userId, orderId);
  if (!cashbackExists) {
    await db.prepare(`
      UPDATE orders
      SET cashback_status = 'none',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId).run();
    return { reversed: false, reason: "cashback_tx_missing" };
  }
  const user = await db.prepare(`
    SELECT
      id,
      COALESCE(wallet_balance, 0) AS wallet_balance
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(userId).first();
  if (!user) {
    return { reversed: false, reason: "user_not_found" };
  }
  const balanceBefore = Math.max(0, normalizeNumber3(user.wallet_balance));
  const reversalAmount = Math.min(balanceBefore, cashbackAmount);
  const balanceAfter = Math.max(0, balanceBefore - reversalAmount);
  await db.batch([
    db.prepare(`
      UPDATE users
      SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(balanceAfter, userId),
    db.prepare(`
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        status,
        source,
        description,
        note,
        order_id,
        order_number,
        reference_type,
        reference_id,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, 'debit', ?, ?, ?, 'completed', 'cashback_reversal', ?, ?, ?, ?, 'order', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      userId,
      reversalAmount,
      balanceBefore,
      balanceAfter,
      `Cashback reversal for order ${order.order_number}`,
      `\u0628\u0631\u06AF\u0634\u062A \u06A9\u0634\u200C\u0628\u06A9 \u0633\u0641\u0627\u0631\u0634 ${order.order_number}`,
      orderId,
      order.order_number,
      String(orderId),
      actorUserId || null
    ),
    db.prepare(`
      UPDATE orders
      SET cashback_status = 'reversed',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(orderId)
  ]);
  return { reversed: true, amount: reversalAmount };
}
async function onRequestGet8(context) {
  try {
    const user = await getCurrentUser6(context);
    if (!user || !isAdmin2(user)) {
      return json12({ success: false, error: "unauthorized" }, 401);
    }
    const url = new URL(context.request.url);
    const search = normalizeText3(url.searchParams.get("search"));
    const status = normalizeText3(url.searchParams.get("status")).toLowerCase();
    const paymentStatus = normalizeText3(url.searchParams.get("paymentStatus") || url.searchParams.get("payment_status")).toLowerCase();
    const conditions = [];
    const bindings = [];
    if (search) {
      conditions.push(`(
        o.order_number LIKE ?
        OR u.full_name LIKE ?
        OR u.email LIKE ?
        OR u.phone LIKE ?
      )`);
      const q = `%${search}%`;
      bindings.push(q, q, q, q);
    }
    if (status) {
      conditions.push(`LOWER(o.status) = ?`);
      bindings.push(status);
    }
    if (paymentStatus) {
      conditions.push(`LOWER(o.payment_status) = ?`);
      bindings.push(paymentStatus);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await context.env.DB.prepare(`
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.payment_status,
        COALESCE(o.subtotal_amount, 0) AS subtotal_amount,
        COALESCE(o.shipping_amount, 0) AS shipping_amount,
        COALESCE(o.total_amount, 0) AS total_amount,
        COALESCE(o.wallet_used_amount, 0) AS wallet_used_amount,
        COALESCE(o.cashback_amount, 0) AS cashback_amount,
        COALESCE(
          MAX(0, COALESCE(o.total_amount, 0) - COALESCE(o.wallet_used_amount, 0)),
          0
        ) AS payable_amount,
        o.created_at,
        u.full_name,
        u.email,
        u.phone AS user_phone,
        a.full_name AS address_full_name,
        a.address_line AS address_line,
        a.postal_code AS address_postal_code,
        a.phone AS address_phone,
        a.city AS address_city,
        a.state AS address_state
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN addresses a ON a.id = o.address_id
      ${whereClause}
      ORDER BY o.id DESC
      LIMIT 300
    `).bind(...bindings).all();
    const orders = (Array.isArray(result?.results) ? result.results : []).map((order) => {
      const address = order.address_id ? {
        full_name: order.address_full_name || "",
        address_line: order.address_line || "",
        postal_code: order.address_postal_code || "",
        phone: order.address_phone || "",
        city: order.address_city || "",
        state: order.address_state || ""
      } : null;
      return {
        ...order,
        subtotal_amount: normalizeNumber3(order.subtotal_amount),
        shipping_amount: normalizeNumber3(order.shipping_amount),
        total_amount: normalizeNumber3(order.total_amount),
        wallet_used_amount: normalizeNumber3(order.wallet_used_amount),
        cashback_amount: normalizeNumber3(order.cashback_amount),
        payable_amount: Math.max(
          0,
          normalizeNumber3(
            order.payable_amount != null ? order.payable_amount : normalizeNumber3(order.total_amount) - normalizeNumber3(order.wallet_used_amount)
          )
        ),
        address,
        // برای سازگاری با نسخه قبلی
        shipping_address: address
      };
    });
    return json12({ success: true, orders });
  } catch (error) {
    return json12({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPost6(context) {
  try {
    const user = await getCurrentUser6(context);
    if (!user || !isAdmin2(user)) {
      return json12({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json().catch(() => null);
    const orderNumber = normalizeText3(body?.order_number);
    const nextStatus = normalizeText3(body?.status).toLowerCase();
    const nextPaymentStatus = normalizeText3(body?.payment_status).toLowerCase();
    if (!orderNumber) {
      return json12({ success: false, error: "order_number_required" }, 400);
    }
    const allowedOrderStatuses = ["pending", "processing", "shipped", "completed", "cancelled"];
    const allowedPaymentStatuses = ["pending", "paid", "completed", "failed"];
    if (nextStatus && !allowedOrderStatuses.includes(nextStatus)) {
      return json12({ success: false, error: "invalid_order_status" }, 400);
    }
    if (nextPaymentStatus && !allowedPaymentStatuses.includes(nextPaymentStatus)) {
      return json12({ success: false, error: "invalid_payment_status" }, 400);
    }
    const currentOrder = await getOrderByNumber2(context.env.DB, orderNumber);
    if (!currentOrder) {
      return json12({ success: false, error: "order_not_found" }, 404);
    }
    const finalStatus = nextStatus || String(currentOrder.status || "pending").toLowerCase();
    const finalPaymentStatus = nextPaymentStatus || String(currentOrder.payment_status || "pending").toLowerCase();
    await context.env.DB.prepare(`
      UPDATE orders
      SET
        status = ?,
        payment_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(finalStatus, finalPaymentStatus, currentOrder.id).run();
    const updatedOrder = await getOrderByNumber2(context.env.DB, orderNumber);
    let cashbackResult = null;
    if (finalStatus === "completed") {
      cashbackResult = await applyCashbackIfNeeded2(context.env.DB, updatedOrder, user.id);
    } else if (["pending", "processing", "shipped", "cancelled"].includes(finalStatus) && String(updatedOrder.cashback_status || "").toLowerCase() === "completed") {
      cashbackResult = await reverseCashbackIfNeeded2(context.env.DB, updatedOrder, user.id);
    }
    const finalOrder = await getOrderByNumber2(context.env.DB, orderNumber);
    const items = await getOrderItems2(context.env.DB, finalOrder.id);
    const payableAmount = Math.max(
      0,
      normalizeNumber3(finalOrder.total_amount) - normalizeNumber3(finalOrder.wallet_used_amount)
    );
    return json12({
      success: true,
      message: "order_updated",
      cashback_result: cashbackResult,
      order: {
        ...finalOrder,
        subtotal_amount: normalizeNumber3(finalOrder.subtotal_amount),
        shipping_amount: normalizeNumber3(finalOrder.shipping_amount),
        total_amount: normalizeNumber3(finalOrder.total_amount),
        wallet_used_amount: normalizeNumber3(finalOrder.wallet_used_amount),
        cashback_amount: normalizeNumber3(finalOrder.cashback_amount),
        payable_amount: payableAmount,
        items
      }
    });
  } catch (error) {
    return json12({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestDelete4(context) {
  try {
    const user = await getCurrentUser6(context);
    if (!user || !isAdmin2(user)) {
      return json12({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json().catch(() => null);
    const orderNumber = normalizeText3(body?.order_number);
    if (!orderNumber) {
      return json12({ success: false, error: "order_number_required" }, 400);
    }
    const order = await getOrderByNumber2(context.env.DB, orderNumber);
    if (!order) {
      return json12({ success: false, error: "order_not_found" }, 404);
    }
    await context.env.DB.batch([
      context.env.DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(order.id),
      context.env.DB.prepare(`DELETE FROM orders WHERE id = ?`).bind(order.id)
    ]);
    return json12({ success: true, message: "order_deleted" });
  } catch (error) {
    return json12({ success: false, error: String(error?.message || error) }, 500);
  }
}
var init_orders2 = __esm({
  "api/admin/orders.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(getCookie7, "getCookie");
    __name(json12, "json");
    __name(normalizeText3, "normalizeText");
    __name(normalizeNumber3, "normalizeNumber");
    __name(getCurrentUser6, "getCurrentUser");
    __name(isAdmin2, "isAdmin");
    __name(getOrderByNumber2, "getOrderByNumber");
    __name(getOrderItems2, "getOrderItems");
    __name(hasCompletedCashbackTx2, "hasCompletedCashbackTx");
    __name(hasCashbackReversalTx2, "hasCashbackReversalTx");
    __name(applyCashbackIfNeeded2, "applyCashbackIfNeeded");
    __name(reverseCashbackIfNeeded2, "reverseCashbackIfNeeded");
    __name(onRequestGet8, "onRequestGet");
    __name(onRequestPost6, "onRequestPost");
    __name(onRequestDelete4, "onRequestDelete");
  }
});

// api/admin/products.js
function json13(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
function cleanText2(value, maxLength = 1e4) {
  return String(value ?? "").trim().slice(0, maxLength);
}
function cleanSlug2(value) {
  return cleanText2(value, 160).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}
function toInteger2(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function toPositiveId(value) {
  const id = toInteger2(value, 0);
  return id > 0 ? id : 0;
}
function toOptionalPrice2(value) {
  if (value === null || value === void 0 || value === "") {
    return null;
  }
  const normalized = String(value).replace(/[,\s]/g, "");
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}
function toBooleanInteger2(value, fallback = 0) {
  if (typeof value === "boolean") return value ? 1 : 0;
  const normalized = String(value ?? "").toLowerCase().trim();
  if (["1", "true", "yes", "on"].includes(normalized)) return 1;
  if (["0", "false", "no", "off", ""].includes(normalized)) return 0;
  return fallback ? 1 : 0;
}
function normalizeStatus2(value) {
  const status = cleanText2(value, 30).toLowerCase();
  if (["published", "draft", "private"].includes(status)) {
    return status;
  }
  return "draft";
}
function normalizeImageUrl2(value) {
  const url = cleanText2(value, 2e3);
  if (!url) return "";
  if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `/${url.replace(/^\.?\//, "")}`;
}
function normalizeImages2(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = /* @__PURE__ */ new Set();
  const images = [];
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    const imageUrl = normalizeImageUrl2(
      typeof item === "string" ? item : item?.image_url ?? item?.imageUrl
    );
    if (!imageUrl || seen.has(imageUrl)) continue;
    seen.add(imageUrl);
    images.push({
      image_url: imageUrl,
      alt_text: cleanText2(
        typeof item === "string" ? "" : item?.alt_text ?? item?.altText,
        300
      ),
      sort_order: Math.max(
        0,
        toInteger2(
          typeof item === "string" ? index + 1 : item?.sort_order ?? item?.sortOrder,
          index + 1
        )
      ),
      is_primary: toBooleanInteger2(
        typeof item === "string" ? index === 0 : item?.is_primary ?? item?.isPrimary,
        index === 0
      )
    });
  }
  if (images.length > 0) {
    const firstPrimaryIndex = images.findIndex(
      (image) => image.is_primary === 1
    );
    images.forEach((image, index) => {
      image.is_primary = index === (firstPrimaryIndex >= 0 ? firstPrimaryIndex : 0) ? 1 : 0;
      image.sort_order = index + 1;
    });
  }
  return images;
}
function formatNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
function productFromRow2(row, imagesByProductId) {
  if (!row) return null;
  const productId = Number(row.id);
  const images = imagesByProductId.get(productId) || [];
  const primaryImage = row.primary_image || images.find((image) => image.is_primary === true)?.image_url || images[0]?.image_url || "";
  let displayPrice = null;
  const priceType = row.price_type || "fixed";
  if (priceType === "rate_based") {
    if (row.calculated_price !== null && row.calculated_price !== void 0) {
      displayPrice = Number(row.calculated_price);
    } else if (row.base_price !== null && row.base_price !== void 0 && row.base_price > 0) {
      displayPrice = Number(row.base_price) * 196e3;
    }
  } else {
    if (row.price !== null && row.price !== void 0) {
      displayPrice = Number(row.price);
    }
  }
  return {
    id: productId,
    slug: row.slug || "",
    name: row.name || "",
    category: row.category || "",
    price: row.price === null || row.price === void 0 ? null : Number(row.price),
    price_label: row.price_label || "\u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F",
    show_price: Number(row.show_price) === 1,
    stock_quantity: Math.max(0, Number(row.stock_quantity || 0)),
    in_stock: Number(row.in_stock) === 1,
    stock_label: row.stock_label || "",
    short_description: row.short_description || "",
    description: row.description || "",
    primary_image: primaryImage,
    page_url: row.page_url || "",
    status: row.status || "draft",
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    images,
    // ⭐ فیلدهای جدید سیستم نرخ ارز
    price_type: row.price_type || "fixed",
    base_price: row.base_price === null || row.base_price === void 0 ? null : Number(row.base_price),
    profit_type: row.profit_type || "none",
    profit_value: row.profit_value === null || row.profit_value === void 0 ? null : Number(row.profit_value),
    fixed_fee: row.fixed_fee === null || row.fixed_fee === void 0 ? null : Number(row.fixed_fee),
    rounding_type: row.rounding_type || "none",
    rounding_method: row.rounding_method || "nearest",
    calculated_price: row.calculated_price === null || row.calculated_price === void 0 ? null : Number(row.calculated_price),
    price_calculated_at: row.price_calculated_at || null,
    display_price: displayPrice,
    display_price_formatted: displayPrice !== null ? `${formatNumber(displayPrice)} \u062A\u0648\u0645\u0627\u0646` : "\u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F"
  };
}
async function getProductImages(db, productIds) {
  const imagesByProductId = /* @__PURE__ */ new Map();
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return imagesByProductId;
  }
  const ids = [...new Set(productIds.map(toPositiveId).filter(Boolean))];
  if (ids.length === 0) {
    return imagesByProductId;
  }
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db.prepare(`
      SELECT
        id,
        product_id,
        image_url,
        alt_text,
        sort_order,
        is_primary,
        created_at
      FROM product_images
      WHERE product_id IN (${placeholders})
      ORDER BY product_id ASC, is_primary DESC, sort_order ASC, id ASC
    `).bind(...ids).all();
  for (const row of result.results || []) {
    const productId = Number(row.product_id);
    if (!imagesByProductId.has(productId)) {
      imagesByProductId.set(productId, []);
    }
    imagesByProductId.get(productId).push({
      id: Number(row.id),
      image_url: row.image_url || "",
      alt_text: row.alt_text || "",
      sort_order: Number(row.sort_order || 0),
      is_primary: Number(row.is_primary) === 1,
      created_at: row.created_at || null
    });
  }
  return imagesByProductId;
}
async function getProductRow(db, productId) {
  return db.prepare(`
      SELECT
        id,
        slug,
        name,
        category,
        price,
        price_label,
        show_price,
        stock_quantity,
        in_stock,
        stock_label,
        short_description,
        description,
        primary_image,
        page_url,
        status,
        created_at,
        updated_at,
        -- \u2B50 \u0641\u06CC\u0644\u062F\u0647\u0627\u06CC \u062C\u062F\u06CC\u062F \u0633\u06CC\u0633\u062A\u0645 \u0646\u0631\u062E \u0627\u0631\u0632
        price_type,
        base_price,
        profit_type,
        profit_value,
        fixed_fee,
        rounding_type,
        rounding_method,
        calculated_price,
        price_calculated_at
      FROM products
      WHERE id = ?
      LIMIT 1
    `).bind(productId).first();
}
async function getProductPayload(db, productId) {
  const row = await getProductRow(db, productId);
  if (!row) return null;
  const imagesByProductId = await getProductImages(db, [productId]);
  return productFromRow2(row, imagesByProductId);
}
function getProductInput(body) {
  const name = cleanText2(body?.name, 250);
  const slug = cleanSlug2(body?.slug || name);
  const category = cleanText2(body?.category, 120);
  const price = toOptionalPrice2(body?.price);
  const priceLabel = cleanText2(body?.price_label ?? body?.priceLabel, 100) || "\u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F";
  const showPrice = toBooleanInteger2(
    body?.show_price ?? body?.showPrice,
    price !== null
  );
  const stockQuantity = Math.max(
    0,
    toInteger2(body?.stock_quantity ?? body?.stockQuantity, 0)
  );
  const inStock = toBooleanInteger2(
    body?.in_stock ?? body?.inStock,
    stockQuantity > 0
  );
  const stockLabel = cleanText2(body?.stock_label ?? body?.stockLabel, 100) || (inStock ? "\u0645\u0648\u062C\u0648\u062F" : "\u0646\u0627\u0645\u0648\u062C\u0648\u062F");
  const shortDescription = cleanText2(
    body?.short_description ?? body?.shortDescription,
    1e3
  );
  const description = cleanText2(body?.description, 2e4);
  const pageUrl = cleanText2(body?.page_url ?? body?.pageUrl, 500);
  const status = normalizeStatus2(body?.status);
  const images = normalizeImages2(body?.images);
  const requestedPrimary = normalizeImageUrl2(
    body?.primary_image ?? body?.primaryImage
  );
  const primaryImage = requestedPrimary || images.find((image) => image.is_primary === 1)?.image_url || images[0]?.image_url || "";
  if (images.length > 0 && primaryImage) {
    const requestedIndex = images.findIndex(
      (image) => image.image_url === primaryImage
    );
    if (requestedIndex >= 0) {
      images.forEach((image, index) => {
        image.is_primary = index === requestedIndex ? 1 : 0;
        image.sort_order = index + 1;
      });
    }
  }
  const priceType = body?.price_type ?? body?.priceType ?? "fixed";
  const basePrice = toOptionalPrice2(body?.base_price ?? body?.basePrice);
  const profitType = body?.profit_type ?? body?.profitType ?? "none";
  const profitValue = toOptionalPrice2(body?.profit_value ?? body?.profitValue);
  const fixedFee = toOptionalPrice2(body?.fixed_fee ?? body?.fixedFee);
  const roundingType = body?.rounding_type ?? body?.roundingType ?? "none";
  const roundingMethod = body?.rounding_method ?? body?.roundingMethod ?? "nearest";
  return {
    name,
    slug,
    category,
    price,
    priceLabel,
    showPrice,
    stockQuantity,
    inStock,
    stockLabel,
    shortDescription,
    description,
    pageUrl,
    status,
    primaryImage,
    images,
    // ⭐ فیلدهای جدید
    priceType,
    basePrice,
    profitType,
    profitValue,
    fixedFee,
    roundingType,
    roundingMethod
  };
}
async function replaceProductImages(db, productId, images, defaultAltText) {
  await db.prepare("DELETE FROM product_images WHERE product_id = ?").bind(productId).run();
  if (!images.length) return;
  const statements = images.map(
    (image, index) => db.prepare(`
        INSERT INTO product_images (
          product_id,
          image_url,
          alt_text,
          sort_order,
          is_primary
        )
        VALUES (?, ?, ?, ?, ?)
      `).bind(
      productId,
      image.image_url,
      image.alt_text || defaultAltText || "",
      index + 1,
      image.is_primary === 1 ? 1 : 0
    )
  );
  await db.batch(statements);
}
async function onRequestGet9(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const url = new URL(context.request.url);
    const search = cleanText2(url.searchParams.get("search"), 160);
    const status = cleanText2(url.searchParams.get("status"), 30).toLowerCase();
    const category = cleanText2(url.searchParams.get("category"), 120);
    const page = Math.max(1, toInteger2(url.searchParams.get("page"), 1));
    const limit = Math.min(
      100,
      Math.max(1, toInteger2(url.searchParams.get("limit"), 100))
    );
    const offset = (page - 1) * limit;
    const filters = [];
    const bindings = [];
    if (search) {
      const like = `%${search}%`;
      filters.push("(name LIKE ? OR slug LIKE ? OR category LIKE ?)");
      bindings.push(like, like, like);
    }
    if (["published", "draft", "private"].includes(status)) {
      filters.push("status = ?");
      bindings.push(status);
    }
    if (category) {
      filters.push("category = ?");
      bindings.push(category);
    }
    const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const countRow = await context.env.DB.prepare(`
        SELECT COUNT(*) AS total
        FROM products
        ${whereSql}
      `).bind(...bindings).first();
    const productsResult = await context.env.DB.prepare(`
        SELECT
          id,
          slug,
          name,
          category,
          price,
          price_label,
          show_price,
          stock_quantity,
          in_stock,
          stock_label,
          short_description,
          description,
          primary_image,
          page_url,
          status,
          created_at,
          updated_at,
          -- \u2B50 \u0641\u06CC\u0644\u062F\u0647\u0627\u06CC \u062C\u062F\u06CC\u062F \u0633\u06CC\u0633\u062A\u0645 \u0646\u0631\u062E \u0627\u0631\u0632
          price_type,
          base_price,
          profit_type,
          profit_value,
          fixed_fee,
          rounding_type,
          rounding_method,
          calculated_price,
          price_calculated_at
        FROM products
        ${whereSql}
        ORDER BY updated_at DESC, id DESC
        LIMIT ? OFFSET ?
      `).bind(...bindings, limit, offset).all();
    const rows = productsResult.results || [];
    const imagesByProductId = await getProductImages(
      context.env.DB,
      rows.map((row) => row.id)
    );
    const categoriesResult = await context.env.DB.prepare(`
        SELECT DISTINCT category
        FROM products
        WHERE category IS NOT NULL AND TRIM(category) != ''
        ORDER BY category COLLATE NOCASE ASC
      `).all();
    const total = Number(countRow?.total || 0);
    return json13({
      success: true,
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      categories: (categoriesResult.results || []).map((row) => row.category).filter(Boolean),
      products: rows.map((row) => productFromRow2(row, imagesByProductId))
    });
  } catch (error) {
    return json13(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
async function onRequestPost7(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json13({ success: false, error: "invalid_request_body" }, 400);
    }
    const input = getProductInput(body);
    if (!input.name) {
      return json13(
        {
          success: false,
          error: "\u0646\u0627\u0645 \u0645\u062D\u0635\u0648\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."
        },
        400
      );
    }
    if (!input.slug) {
      return json13(
        {
          success: false,
          error: "slug \u0645\u062D\u0635\u0648\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A. slug \u0628\u0627\u06CC\u062F \u0641\u0642\u0637 \u0634\u0627\u0645\u0644 \u062D\u0631\u0648\u0641 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC\u060C \u0639\u062F\u062F \u0648 \u062E\u0637 \u062A\u06CC\u0631\u0647 \u0628\u0627\u0634\u062F."
        },
        400
      );
    }
    if (input.priceType === "rate_based") {
      if (!input.basePrice || input.basePrice <= 0) {
        return json13(
          {
            success: false,
            error: "\u0628\u0631\u0627\u06CC \u0645\u062D\u0635\u0648\u0644\u0627\u062A \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u0646\u0631\u062E \u0627\u0631\u0632\u060C \u0642\u06CC\u0645\u062A \u067E\u0627\u06CC\u0647 \u0628\u0647 \u062F\u0644\u0627\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."
          },
          400
        );
      }
    }
    const existing = await context.env.DB.prepare("SELECT id FROM products WHERE slug = ? LIMIT 1").bind(input.slug).first();
    if (existing) {
      return json13(
        {
          success: false,
          error: "\u0627\u06CC\u0646 slug \u0642\u0628\u0644\u0627\u064B \u0628\u0631\u0627\u06CC \u06CC\u06A9 \u0645\u062D\u0635\u0648\u0644 \u062F\u06CC\u06AF\u0631 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A."
        },
        409
      );
    }
    let calculatedPrice = null;
    if (input.priceType === "rate_based" && input.basePrice) {
      try {
        const rate = await getCurrentRate(context.env, "USD");
        if (rate) {
          const tempProduct = {
            price_type: input.priceType,
            base_price: input.basePrice,
            profit_type: input.profitType,
            profit_value: input.profitValue,
            fixed_fee: input.fixedFee,
            rounding_type: input.roundingType,
            rounding_method: input.roundingMethod
          };
          calculatedPrice = calculateProductPrice(tempProduct, rate.rate);
        }
      } catch (_) {
      }
    }
    const insertResult = await context.env.DB.prepare(`
        INSERT INTO products (
          slug,
          name,
          category,
          price,
          price_label,
          show_price,
          stock_quantity,
          in_stock,
          stock_label,
          short_description,
          description,
          primary_image,
          page_url,
          status,
          -- \u2B50 \u0641\u06CC\u0644\u062F\u0647\u0627\u06CC \u062C\u062F\u06CC\u062F
          price_type,
          base_price,
          profit_type,
          profit_value,
          fixed_fee,
          rounding_type,
          rounding_method,
          calculated_price,
          price_calculated_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
      input.slug,
      input.name,
      input.category || null,
      input.price,
      input.priceLabel,
      input.showPrice,
      input.stockQuantity,
      input.inStock,
      input.stockLabel,
      input.shortDescription || null,
      input.description || null,
      input.primaryImage || null,
      input.pageUrl || null,
      input.status,
      input.priceType,
      input.basePrice || null,
      input.profitType,
      input.profitValue || null,
      input.fixedFee || null,
      input.roundingType,
      input.roundingMethod,
      calculatedPrice
    ).run();
    const productId = Number(insertResult.meta?.last_row_id || 0);
    if (!productId) {
      return json13(
        {
          success: false,
          error: "\u062B\u0628\u062A \u0645\u062D\u0635\u0648\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F."
        },
        500
      );
    }
    await replaceProductImages(
      context.env.DB,
      productId,
      input.images,
      input.name
    );
    const product = await getProductPayload(context.env.DB, productId);
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "product_created",
      target_type: "product",
      target_id: productId,
      description: `Created product: ${input.name} (${input.slug}) - Price type: ${input.priceType}`
    });
    return json13(
      {
        success: true,
        message: "\u0645\u062D\u0635\u0648\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u06CC\u062C\u0627\u062F \u0634\u062F.",
        product
      },
      201
    );
  } catch (error) {
    return json13(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
async function onRequestPut4(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json13({ success: false, error: "invalid_request_body" }, 400);
    }
    const productId = toPositiveId(body.id ?? body.product_id ?? body.productId);
    if (!productId) {
      return json13(
        {
          success: false,
          error: "\u0634\u0646\u0627\u0633\u0647 \u0645\u062D\u0635\u0648\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A."
        },
        400
      );
    }
    const currentProduct = await getProductRow(context.env.DB, productId);
    if (!currentProduct) {
      return json13(
        {
          success: false,
          error: "\u0645\u062D\u0635\u0648\u0644 \u0645\u0648\u0631\u062F\u0646\u0638\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F."
        },
        404
      );
    }
    const input = getProductInput(body);
    if (!input.name) {
      return json13(
        {
          success: false,
          error: "\u0646\u0627\u0645 \u0645\u062D\u0635\u0648\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."
        },
        400
      );
    }
    if (!input.slug) {
      return json13(
        {
          success: false,
          error: "slug \u0645\u062D\u0635\u0648\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A. slug \u0628\u0627\u06CC\u062F \u0641\u0642\u0637 \u0634\u0627\u0645\u0644 \u062D\u0631\u0648\u0641 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC\u060C \u0639\u062F\u062F \u0648 \u062E\u0637 \u062A\u06CC\u0631\u0647 \u0628\u0627\u0634\u062F."
        },
        400
      );
    }
    if (input.priceType === "rate_based") {
      if (!input.basePrice || input.basePrice <= 0) {
        return json13(
          {
            success: false,
            error: "\u0628\u0631\u0627\u06CC \u0645\u062D\u0635\u0648\u0644\u0627\u062A \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647 \u0646\u0631\u062E \u0627\u0631\u0632\u060C \u0642\u06CC\u0645\u062A \u067E\u0627\u06CC\u0647 \u0628\u0647 \u062F\u0644\u0627\u0631 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."
          },
          400
        );
      }
    }
    const duplicate = await context.env.DB.prepare("SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1").bind(input.slug, productId).first();
    if (duplicate) {
      return json13(
        {
          success: false,
          error: "\u0627\u06CC\u0646 slug \u0642\u0628\u0644\u0627\u064B \u0628\u0631\u0627\u06CC \u0645\u062D\u0635\u0648\u0644 \u062F\u06CC\u06AF\u0631\u06CC \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A."
        },
        409
      );
    }
    let calculatedPrice = null;
    if (input.priceType === "rate_based" && input.basePrice) {
      try {
        const rate = await getCurrentRate(context.env, "USD");
        if (rate) {
          const tempProduct = {
            price_type: input.priceType,
            base_price: input.basePrice,
            profit_type: input.profitType,
            profit_value: input.profitValue,
            fixed_fee: input.fixedFee,
            rounding_type: input.roundingType,
            rounding_method: input.roundingMethod
          };
          calculatedPrice = calculateProductPrice(tempProduct, rate.rate);
        }
      } catch (_) {
      }
    } else if (input.priceType === "fixed") {
      calculatedPrice = null;
    }
    await context.env.DB.prepare(`
        UPDATE products
        SET
          slug = ?,
          name = ?,
          category = ?,
          price = ?,
          price_label = ?,
          show_price = ?,
          stock_quantity = ?,
          in_stock = ?,
          stock_label = ?,
          short_description = ?,
          description = ?,
          primary_image = ?,
          page_url = ?,
          status = ?,
          -- \u2B50 \u0641\u06CC\u0644\u062F\u0647\u0627\u06CC \u062C\u062F\u06CC\u062F
          price_type = ?,
          base_price = ?,
          profit_type = ?,
          profit_value = ?,
          fixed_fee = ?,
          rounding_type = ?,
          rounding_method = ?,
          calculated_price = ?,
          price_calculated_at = CASE 
            WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP 
            ELSE price_calculated_at 
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
      input.slug,
      input.name,
      input.category || null,
      input.price,
      input.priceLabel,
      input.showPrice,
      input.stockQuantity,
      input.inStock,
      input.stockLabel,
      input.shortDescription || null,
      input.description || null,
      input.primaryImage || null,
      input.pageUrl || null,
      input.status,
      input.priceType,
      input.basePrice || null,
      input.profitType,
      input.profitValue || null,
      input.fixedFee || null,
      input.roundingType,
      input.roundingMethod,
      calculatedPrice,
      calculatedPrice,
      productId
    ).run();
    await replaceProductImages(
      context.env.DB,
      productId,
      input.images,
      input.name
    );
    const product = await getProductPayload(context.env.DB, productId);
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "product_updated",
      target_type: "product",
      target_id: productId,
      description: `Updated product: ${input.name} (${input.slug}) - Price type: ${input.priceType}`
    });
    return json13({
      success: true,
      message: "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0645\u062D\u0635\u0648\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.",
      product
    });
  } catch (error) {
    return json13(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
async function onRequestDelete5(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const url = new URL(context.request.url);
    let productId = toPositiveId(url.searchParams.get("id"));
    if (!productId) {
      const body = await context.request.json().catch(() => null);
      productId = toPositiveId(body?.id ?? body?.product_id ?? body?.productId);
    }
    if (!productId) {
      return json13(
        {
          success: false,
          error: "\u0634\u0646\u0627\u0633\u0647 \u0645\u062D\u0635\u0648\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A."
        },
        400
      );
    }
    const product = await getProductRow(context.env.DB, productId);
    if (!product) {
      return json13(
        {
          success: false,
          error: "\u0645\u062D\u0635\u0648\u0644 \u0645\u0648\u0631\u062F\u0646\u0638\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F \u06CC\u0627 \u0642\u0628\u0644\u0627\u064B \u062D\u0630\u0641 \u0634\u062F\u0647 \u0627\u0633\u062A."
        },
        404
      );
    }
    await context.env.DB.batch([
      context.env.DB.prepare("DELETE FROM product_images WHERE product_id = ?").bind(productId),
      context.env.DB.prepare("DELETE FROM products WHERE id = ?").bind(productId)
    ]);
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "product_deleted",
      target_type: "product",
      target_id: productId,
      description: `Deleted product: ${product.name} (${product.slug})`
    });
    return json13({
      success: true,
      message: "\u0645\u062D\u0635\u0648\u0644 \u0648 \u06AF\u0627\u0644\u0631\u06CC \u062A\u0635\u0627\u0648\u06CC\u0631 \u0622\u0646 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F.",
      deleted_product: {
        id: Number(product.id),
        name: product.name,
        slug: product.slug
      }
    });
  } catch (error) {
    return json13(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
var init_products = __esm({
  "api/admin/products.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    init_rate();
    __name(json13, "json");
    __name(cleanText2, "cleanText");
    __name(cleanSlug2, "cleanSlug");
    __name(toInteger2, "toInteger");
    __name(toPositiveId, "toPositiveId");
    __name(toOptionalPrice2, "toOptionalPrice");
    __name(toBooleanInteger2, "toBooleanInteger");
    __name(normalizeStatus2, "normalizeStatus");
    __name(normalizeImageUrl2, "normalizeImageUrl");
    __name(normalizeImages2, "normalizeImages");
    __name(formatNumber, "formatNumber");
    __name(productFromRow2, "productFromRow");
    __name(getProductImages, "getProductImages");
    __name(getProductRow, "getProductRow");
    __name(getProductPayload, "getProductPayload");
    __name(getProductInput, "getProductInput");
    __name(replaceProductImages, "replaceProductImages");
    __name(onRequestGet9, "onRequestGet");
    __name(onRequestPost7, "onRequestPost");
    __name(onRequestPut4, "onRequestPut");
    __name(onRequestDelete5, "onRequestDelete");
  }
});

// api/admin/settings.js
function json14(data, status = 200) {
  return Response.json(data, { status });
}
function normalizeText4(value) {
  return String(value ?? "").trim();
}
async function onRequestGet10(context) {
  try {
    const user = await getCurrentUser2(context);
    const result = await context.env.DB.prepare(`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key LIKE 'invoice_%'
         OR setting_key IN (
           'cashback_percent', 
           'cashback_statuses', 
           'allow_public_registration',
           'rate_default_currency',
           'rate_api_provider',
           'rate_api_url',
           'rate_api_key',
           'rate_update_interval',
           'rate_auto_update_enabled'
         )
    `).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const settings = {};
    for (const row of rows) {
      settings[String(row.setting_key || "").trim()] = String(row.setting_value || "").trim();
    }
    const defaults = {
      invoice_logo: "",
      invoice_thankyou_text: "\u0633\u067E\u0627\u0633\u200C\u06AF\u0632\u0627\u0631\u06CC\u0645 \u06A9\u0647 \u0627\u0632 \u062A\u06A9 \u062A\u062C\u0627\u0631\u062A \u062E\u0631\u06CC\u062F \u06A9\u0631\u062F\u06CC\u062F. \u0633\u0641\u0627\u0631\u0634 \u0634\u0645\u0627 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F.",
      invoice_bank_account: "\u0628\u0627\u0646\u06A9 \u0645\u0644\u06CC - \u0634\u0645\u0627\u0631\u0647 \u062D\u0633\u0627\u0628: \u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9\u06F0",
      invoice_card_number: "\u06F6\u06F0\u06F3\u06F7-\u06F7\u06F9\u06F9\u06F1-\u06F5\u06F0\u06F5\u06F4-\u06F4\u06F3\u06F4\u06F2",
      invoice_sheba_number: "IR\u06F4\u06F5\u06F0\u06F1\u06F7\u06F0\u06F0\u06F0\u06F0\u06F0\u06F0\u06F0\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9\u06F0",
      invoice_payment_deadline: "\u06F2\u06F4 \u0633\u0627\u0639\u062A",
      invoice_payment_description: "\u0644\u0637\u0641\u0627\u064B \u0645\u0628\u0644\u063A \u0641\u0627\u06A9\u062A\u0648\u0631 \u0631\u0627 \u0628\u0647 \u0634\u0645\u0627\u0631\u0647 \u06A9\u0627\u0631\u062A \u062F\u0631\u062C \u0634\u062F\u0647 \u0648\u0627\u0631\u06CC\u0632 \u0648 \u062A\u0635\u0648\u06CC\u0631 \u0631\u0633\u06CC\u062F \u0631\u0627 \u0628\u0647 \u0634\u0645\u0627\u0631\u0647 \u0648\u0627\u062A\u0633\u0627\u067E \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0627\u0631\u0633\u0627\u0644 \u06A9\u0646\u06CC\u062F.",
      invoice_whatsapp_number: "\u06F0\u06F9\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9",
      invoice_company_name: "\u062A\u06A9 \u062A\u062C\u0627\u0631\u062A",
      invoice_company_phone: "\u06F0\u06F2\u06F1-\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8",
      invoice_company_address: "\u062A\u0647\u0631\u0627\u0646\u060C \u062E\u06CC\u0627\u0628\u0627\u0646 \u0648\u0644\u06CC\u0639\u0635\u0631\u060C \u067E\u0644\u0627\u06A9 \u06F1\u06F2\u06F3",
      allow_public_registration: "true",
      // ⭐ تنظیمات پیش‌فرض نرخ ارز
      rate_default_currency: "USD",
      rate_api_provider: "tgju",
      rate_api_url: "https://api.tgju.org/v1/market/price/price_dollar_rl",
      rate_api_key: "",
      rate_update_interval: "3600",
      rate_auto_update_enabled: "false"
    };
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (!settings[key] || settings[key] === "") {
        settings[key] = defaultValue;
      }
    }
    return json14({
      success: true,
      settings
    });
  } catch (error) {
    return json14({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
async function onRequestPost8(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json14({ success: false, error: "invalid_payload" }, 400);
    }
    const allowedKeys = [
      "invoice_logo",
      "invoice_thankyou_text",
      "invoice_bank_account",
      "invoice_card_number",
      "invoice_sheba_number",
      "invoice_payment_deadline",
      "invoice_payment_description",
      "invoice_whatsapp_number",
      "invoice_company_name",
      "invoice_company_phone",
      "invoice_company_address",
      "allow_public_registration",
      // ⭐ تنظیمات جدید نرخ ارز
      "rate_default_currency",
      "rate_api_provider",
      "rate_api_url",
      "rate_api_key",
      "rate_update_interval",
      "rate_auto_update_enabled"
    ];
    const operations = [];
    for (const key of allowedKeys) {
      if (body[key] !== void 0) {
        const value = normalizeText4(body[key]);
        operations.push(
          context.env.DB.prepare(`
            INSERT INTO app_settings (setting_key, setting_value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(setting_key) DO UPDATE SET
              setting_value = excluded.setting_value,
              updated_at = CURRENT_TIMESTAMP
          `).bind(key, value)
        );
      }
    }
    if (operations.length) {
      await context.env.DB.batch(operations);
    }
    const result = await context.env.DB.prepare(`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key LIKE 'invoice_%'
         OR setting_key IN (
           'cashback_percent', 
           'cashback_statuses', 
           'allow_public_registration',
           'rate_default_currency',
           'rate_api_provider',
           'rate_api_url',
           'rate_api_key',
           'rate_update_interval',
           'rate_auto_update_enabled'
         )
    `).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const settings = {};
    for (const row of rows) {
      settings[String(row.setting_key || "").trim()] = String(row.setting_value || "").trim();
    }
    return json14({
      success: true,
      message: "settings_saved",
      settings
    });
  } catch (error) {
    return json14({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_settings = __esm({
  "api/admin/settings.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    __name(json14, "json");
    __name(normalizeText4, "normalizeText");
    __name(onRequestGet10, "onRequestGet");
    __name(onRequestPost8, "onRequestPost");
  }
});

// api/admin/shipping.js
function getCookie8(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json15(data, status = 200) {
  return Response.json(data, { status });
}
function normalizeText5(value) {
  return String(value ?? "").trim();
}
function normalizeNumber4(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}
async function getCurrentUser7(context) {
  const cookieString = context.request.headers.get("cookie") || "";
  const sessionId = getCookie8(cookieString, "session_id");
  if (!sessionId) return null;
  return await context.env.DB.prepare(`
    SELECT id, full_name, email, phone, role
    FROM users
    WHERE id = (SELECT user_id FROM sessions WHERE id = ? LIMIT 1)
    LIMIT 1
  `).bind(sessionId).first();
}
function isAdmin3(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "admin" || role === "super_admin";
}
async function onRequestGet11(context) {
  try {
    const user = await getCurrentUser7(context);
    if (!user || !isAdmin3(user)) {
      return json15({ success: false, error: "unauthorized" }, 401);
    }
    const url = new URL(context.request.url);
    const action = url.searchParams.get("action");
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
      return json15({ success: true, methods });
    }
    if (action === "costs") {
      const province = normalizeText5(url.searchParams.get("province"));
      const city = normalizeText5(url.searchParams.get("city"));
      if (!province || !city) {
        return json15({ success: false, error: "province_and_city_required" }, 400);
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
      return json15({ success: true, costs });
    }
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
      for (const m of Array.isArray(methods?.results) ? methods.results : []) {
        methodMap[m.id] = m.name;
      }
      const enriched = thresholds.map((t) => ({
        ...t,
        method_name: methodMap[t.shipping_method_id] || "\u0646\u0627\u0645\u0634\u062E\u0635"
      }));
      return json15({ success: true, thresholds: enriched });
    }
    return json15({ success: false, error: "invalid_action" }, 400);
  } catch (error) {
    return json15({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPost9(context) {
  try {
    const user = await getCurrentUser7(context);
    if (!user || !isAdmin3(user)) {
      return json15({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json().catch(() => null);
    if (!body) {
      return json15({ success: false, error: "invalid_payload" }, 400);
    }
    const action = body.action || "create_method";
    if (action === "create_method") {
      const name = normalizeText5(body.name);
      const slug = normalizeText5(body.slug).toLowerCase().replace(/\s+/g, "-");
      const description = normalizeText5(body.description);
      const delivery_time = normalizeText5(body.delivery_time);
      const default_cost = normalizeNumber4(body.default_cost);
      const is_active = body.is_active === true || body.is_active === "true" ? 1 : 0;
      const sort_order = normalizeNumber4(body.sort_order);
      if (!name || !slug) {
        return json15({ success: false, error: "name_and_slug_required" }, 400);
      }
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE slug = ?
      `).bind(slug).first();
      if (existing) {
        return json15({ success: false, error: "slug_already_exists" }, 400);
      }
      const result = await context.env.DB.prepare(`
        INSERT INTO shipping_methods (name, slug, description, delivery_time, default_cost, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(name, slug, description, delivery_time, default_cost, is_active, sort_order).run();
      const newId = result.meta?.last_row_id || null;
      return json15({
        success: true,
        message: "\u0631\u0648\u0634 \u062D\u0645\u0644\u200C\u0648\u0646\u0642\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u06CC\u062C\u0627\u062F \u0634\u062F.",
        method: { id: newId, name, slug, description, delivery_time, default_cost, is_active, sort_order }
      });
    }
    if (action === "update_method") {
      const id = normalizeNumber4(body.id);
      const name = normalizeText5(body.name);
      const slug = normalizeText5(body.slug).toLowerCase().replace(/\s+/g, "-");
      const description = normalizeText5(body.description);
      const delivery_time = normalizeText5(body.delivery_time);
      const default_cost = normalizeNumber4(body.default_cost);
      const is_active = body.is_active === true || body.is_active === "true" ? 1 : 0;
      const sort_order = normalizeNumber4(body.sort_order);
      if (!id || !name || !slug) {
        return json15({ success: false, error: "id_name_slug_required" }, 400);
      }
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE id = ?
      `).bind(id).first();
      if (!existing) {
        return json15({ success: false, error: "method_not_found" }, 404);
      }
      const duplicate = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE slug = ? AND id != ?
      `).bind(slug, id).first();
      if (duplicate) {
        return json15({ success: false, error: "slug_already_exists" }, 400);
      }
      await context.env.DB.prepare(`
        UPDATE shipping_methods
        SET name = ?, slug = ?, description = ?, delivery_time = ?, default_cost = ?, is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(name, slug, description, delivery_time, default_cost, is_active, sort_order, id).run();
      return json15({
        success: true,
        message: "\u0631\u0648\u0634 \u062D\u0645\u0644\u200C\u0648\u0646\u0642\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F."
      });
    }
    if (action === "delete_method") {
      const id = normalizeNumber4(body.id);
      if (!id) {
        return json15({ success: false, error: "id_required" }, 400);
      }
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE id = ?
      `).bind(id).first();
      if (!existing) {
        return json15({ success: false, error: "method_not_found" }, 404);
      }
      await context.env.DB.prepare(`
        DELETE FROM shipping_methods WHERE id = ?
      `).bind(id).run();
      return json15({
        success: true,
        message: "\u0631\u0648\u0634 \u062D\u0645\u0644\u200C\u0648\u0646\u0642\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F."
      });
    }
    if (action === "delete_cost") {
      const cost_id = normalizeNumber4(body.cost_id);
      if (!cost_id) {
        return json15({ success: false, error: "cost_id_required" }, 400);
      }
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_costs WHERE id = ?
      `).bind(cost_id).first();
      if (!existing) {
        return json15({ success: false, error: "cost_not_found" }, 404);
      }
      await context.env.DB.prepare(`
        DELETE FROM shipping_costs WHERE id = ?
      `).bind(cost_id).run();
      return json15({
        success: true,
        message: "\u0647\u0632\u06CC\u0646\u0647 \u0627\u0631\u0633\u0627\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F."
      });
    }
    if (action === "save_cost") {
      const province = normalizeText5(body.province);
      const city = normalizeText5(body.city);
      const shipping_method_id = normalizeNumber4(body.shipping_method_id);
      const cost_type = body.cost_type || "fixed";
      const cost_amount = normalizeNumber4(body.cost_amount);
      const extra_cost = normalizeNumber4(body.extra_cost);
      const delivery_time = normalizeText5(body.delivery_time);
      const is_active = body.is_active === true || body.is_active === "true" ? 1 : 0;
      if (!province || !city || !shipping_method_id) {
        return json15({ success: false, error: "province_city_method_required" }, 400);
      }
      const method = await context.env.DB.prepare(`
        SELECT id, default_cost FROM shipping_methods WHERE id = ?
      `).bind(shipping_method_id).first();
      if (!method) {
        return json15({ success: false, error: "method_not_found" }, 404);
      }
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
      return json15({
        success: true,
        message: "\u0647\u0632\u06CC\u0646\u0647 \u0627\u0631\u0633\u0627\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.",
        extra_cost,
        final_cost: finalCost,
        default_cost: defaultCost
      });
    }
    if (action === "add_city") {
      const province = normalizeText5(body.province);
      const city = normalizeText5(body.city);
      if (!province || !city) {
        return json15({ success: false, error: "province_and_city_required" }, 400);
      }
      const defaultMethod = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE slug = 'freight' AND is_active = 1 LIMIT 1
      `).first();
      if (!defaultMethod) {
        return json15({ success: false, error: "default_method_not_found" }, 404);
      }
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_costs 
        WHERE province = ? AND city = ?
        LIMIT 1
      `).bind(province, city).first();
      if (existing) {
        return json15({ success: false, error: "city_already_exists" }, 400);
      }
      const result = await context.env.DB.prepare(`
        INSERT INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, extra_cost, delivery_time, is_active)
        VALUES (?, ?, ?, 'extra', 0, 0, '', 1)
      `).bind(province, city, defaultMethod.id).run();
      return json15({
        success: true,
        message: "\u0634\u0647\u0631 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.",
        city,
        province
      });
    }
    if (action === "delete_city") {
      const province = normalizeText5(body.province);
      const city = normalizeText5(body.city);
      if (!province || !city) {
        return json15({ success: false, error: "province_and_city_required" }, 400);
      }
      await context.env.DB.prepare(`
        DELETE FROM shipping_costs 
        WHERE province = ? AND city = ?
      `).bind(province, city).run();
      return json15({
        success: true,
        message: "\u0634\u0647\u0631 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F."
      });
    }
    if (action === "save_free_threshold") {
      const shipping_method_id = normalizeNumber4(body.shipping_method_id);
      const min_order_amount = normalizeNumber4(body.min_order_amount);
      const is_active = body.is_active === true || body.is_active === "true" ? 1 : 0;
      if (!shipping_method_id || !min_order_amount) {
        return json15({ success: false, error: "method_and_amount_required" }, 400);
      }
      const method = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE id = ?
      `).bind(shipping_method_id).first();
      if (!method) {
        return json15({ success: false, error: "method_not_found" }, 404);
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
      return json15({
        success: true,
        message: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u0631\u0633\u0627\u0644 \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F."
      });
    }
    return json15({ success: false, error: "invalid_action" }, 400);
  } catch (error) {
    return json15({ success: false, error: String(error?.message || error) }, 500);
  }
}
var init_shipping = __esm({
  "api/admin/shipping.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(getCookie8, "getCookie");
    __name(json15, "json");
    __name(normalizeText5, "normalizeText");
    __name(normalizeNumber4, "normalizeNumber");
    __name(getCurrentUser7, "getCurrentUser");
    __name(isAdmin3, "isAdmin");
    __name(onRequestGet11, "onRequestGet");
    __name(onRequestPost9, "onRequestPost");
  }
});

// api/admin/stats.js
async function onRequestGet12(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const [usersCount, ordersCount, pendingOrders, revenueSum, walletSum, latestUsers, latestOrders] = await context.env.DB.batch([
      context.env.DB.prepare(`SELECT COUNT(*) AS count FROM users`),
      context.env.DB.prepare(`SELECT COUNT(*) AS count FROM orders`),
      context.env.DB.prepare(`SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'`),
      context.env.DB.prepare(`
          SELECT COALESCE(SUM(total_amount), 0) AS total
          FROM orders
          WHERE payment_status IN ('paid', 'completed', 'success')
        `),
      context.env.DB.prepare(`
          SELECT COALESCE(SUM(wallet_balance), 0) AS total
          FROM users
        `),
      context.env.DB.prepare(`
          SELECT id, full_name, email, role, created_at
          FROM users
          ORDER BY id DESC
          LIMIT 5
        `),
      context.env.DB.prepare(`
          SELECT order_number, status, payment_status, total_amount, created_at
          FROM orders
          ORDER BY id DESC
          LIMIT 5
        `)
    ]);
    return Response.json({
      success: true,
      stats: {
        total_users: usersCount.results?.[0]?.count || 0,
        total_orders: ordersCount.results?.[0]?.count || 0,
        pending_orders: pendingOrders.results?.[0]?.count || 0,
        total_revenue: revenueSum.results?.[0]?.total || 0,
        total_wallet_balance: walletSum.results?.[0]?.total || 0
      },
      latest_users: latestUsers.results || [],
      latest_orders: latestOrders.results || []
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
var init_stats = __esm({
  "api/admin/stats.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    __name(onRequestGet12, "onRequestGet");
  }
});

// api/admin/users.js
function toInt(value, fallback = 1) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function normalizeText6(value) {
  return String(value || "").trim();
}
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function normalizePhone3(value) {
  return String(value || "").trim().replace(/[۰-۹]/g, (d) => "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9".indexOf(d)).replace(/\D/g, "");
}
function isAllowedRole(role) {
  return ["user", "admin", "super_admin"].includes(String(role || "").trim());
}
async function getExistingTables(db) {
  const result = await db.prepare(`PRAGMA table_list`).all();
  const rows = result?.results || [];
  return new Set(rows.map((row) => String(row.name || "").trim()).filter(Boolean));
}
function canManageRole(actorRole, targetRole) {
  const actor = String(actorRole || "").trim();
  const target = String(targetRole || "").trim();
  if (actor === "super_admin") return true;
  if (actor === "admin") return target === "user" || target === "admin";
  return false;
}
function canEditTarget(actorRole, currentTargetRole, requestedRole) {
  const actor = String(actorRole || "").trim();
  const currentRole = String(currentTargetRole || "").trim();
  const nextRole = String(requestedRole || currentRole).trim();
  if (actor === "super_admin") return true;
  if (actor === "admin") {
    if (currentRole === "super_admin") return false;
    if (nextRole === "super_admin") return false;
    return true;
  }
  return false;
}
async function onRequestGet13(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const url = new URL(context.request.url);
    const search = normalizeText6(url.searchParams.get("search"));
    const role = normalizeText6(url.searchParams.get("role"));
    const page = toInt(url.searchParams.get("page"), 1);
    const limit = Math.min(toInt(url.searchParams.get("limit"), 20), 100);
    const offset = (page - 1) * limit;
    if (role && !isAllowedRole(role)) {
      return Response.json(
        { success: false, error: "invalid role" },
        { status: 400 }
      );
    }
    const where = [];
    const binds = [];
    if (role) {
      where.push("u.role = ?");
      binds.push(role);
    }
    if (search) {
      where.push("(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR CAST(u.id AS TEXT) LIKE ?)");
      const pattern = `%${search}%`;
      binds.push(pattern, pattern, pattern, pattern);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countRow = await context.env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM users u
        ${whereSql}
      `).bind(...binds).first();
    const rows = await context.env.DB.prepare(`
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          COALESCE(u.wallet_balance, 0) AS wallet_balance,
          u.created_at,
          u.updated_at,
          COALESCE(COUNT(o.id), 0) AS orders_count
        FROM users u
        LEFT JOIN orders o ON o.user_id = u.id
        ${whereSql}
        GROUP BY u.id
        ORDER BY u.id DESC
        LIMIT ? OFFSET ?
      `).bind(...binds, limit, offset).all();
    return Response.json({
      success: true,
      page,
      limit,
      total: countRow?.count || 0,
      users: rows.results || []
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
async function onRequestPost10(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const body = await context.request.json();
    const user_id = Number(body.user_id || 0);
    const full_name = normalizeText6(body.full_name);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone3(body.phone);
    const role = normalizeText6(body.role || "user");
    if (!full_name || !email || !role) {
      return Response.json(
        { success: false, error: "full_name, email, role required" },
        { status: 400 }
      );
    }
    if (!isAllowedRole(role)) {
      return Response.json(
        { success: false, error: "invalid role" },
        { status: 400 }
      );
    }
    if (user_id > 0) {
      const targetUser = await context.env.DB.prepare(`SELECT id, role FROM users WHERE id = ?`).bind(user_id).first();
      if (!targetUser) {
        return Response.json(
          { success: false, error: "user not found" },
          { status: 404 }
        );
      }
      if (!canEditTarget(adminCheck.user.role, targetUser.role, role)) {
        return Response.json(
          { success: false, error: "cannot modify this user" },
          { status: 403 }
        );
      }
      const duplicate2 = await context.env.DB.prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?`).bind(email, user_id).first();
      if (duplicate2) {
        return Response.json(
          { success: false, error: "email already exists" },
          { status: 409 }
        );
      }
      await context.env.DB.prepare(`
          UPDATE users
          SET
            full_name = ?,
            email = ?,
            phone = ?,
            role = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(full_name, email, phone || null, role, user_id).run();
      await logAdminAction(context, {
        admin_user_id: adminCheck.user.id,
        action: "update_user",
        target_type: "user",
        target_id: String(user_id),
        description: `role=${role}, email=${email}`
      });
      const updated = await context.env.DB.prepare(`
          SELECT
            id,
            full_name,
            email,
            phone,
            role,
            COALESCE(wallet_balance, 0) AS wallet_balance,
            created_at,
            updated_at
          FROM users
          WHERE id = ?
        `).bind(user_id).first();
      return Response.json({
        success: true,
        mode: "update",
        user: updated
      });
    }
    const password = String(body.password || "");
    const password_confirm = String(body.password_confirm || "");
    if (!password || !password_confirm) {
      return Response.json(
        { success: false, error: "password and password_confirm required" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return Response.json(
        { success: false, error: "password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (password !== password_confirm) {
      return Response.json(
        { success: false, error: "password confirmation does not match" },
        { status: 400 }
      );
    }
    if (!canManageRole(adminCheck.user.role, role)) {
      return Response.json(
        { success: false, error: "cannot create user with this role" },
        { status: 403 }
      );
    }
    const duplicate = await context.env.DB.prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`).bind(email).first();
    if (duplicate) {
      return Response.json(
        { success: false, error: "email already exists" },
        { status: 409 }
      );
    }
    const password_hash = await hashPassword(password);
    const insertResult = await context.env.DB.prepare(`
        INSERT INTO users (
          full_name,
          email,
          phone,
          password_hash,
          role,
          wallet_balance,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(full_name, email, phone || null, password_hash, role).run();
    const newUserId = Number(insertResult?.meta?.last_row_id || 0);
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "create_user",
      target_type: "user",
      target_id: String(newUserId || ""),
      description: `role=${role}, email=${email}`
    });
    const created = await context.env.DB.prepare(`
        SELECT
          id,
          full_name,
          email,
          phone,
          role,
          COALESCE(wallet_balance, 0) AS wallet_balance,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
      `).bind(newUserId).first();
    return Response.json({
      success: true,
      mode: "create",
      user: created
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
async function onRequestDelete6(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const body = await context.request.json();
    const user_id = Number(body.user_id || 0);
    if (!user_id) {
      return Response.json(
        { success: false, error: "user_id required" },
        { status: 400 }
      );
    }
    const targetUser = await context.env.DB.prepare(`
        SELECT id, full_name, email, role, wallet_balance
        FROM users
        WHERE id = ?
      `).bind(user_id).first();
    if (!targetUser) {
      return Response.json(
        { success: false, error: "user not found" },
        { status: 404 }
      );
    }
    if (Number(targetUser.id) === Number(adminCheck.user.id)) {
      return Response.json(
        { success: false, error: "cannot delete current admin user" },
        { status: 403 }
      );
    }
    if (!canEditTarget(adminCheck.user.role, targetUser.role, targetUser.role)) {
      return Response.json(
        { success: false, error: "cannot delete this user" },
        { status: 403 }
      );
    }
    const tables = await getExistingTables(context.env.DB);
    const orderIds = [];
    if (tables.has("orders")) {
      const orderIdsResult = await context.env.DB.prepare(`SELECT id FROM orders WHERE user_id = ?`).bind(user_id).all();
      for (const row of orderIdsResult?.results || []) {
        const id = Number(row?.id || 0);
        if (id) orderIds.push(id);
      }
    }
    const statements = [];
    if (tables.has("order_items") && orderIds.length) {
      for (const orderId of orderIds) {
        statements.push(
          context.env.DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(orderId)
        );
      }
    }
    if (tables.has("orders")) {
      statements.push(
        context.env.DB.prepare(`DELETE FROM orders WHERE user_id = ?`).bind(user_id)
      );
    }
    if (tables.has("wallet_transactions")) {
      statements.push(
        context.env.DB.prepare(`DELETE FROM wallet_transactions WHERE user_id = ?`).bind(user_id)
      );
    }
    if (tables.has("addresses")) {
      statements.push(
        context.env.DB.prepare(`DELETE FROM addresses WHERE user_id = ?`).bind(user_id)
      );
    }
    if (tables.has("sessions")) {
      statements.push(
        context.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(user_id)
      );
    }
    statements.push(
      context.env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(user_id)
    );
    await context.env.DB.batch(statements);
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "delete_user",
      target_type: "user",
      target_id: String(user_id),
      description: `email=${targetUser.email}, role=${targetUser.role}, wallet_balance=${targetUser.wallet_balance}`
    });
    return Response.json({
      success: true,
      message: "user deleted successfully",
      deleted_user: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        email: targetUser.email
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
var init_users = __esm({
  "api/admin/users.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    init_password();
    __name(toInt, "toInt");
    __name(normalizeText6, "normalizeText");
    __name(normalizeEmail, "normalizeEmail");
    __name(normalizePhone3, "normalizePhone");
    __name(isAllowedRole, "isAllowedRole");
    __name(getExistingTables, "getExistingTables");
    __name(canManageRole, "canManageRole");
    __name(canEditTarget, "canEditTarget");
    __name(onRequestGet13, "onRequestGet");
    __name(onRequestPost10, "onRequestPost");
    __name(onRequestDelete6, "onRequestDelete");
  }
});

// api/admin/wallet.js
function json16(data, status = 200) {
  return Response.json(data, { status });
}
function toMoney(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function normalizeText7(value) {
  return String(value ?? "").trim();
}
function pickFirst(...values) {
  for (const value of values) {
    if (value !== void 0 && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}
async function ensureWalletTables(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL DEFAULT 0,
      balance_after INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      source TEXT,
      description TEXT,
      note TEXT,
      order_id INTEGER,
      order_number TEXT,
      reference_type TEXT,
      reference_id TEXT,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}
async function getSetting(db, key, fallback = null) {
  const row = await db.prepare(`SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`).bind(key).first();
  return row ? row.setting_value : fallback;
}
async function setSetting(db, key, value) {
  await db.prepare(`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = CURRENT_TIMESTAMP
    `).bind(key, String(value)).run();
}
function normalizeWalletType(value) {
  const type = normalizeText7(value).toLowerCase();
  if (type === "manual_credit") return "credit";
  if (type === "manual_debit") return "debit";
  if (["credit", "debit", "cashback", "refund", "adjustment"].includes(type)) {
    return type;
  }
  return "";
}
function getSignedAmountByType(type, amount) {
  if (type === "debit") return -Math.abs(amount);
  return Math.abs(amount);
}
function normalizeStatuses3(input) {
  let list = [];
  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === "string") {
    list = input.split(",");
  }
  const normalized = list.map((item) => normalizeText7(item).toLowerCase()).filter(Boolean);
  return normalized.length ? [...new Set(normalized)] : ["completed"];
}
function formatTransactionRow(row) {
  return {
    ...row,
    amount: toMoney(row.amount),
    balance_before: toMoney(row.balance_before),
    balance_after: toMoney(row.balance_after)
  };
}
function buildSettingsPayload(cashbackPercent, cashbackStatuses) {
  return {
    cashback_percent: Number(cashbackPercent) || 0,
    cashback_statuses: Array.isArray(cashbackStatuses) ? cashbackStatuses : ["completed"]
  };
}
async function onRequestGet14(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const db = context.env.DB;
    await ensureWalletTables(db);
    const url = new URL(context.request.url);
    const userId = Number(
      url.searchParams.get("user_id") || url.searchParams.get("userId") || 0
    );
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") || 50), 1),
      200
    );
    const cashbackPercent = Number(await getSetting(db, "cashback_percent", "0")) || 0;
    const cashbackStatuses = normalizeStatuses3(
      await getSetting(db, "cashback_statuses", "completed")
    );
    if (userId > 0) {
      const user = await db.prepare(`
          SELECT
            id,
            full_name,
            email,
            phone,
            role,
            COALESCE(wallet_balance, 0) AS wallet_balance
          FROM users
          WHERE id = ?
          LIMIT 1
        `).bind(userId).first();
      if (!user) {
        return json16({ success: false, error: "user_not_found" }, 404);
      }
      const txns = await db.prepare(`
          SELECT
            id,
            user_id,
            type,
            amount,
            balance_before,
            balance_after,
            status,
            source,
            description,
            note,
            order_id,
            order_number,
            reference_type,
            reference_id,
            created_by_user_id,
            created_at,
            updated_at
          FROM wallet_transactions
          WHERE user_id = ?
          ORDER BY id DESC
          LIMIT ?
        `).bind(userId, limit).all();
      return json16({
        success: true,
        settings: buildSettingsPayload(cashbackPercent, cashbackStatuses),
        user: {
          ...user,
          wallet_balance: toMoney(user.wallet_balance)
        },
        transactions: (txns?.results || []).map(formatTransactionRow)
      });
    }
    const latest = await db.prepare(`
        SELECT
          wt.id,
          wt.user_id,
          wt.type,
          wt.amount,
          wt.balance_before,
          wt.balance_after,
          wt.status,
          wt.source,
          wt.description,
          wt.note,
          wt.order_id,
          wt.order_number,
          wt.reference_type,
          wt.reference_id,
          wt.created_by_user_id,
          wt.created_at,
          wt.updated_at,
          u.full_name,
          u.email
        FROM wallet_transactions wt
        JOIN users u ON u.id = wt.user_id
        ORDER BY wt.id DESC
        LIMIT ?
      `).bind(limit).all();
    return json16({
      success: true,
      settings: buildSettingsPayload(cashbackPercent, cashbackStatuses),
      transactions: (latest?.results || []).map(formatTransactionRow)
    });
  } catch (error) {
    return json16({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPost11(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const db = context.env.DB;
    await ensureWalletTables(db);
    const body = await context.request.json().catch(() => null);
    const action = normalizeText7(body?.action).toLowerCase();
    if (action === "save_settings") {
      const cashbackPercent = Math.max(
        0,
        Math.min(
          Number(
            pickFirst(body?.cashback_percent, body?.cashbackPercent, 0)
          ) || 0,
          100
        )
      );
      const cashbackStatuses = normalizeStatuses3(
        pickFirst(body?.cashback_statuses, body?.cashbackStatuses, "completed")
      );
      await setSetting(db, "cashback_percent", String(cashbackPercent));
      await setSetting(db, "cashback_statuses", cashbackStatuses.join(","));
      await logAdminAction(context, {
        admin_user_id: adminCheck.user.id,
        action: "wallet_save_settings",
        target_type: "wallet_settings",
        target_id: "cashback",
        description: `cashback_percent=${cashbackPercent}, statuses=${cashbackStatuses.join(",")}`
      });
      return json16({
        success: true,
        settings: buildSettingsPayload(cashbackPercent, cashbackStatuses)
      });
    }
    const userId = Number(pickFirst(body?.user_id, body?.userId, 0) || 0);
    const amount = Math.abs(toMoney(body?.amount));
    const type = normalizeWalletType(pickFirst(body?.type, "credit"));
    const note = normalizeText7(pickFirst(body?.note, body?.description));
    const source = normalizeText7(
      pickFirst(body?.source, body?.reference_type, body?.referenceType, "admin")
    ).toLowerCase() || "admin";
    const referenceType = normalizeText7(
      pickFirst(body?.reference_type, body?.referenceType, source, "admin")
    ).toLowerCase() || "admin";
    const referenceId = normalizeText7(
      pickFirst(body?.reference_id, body?.referenceId, body?.reference)
    );
    const orderIdRaw = pickFirst(body?.order_id, body?.orderId, 0);
    const orderId = Number(orderIdRaw || 0) || null;
    const orderNumber = normalizeText7(
      pickFirst(body?.order_number, body?.orderNumber)
    );
    if (!userId || amount <= 0) {
      return json16({ success: false, error: "user_id_and_amount_required" }, 400);
    }
    if (!type) {
      return json16({ success: false, error: "invalid_type" }, 400);
    }
    const user = await db.prepare(`
        SELECT
          id,
          full_name,
          email,
          COALESCE(wallet_balance, 0) AS wallet_balance
        FROM users
        WHERE id = ?
        LIMIT 1
      `).bind(userId).first();
    if (!user) {
      return json16({ success: false, error: "user_not_found" }, 404);
    }
    const balanceBefore = toMoney(user.wallet_balance);
    const signedAmount = getSignedAmountByType(type, amount);
    const balanceAfter = balanceBefore + signedAmount;
    if (balanceAfter < 0) {
      return json16({ success: false, error: "insufficient_wallet_balance" }, 400);
    }
    await db.batch([
      db.prepare(`
        UPDATE users
        SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(balanceAfter, userId),
      db.prepare(`
        INSERT INTO wallet_transactions (
          user_id,
          type,
          amount,
          balance_before,
          balance_after,
          status,
          source,
          description,
          note,
          order_id,
          order_number,
          reference_type,
          reference_id,
          created_by_user_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        userId,
        type,
        signedAmount,
        balanceBefore,
        balanceAfter,
        source,
        note || `${type} wallet transaction`,
        note || null,
        orderId,
        orderNumber || null,
        referenceType,
        referenceId || null,
        adminCheck.user.id
      )
    ]);
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: `wallet_${type}`,
      target_type: "wallet",
      target_id: String(userId),
      description: `amount=${signedAmount}, balance_after=${balanceAfter}, source=${source}, reference_type=${referenceType}`
    });
    return json16({
      success: true,
      transaction: {
        user_id: userId,
        type,
        amount: signedAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        status: "completed",
        source,
        note: note || null,
        reference_type: referenceType,
        reference_id: referenceId || null,
        order_id: orderId,
        order_number: orderNumber || null,
        created_by_user_id: adminCheck.user.id
      }
    });
  } catch (error) {
    return json16({ success: false, error: String(error?.message || error) }, 500);
  }
}
var init_wallet2 = __esm({
  "api/admin/wallet.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    __name(json16, "json");
    __name(toMoney, "toMoney");
    __name(normalizeText7, "normalizeText");
    __name(pickFirst, "pickFirst");
    __name(ensureWalletTables, "ensureWalletTables");
    __name(getSetting, "getSetting");
    __name(setSetting, "setSetting");
    __name(normalizeWalletType, "normalizeWalletType");
    __name(getSignedAmountByType, "getSignedAmountByType");
    __name(normalizeStatuses3, "normalizeStatuses");
    __name(formatTransactionRow, "formatTransactionRow");
    __name(buildSettingsPayload, "buildSettingsPayload");
    __name(onRequestGet14, "onRequestGet");
    __name(onRequestPost11, "onRequestPost");
  }
});

// api/auth/login.js
function normalizeEmail2(email) {
  if (!email) return "";
  return String(email).trim().toLowerCase();
}
async function verifyPasswordCompatible(password, storedHash) {
  if (storedHash && storedHash.startsWith("pbkdf2$")) {
    return await verifyPassword(password, storedHash);
  }
  if (storedHash && storedHash.match(/^[a-f0-9]{64}$/)) {
    const sha256 = /* @__PURE__ */ __name(async (text) => {
      const data = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }, "sha256");
    const hashed = await sha256(password);
    return hashed === storedHash;
  }
  return false;
}
async function onRequestPost12(context) {
  try {
    const body = await context.request.json();
    const email = normalizeEmail2(body.email || "");
    const password = String(body.password || "");
    if (!email || !password) {
      return Response.json(
        { success: false, error: "email and password required" },
        { status: 400 }
      );
    }
    const user = await context.env.DB.prepare(`
        SELECT
          id,
          full_name,
          phone,
          email,
          role,
          wallet_balance,
          password_hash,
          created_at,
          updated_at
        FROM users
        WHERE email = ?
      `).bind(email).first();
    if (!user) {
      return Response.json(
        { success: false, error: "invalid credentials" },
        { status: 401 }
      );
    }
    const isPasswordValid = await verifyPasswordCompatible(password, user.password_hash);
    if (!isPasswordValid) {
      return Response.json(
        { success: false, error: "invalid credentials" },
        { status: 401 }
      );
    }
    const sessionId = crypto.randomUUID();
    await context.env.DB.prepare(`
        INSERT INTO sessions (id, user_id, created_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).bind(sessionId, user.id).run();
    const response = Response.json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        wallet_balance: user.wallet_balance,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
    response.headers.set(
      "Set-Cookie",
      `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
    );
    return response;
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: String(error?.message || error)
      },
      { status: 500 }
    );
  }
}
var init_login = __esm({
  "api/auth/login.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_password();
    __name(normalizeEmail2, "normalizeEmail");
    __name(verifyPasswordCompatible, "verifyPasswordCompatible");
    __name(onRequestPost12, "onRequestPost");
  }
});

// api/auth/logout.js
function getCookie9(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  if (!target) return null;
  return target.slice(key.length + 1);
}
async function onRequestPost13(context) {
  try {
    const cookieString = context.request.headers.get("Cookie") || "";
    const sessionId = getCookie9(cookieString, "session_id");
    if (sessionId) {
      await context.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    }
    const response = Response.json({
      success: true,
      message: "logged_out"
    });
    response.headers.append(
      "Set-Cookie",
      "session_id=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    );
    return response;
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: String(error?.message || error)
      },
      { status: 500 }
    );
  }
}
var init_logout = __esm({
  "api/auth/logout.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(getCookie9, "getCookie");
    __name(onRequestPost13, "onRequestPost");
  }
});

// api/auth/me.js
function getCookie10(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  if (!target) return null;
  return target.slice(key.length + 1);
}
async function onRequestGet15(context) {
  try {
    const cookieString = context.request.headers.get("Cookie") || "";
    const sessionId = getCookie10(cookieString, "session_id");
    if (!sessionId) {
      return Response.json({ success: false, user: null }, { status: 401 });
    }
    const user = await context.env.DB.prepare(`
        SELECT
          users.id,
          users.full_name,
          users.phone,
          users.email,
          users.role,
          users.wallet_balance,
          users.created_at,
          users.updated_at
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.id = ?
      `).bind(sessionId).first();
    if (!user) {
      return Response.json({ success: false, user: null }, { status: 401 });
    }
    return Response.json({
      success: true,
      user
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: String(error?.message || error)
      },
      { status: 500 }
    );
  }
}
var init_me2 = __esm({
  "api/auth/me.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(getCookie10, "getCookie");
    __name(onRequestGet15, "onRequestGet");
  }
});

// api/auth/profile.js
function json17(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet16(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) {
      return json17({ success: false, error: "unauthorized" }, 401);
    }
    return json17({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        wallet_balance: user.wallet_balance,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    return json17(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
async function onRequestPost14(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) {
      return json17({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json();
    const full_name = String(body.full_name ?? body.name ?? "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const password_confirm = String(body.password_confirm || "");
    if (!full_name || !email) {
      return json17(
        { success: false, error: "full_name and email required" },
        400
      );
    }
    const existingUser = await context.env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?").bind(email, user.id).first();
    if (existingUser) {
      return json17(
        { success: false, error: "email already exists" },
        409
      );
    }
    if (password) {
      if (password.length < 8) {
        return json17(
          { success: false, error: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u062C\u062F\u06CC\u062F \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F8 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F." },
          400
        );
      }
      if (password !== password_confirm) {
        return json17(
          { success: false, error: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0648 \u062A\u06A9\u0631\u0627\u0631 \u0622\u0646 \u06CC\u06A9\u0633\u0627\u0646 \u0646\u06CC\u0633\u062A." },
          400
        );
      }
      const newPasswordHash = await hashPassword(password);
      await context.env.DB.prepare(`
          UPDATE users
          SET full_name = ?, email = ?, phone = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(full_name, email, phone || null, newPasswordHash, user.id).run();
    } else {
      await context.env.DB.prepare(`
          UPDATE users
          SET full_name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(full_name, email, phone || null, user.id).run();
    }
    const updatedUser = await context.env.DB.prepare(`
        SELECT id, full_name, email, phone, role, wallet_balance, created_at, updated_at
        FROM users
        WHERE id = ?
      `).bind(user.id).first();
    return json17({
      success: true,
      message: "\u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.",
      user: updatedUser
    });
  } catch (error) {
    return json17(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_profile = __esm({
  "api/auth/profile.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_admin();
    init_password();
    __name(json17, "json");
    __name(onRequestGet16, "onRequestGet");
    __name(onRequestPost14, "onRequestPost");
  }
});

// api/auth/register.js
function normalizePhone4(value) {
  if (!value) return "";
  return String(value).trim().replace(/[^\d+]/g, "");
}
async function isPublicRegistrationEnabled(env) {
  try {
    const result = await env.DB.prepare(`SELECT setting_value FROM app_settings WHERE setting_key = 'allow_public_registration'`).first();
    if (!result) return true;
    return String(result.setting_value || "true").toLowerCase() === "true";
  } catch (_) {
    return true;
  }
}
async function onRequestPost15(context) {
  try {
    const publicRegistrationEnabled = await isPublicRegistrationEnabled(context.env);
    if (!publicRegistrationEnabled) {
      return Response.json(
        {
          success: false,
          error: "\u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631 \u062A\u0648\u0633\u0637 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0633\u0627\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0644\u0637\u0641\u0627\u064B \u0628\u0627 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0628\u0627 \u0634\u0645\u0627\u0631\u0647 09214147070 \u062A\u0645\u0627\u0633 \u062D\u0627\u0635\u0644 \u0641\u0631\u0645\u0627\u06CC\u06CC\u062F."
        },
        { status: 403 }
      );
    }
    const body = await context.request.json();
    const full_name = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = normalizePhone4(body.phone || "");
    const password = String(body.password || "");
    if (!full_name || !email || !phone || !password) {
      return Response.json(
        { success: false, error: "full_name, email, phone, password required" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return Response.json(
        { success: false, error: "password must be at least 6 characters" },
        { status: 400 }
      );
    }
    const weakPasswords = ["123456", "12345678", "password", "qwerty", "111111"];
    if (weakPasswords.includes(password.toLowerCase())) {
      return Response.json(
        { success: false, error: "please choose a stronger password" },
        { status: 400 }
      );
    }
    const existingEmail = await context.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existingEmail) {
      return Response.json(
        { success: false, error: "email already exists" },
        { status: 409 }
      );
    }
    const existingPhone = await context.env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).first();
    if (existingPhone) {
      return Response.json(
        { success: false, error: "phone already exists" },
        { status: 409 }
      );
    }
    const password_hash = await hashPassword(password);
    const result = await context.env.DB.prepare(
      "INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)"
    ).bind(full_name, email, phone, password_hash).run();
    return Response.json(
      {
        success: true,
        inserted: result.success === true,
        id: result.meta?.last_row_id ?? null
      },
      { status: 201 }
    );
  } catch (error) {
    const message = String(error?.message || error);
    if (message.toLowerCase().includes("unique")) {
      return Response.json(
        { success: false, error: "email or phone already exists" },
        { status: 409 }
      );
    }
    return Response.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
var init_register = __esm({
  "api/auth/register.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_password();
    __name(normalizePhone4, "normalizePhone");
    __name(isPublicRegistrationEnabled, "isPublicRegistrationEnabled");
    __name(onRequestPost15, "onRequestPost");
  }
});

// api/rate/current.js
function json18(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60"
    }
  });
}
function formatNumber2(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
async function onRequestGet17(context) {
  try {
    const url = new URL(context.request.url);
    const currencyCode = url.searchParams.get("currency") || "USD";
    const rate = await getCurrentRateWithPrevious(context.env, currencyCode);
    if (!rate) {
      return json18({
        success: false,
        error: `\u0646\u0631\u062E \u0627\u0631\u0632 ${currencyCode} \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.`
      }, 404);
    }
    let changePercent = null;
    if (rate.previous_rate && rate.previous_rate !== rate.rate) {
      changePercent = (rate.rate - rate.previous_rate) / rate.previous_rate * 100;
    }
    let changedBy = null;
    if (rate.updated_by_user_id) {
      const user = await context.env.DB.prepare(`SELECT full_name FROM users WHERE id = ?`).bind(rate.updated_by_user_id).first();
      changedBy = user?.full_name || null;
    }
    return json18({
      success: true,
      rate: {
        id: rate.id,
        currency_code: rate.currency_code,
        currency_name: rate.currency_name,
        rate: rate.rate,
        rate_formatted: `${formatNumber2(rate.rate)} \u062A\u0648\u0645\u0627\u0646`,
        source_type: rate.source_type,
        source_label: rate.source_type === "api" ? "API" : "\u062F\u0633\u062A\u06CC",
        is_active: rate.is_active === 1,
        previous_rate: rate.previous_rate,
        previous_rate_formatted: rate.previous_rate ? `${formatNumber2(rate.previous_rate)} \u062A\u0648\u0645\u0627\u0646` : null,
        change_percent: changePercent,
        change_percent_formatted: changePercent !== null ? `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%` : null,
        updated_by_user_id: rate.updated_by_user_id,
        updated_by: changedBy,
        updated_at: rate.updated_at,
        created_at: rate.created_at
      }
    });
  } catch (error) {
    return json18({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
var init_current = __esm({
  "api/rate/current.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_rate();
    init_admin();
    __name(json18, "json");
    __name(formatNumber2, "formatNumber");
    __name(onRequestGet17, "onRequestGet");
    __name(onRequestOptions, "onRequestOptions");
  }
});

// api/rate/history.js
function json19(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60"
    }
  });
}
function formatNumber3(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
function formatDate(value) {
  if (!value) return "-";
  try {
    const normalized = String(value).trim().replace(" ", "T");
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch (_) {
    return String(value);
  }
}
async function onRequestGet18(context) {
  try {
    const url = new URL(context.request.url);
    const currencyCode = url.searchParams.get("currency") || "USD";
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit")) || 50)
    );
    const history = await getRateHistory(context.env, currencyCode, limit);
    const formattedHistory = history.map((item) => ({
      id: item.id,
      rate: item.rate,
      rate_formatted: `${formatNumber3(item.rate)} \u062A\u0648\u0645\u0627\u0646`,
      source_type: item.source_type,
      source_label: item.source_type === "api" ? "API" : "\u062F\u0633\u062A\u06CC",
      changed_by: item.changed_by || "\u0633\u06CC\u0633\u062A\u0645",
      created_at: item.created_at,
      created_at_formatted: formatDate(item.created_at)
    }));
    let currentRate = null;
    try {
      const { getCurrentRate: getCurrentRate2 } = await Promise.resolve().then(() => (init_rate(), rate_exports));
      currentRate = await getCurrentRate2(context.env, currencyCode);
    } catch (_) {
    }
    return json19({
      success: true,
      currency_code: currencyCode,
      total: formattedHistory.length,
      current_rate: currentRate ? {
        rate: currentRate.rate,
        rate_formatted: `${formatNumber3(currentRate.rate)} \u062A\u0648\u0645\u0627\u0646`,
        updated_at: currentRate.updated_at,
        updated_at_formatted: formatDate(currentRate.updated_at)
      } : null,
      history: formattedHistory
    });
  } catch (error) {
    return json19({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
async function onRequestOptions2() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
var init_history = __esm({
  "api/rate/history.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_rate();
    __name(json19, "json");
    __name(formatNumber3, "formatNumber");
    __name(formatDate, "formatDate");
    __name(onRequestGet18, "onRequestGet");
    __name(onRequestOptions2, "onRequestOptions");
  }
});

// api/rate/update.js
function json20(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
function normalizeNumber5(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  const str = String(value ?? "").replace(/[^\d]/g, "");
  if (!str) return 0;
  const parsed = Number(str);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}
function formatNumber4(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
async function onRequestPost16(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json20({
        success: false,
        error: "\u0628\u062F\u0646\u0647 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A."
      }, 400);
    }
    const currencyCode = String(body.currency || body.currency_code || "USD").trim().toUpperCase();
    const newRate = normalizeNumber5(body.rate || body.new_rate);
    const sourceType = String(body.source_type || "manual").trim().toLowerCase();
    if (!currencyCode) {
      return json20({
        success: false,
        error: "\u06A9\u062F \u0627\u0631\u0632 \u0648\u0627\u0631\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A."
      }, 400);
    }
    if (newRate <= 0) {
      return json20({
        success: false,
        error: "\u0646\u0631\u062E \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u06CC\u06A9 \u0639\u062F\u062F \u0645\u062B\u0628\u062A \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F."
      }, 400);
    }
    if (!["manual", "api"].includes(sourceType)) {
      return json20({
        success: false,
        error: "\u0645\u0646\u0628\u0639 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A. \u0645\u0642\u0627\u062F\u06CC\u0631 \u0645\u062C\u0627\u0632: manual, api"
      }, 400);
    }
    const previousRate = await getCurrentRate(context.env, currencyCode);
    const result = await updateRate(
      context.env,
      currencyCode,
      newRate,
      sourceType,
      adminCheck.user.id
    );
    if (!result.success) {
      return json20({
        success: false,
        error: result.message || "\u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0646\u0631\u062E \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F."
      }, 500);
    }
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "rate_updated",
      target_type: "rate",
      target_id: currencyCode,
      description: `\u0646\u0631\u062E ${currencyCode} \u0627\u0632 ${formatNumber4(previousRate?.rate || 0)} \u0628\u0647 ${formatNumber4(newRate)} \u062A\u0648\u0645\u0627\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u06CC\u0627\u0641\u062A. (\u0645\u0646\u0628\u0639: ${sourceType})`
    });
    let recalculateResult = null;
    if (result.changed) {
      try {
        recalculateResult = await recalculateAllProductPrices(context.env, currencyCode);
      } catch (recalcError) {
        console.error("Error recalculating prices:", recalcError);
      }
    }
    return json20({
      success: true,
      message: result.message,
      rate: {
        currency_code: result.rate?.currency_code || currencyCode,
        currency_name: result.rate?.currency_name || null,
        rate: result.rate?.rate || newRate,
        rate_formatted: `${formatNumber4(result.rate?.rate || newRate)} \u062A\u0648\u0645\u0627\u0646`,
        previous_rate: result.previous_rate || null,
        previous_rate_formatted: result.previous_rate ? `${formatNumber4(result.previous_rate)} \u062A\u0648\u0645\u0627\u0646` : null,
        source_type: sourceType,
        source_label: sourceType === "api" ? "API" : "\u062F\u0633\u062A\u06CC",
        changed: result.changed
      },
      products_updated: recalculateResult ? {
        count: recalculateResult.updated_count || 0,
        message: recalculateResult.message || "\u0645\u062D\u0635\u0648\u0644\u0627\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F\u0646\u062F."
      } : null
    });
  } catch (error) {
    return json20({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
async function onRequestOptions3() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
var init_update = __esm({
  "api/rate/update.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_rate();
    init_admin();
    __name(json20, "json");
    __name(normalizeNumber5, "normalizeNumber");
    __name(formatNumber4, "formatNumber");
    __name(onRequestPost16, "onRequestPost");
    __name(onRequestOptions3, "onRequestOptions");
  }
});

// api/shipping/calculate.js
function json21(data, status = 200) {
  return Response.json(data, { status });
}
function normalizeText8(value) {
  return String(value ?? "").trim();
}
function normalizeNumber6(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}
async function getShippingCost(db, province, city, subtotal = 0) {
  const normalizedProvince = normalizeText8(province);
  const normalizedCity = normalizeText8(city);
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
  if (!cost) {
    return {
      success: false,
      message: "\u0647\u0632\u06CC\u0646\u0647 \u0627\u0631\u0633\u0627\u0644 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0634\u0647\u0631 \u062A\u0639\u06CC\u06CC\u0646 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A."
    };
  }
  const baseCost = cost.default_cost || 0;
  const extraCost = cost.extra_cost || 0;
  let finalCost = baseCost + extraCost;
  let deliveryTime = cost.delivery_time || cost.method_delivery_time || "\u0646\u0627\u0645\u0634\u062E\u0635";
  let isFree = false;
  const freeThreshold = await db.prepare(`
    SELECT min_order_amount
    FROM shipping_free_thresholds
    WHERE shipping_method_id = ? AND is_active = 1
    ORDER BY min_order_amount ASC
    LIMIT 1
  `).bind(cost.method_id).first();
  if (freeThreshold && subtotal >= normalizeNumber6(freeThreshold.min_order_amount)) {
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
      free_threshold: freeThreshold ? normalizeNumber6(freeThreshold.min_order_amount) : null
    }
  };
}
async function onRequestPost17(context) {
  try {
    const body = await context.request.json().catch(() => null);
    if (!body) {
      return json21({ success: false, error: "invalid_payload" }, 400);
    }
    const province = normalizeText8(body.province);
    const city = normalizeText8(body.city);
    const subtotal = normalizeNumber6(body.subtotal);
    if (!province || !city) {
      return json21({ success: false, error: "province_and_city_required" }, 400);
    }
    const result = await getShippingCost(context.env.DB, province, city, subtotal);
    if (!result.success) {
      return json21({ success: false, error: result.message }, 404);
    }
    return json21({
      success: true,
      data: result.shipping
    });
  } catch (error) {
    return json21({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_calculate = __esm({
  "api/shipping/calculate.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(json21, "json");
    __name(normalizeText8, "normalizeText");
    __name(normalizeNumber6, "normalizeNumber");
    __name(getShippingCost, "getShippingCost");
    __name(onRequestPost17, "onRequestPost");
  }
});

// api/shipping/methods.js
function json22(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet19(context) {
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
    return json22({
      success: true,
      methods
    });
  } catch (error) {
    return json22({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_methods = __esm({
  "api/shipping/methods.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(json22, "json");
    __name(onRequestGet19, "onRequestGet");
  }
});

// api/shipping/provinces.js
function json23(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet20(context) {
  try {
    const result = await context.env.DB.prepare(`
      SELECT DISTINCT province, city 
      FROM shipping_costs 
      WHERE is_active = 1
      ORDER BY province, city ASC
    `).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const provinces = {};
    for (const row of rows) {
      const province = row.province || "\u0646\u0627\u0645\u0634\u062E\u0635";
      const city = row.city || "";
      if (!provinces[province]) {
        provinces[province] = [];
      }
      if (city && !provinces[province].includes(city)) {
        provinces[province].push(city);
      }
    }
    if (Object.keys(provinces).length === 0) {
      const fallbackData = {
        "\u062A\u0647\u0631\u0627\u0646": ["\u062A\u0647\u0631\u0627\u0646", "\u06A9\u0631\u062C", "\u0641\u0631\u062F\u06CC\u0633", "\u0631\u0648\u062F\u0647\u0646", "\u0628\u0648\u0645\u0647\u0646"],
        "\u0627\u0635\u0641\u0647\u0627\u0646": ["\u0627\u0635\u0641\u0647\u0627\u0646", "\u06A9\u0627\u0634\u0627\u0646", "\u0646\u062C\u0641\u200C\u0622\u0628\u0627\u062F"],
        "\u0641\u0627\u0631\u0633": ["\u0634\u06CC\u0631\u0627\u0632", "\u0645\u0631\u0648\u062F\u0634\u062A", "\u062C\u0647\u0631\u0645"],
        "\u062E\u0631\u0627\u0633\u0627\u0646 \u0631\u0636\u0648\u06CC": ["\u0645\u0634\u0647\u062F", "\u0646\u06CC\u0634\u0627\u0628\u0648\u0631", "\u0633\u0628\u0632\u0648\u0627\u0631"],
        "\u0622\u0630\u0631\u0628\u0627\u06CC\u062C\u0627\u0646 \u0634\u0631\u0642\u06CC": ["\u062A\u0628\u0631\u06CC\u0632", "\u0645\u0631\u0627\u063A\u0647", "\u0645\u0631\u0646\u062F"]
      };
      return json23({
        success: true,
        provinces: fallbackData,
        provinceList: Object.keys(fallbackData)
      });
    }
    return json23({
      success: true,
      provinces,
      provinceList: Object.keys(provinces)
    });
  } catch (error) {
    return json23({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_provinces = __esm({
  "api/shipping/provinces.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(json23, "json");
    __name(onRequestGet20, "onRequestGet");
  }
});

// api/catalog.js
function json24(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet21(context) {
  try {
    const result = await context.env.DB.prepare(`
      SELECT DISTINCT province, city 
      FROM shipping_costs 
      WHERE is_active = 1
      ORDER BY province, city ASC
    `).all();
    const rows = Array.isArray(result?.results) ? result.results : [];
    const provinces = {};
    for (const row of rows) {
      const province = row.province || "\u0646\u0627\u0645\u0634\u062E\u0635";
      const city = row.city || "";
      if (!provinces[province]) {
        provinces[province] = [];
      }
      if (city && !provinces[province].includes(city)) {
        provinces[province].push(city);
      }
    }
    if (Object.keys(provinces).length === 0) {
      const fallbackData = {
        "\u062A\u0647\u0631\u0627\u0646": ["\u062A\u0647\u0631\u0627\u0646", "\u06A9\u0631\u062C", "\u0641\u0631\u062F\u06CC\u0633", "\u0631\u0648\u062F\u0647\u0646", "\u0628\u0648\u0645\u0647\u0646"],
        "\u0627\u0635\u0641\u0647\u0627\u0646": ["\u0627\u0635\u0641\u0647\u0627\u0646", "\u06A9\u0627\u0634\u0627\u0646", "\u0646\u062C\u0641\u200C\u0622\u0628\u0627\u062F"],
        "\u0641\u0627\u0631\u0633": ["\u0634\u06CC\u0631\u0627\u0632", "\u0645\u0631\u0648\u062F\u0634\u062A", "\u062C\u0647\u0631\u0645"],
        "\u062E\u0631\u0627\u0633\u0627\u0646 \u0631\u0636\u0648\u06CC": ["\u0645\u0634\u0647\u062F", "\u0646\u06CC\u0634\u0627\u0628\u0648\u0631", "\u0633\u0628\u0632\u0648\u0627\u0631"],
        "\u0622\u0630\u0631\u0628\u0627\u06CC\u062C\u0627\u0646 \u0634\u0631\u0642\u06CC": ["\u062A\u0628\u0631\u06CC\u0632", "\u0645\u0631\u0627\u063A\u0647", "\u0645\u0631\u0646\u062F"]
      };
      return json24({
        success: true,
        provinces: fallbackData,
        provinceList: Object.keys(fallbackData)
      });
    }
    return json24({
      success: true,
      provinces,
      provinceList: Object.keys(provinces)
    });
  } catch (error) {
    return json24({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_catalog = __esm({
  "api/catalog.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(json24, "json");
    __name(onRequestGet21, "onRequestGet");
  }
});

// api/products.js
function json25(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60",
      ...headers
    }
  });
}
function cleanText3(value) {
  return String(value ?? "").trim();
}
function toBoolean(value) {
  return Number(value) === 1 || value === true;
}
function normalizeImagePath(value) {
  const path = cleanText3(value);
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) {
    return path;
  }
  return `/${path.replace(/^\.?\//, "")}`;
}
function normalizePageUrl(value, slug) {
  const pageUrl = cleanText3(value);
  if (pageUrl) {
    if (pageUrl.startsWith("http://") || pageUrl.startsWith("https://") || pageUrl.startsWith("/")) {
      return pageUrl;
    }
    return `/${pageUrl.replace(/^\.?\//, "")}`;
  }
  return `/products/${encodeURIComponent(slug)}.html`;
}
function formatNumber5(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
function buildPriceLabel(product, displayPrice) {
  if (product.price_type === "rate_based" && displayPrice !== null && displayPrice > 0) {
    return `${formatNumber5(displayPrice)} \u062A\u0648\u0645\u0627\u0646`;
  }
  const price = Number(product.price);
  const hasValidPrice = Number.isFinite(price) && price > 0;
  if (toBoolean(product.show_price) && hasValidPrice) {
    return `${formatNumber5(price)} \u062A\u0648\u0645\u0627\u0646`;
  }
  return cleanText3(product.price_label) || "\u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F";
}
function buildStockLabel(product) {
  const stockQuantity = Math.max(0, Number.parseInt(product.stock_quantity, 10) || 0);
  const inStock = toBoolean(product.in_stock) && stockQuantity > 0;
  if (!inStock) return "\u0646\u0627\u0645\u0648\u062C\u0648\u062F";
  return cleanText3(product.stock_label) || "\u0645\u0648\u062C\u0648\u062F";
}
function productFromRow3(product, imageRows, rate) {
  const stockQty = Math.max(0, Number.parseInt(product.stock_quantity, 10) || 0);
  const inStock = toBoolean(product.in_stock) && stockQty > 0;
  const galleryImages = imageRows.filter((image) => Number(image.product_id) === Number(product.id)).map((image) => normalizeImagePath(image.image_url)).filter(Boolean);
  const primaryImage = normalizeImagePath(product.primary_image);
  const images = Array.from(new Set([primaryImage, ...galleryImages].filter(Boolean)));
  let displayPrice = null;
  const priceType = product.price_type || "fixed";
  const basePrice = product.base_price !== null && product.base_price !== void 0 ? Number(product.base_price) : null;
  const calculatedPrice = product.calculated_price !== null && product.calculated_price !== void 0 ? Number(product.calculated_price) : null;
  if (priceType === "rate_based" && basePrice !== null && basePrice > 0 && rate !== null) {
    if (calculatedPrice !== null && calculatedPrice > 0) {
      displayPrice = calculatedPrice;
    } else {
      displayPrice = calculateProductPrice(product, rate);
    }
  } else if (priceType === "fixed") {
    const price = Number(product.price);
    if (Number.isFinite(price) && price > 0) {
      displayPrice = price;
    }
  }
  if (displayPrice === null) {
    const price = Number(product.price);
    if (Number.isFinite(price) && price > 0) {
      displayPrice = price;
    }
  }
  return {
    id: Number(product.id),
    slug: cleanText3(product.slug),
    name: cleanText3(product.name),
    category: cleanText3(product.category),
    price: Number(product.price) || null,
    displayPrice,
    priceLabel: buildPriceLabel(product, displayPrice),
    displayPriceLabel: buildPriceLabel(product, displayPrice),
    showPrice: toBoolean(product.show_price),
    inStock,
    stockQty,
    stockLabel: buildStockLabel(product),
    shortDescription: cleanText3(product.short_description),
    description: cleanText3(product.description),
    primaryImage: primaryImage || images[0] || "",
    images,
    pageUrl: normalizePageUrl(product.page_url, product.slug),
    priceType,
    basePrice,
    profitType: product.profit_type || "none",
    profitValue: product.profit_value !== null && product.profit_value !== void 0 ? Number(product.profit_value) : null,
    fixedFee: product.fixed_fee !== null && product.fixed_fee !== void 0 ? Number(product.fixed_fee) : null,
    roundingType: product.rounding_type || "none",
    roundingMethod: product.rounding_method || "nearest",
    calculatedPrice
  };
}
async function onRequestOptions4() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
async function onRequestGet22(context) {
  try {
    const db = context.env?.DB;
    if (!db) {
      return json25({ success: false, error: "D1 database binding DB is not configured." }, 500);
    }
    const url = new URL(context.request.url);
    const requestedSlug = cleanText3(url.searchParams.get("slug"));
    const requestedCategory = cleanText3(url.searchParams.get("category"));
    const includeOutOfStock = url.searchParams.get("include_out_of_stock") === "1";
    let currentRate = null;
    try {
      const rateResult = await getCurrentRate(context.env, "USD");
      if (rateResult) {
        currentRate = rateResult.rate;
      }
    } catch (rateError) {
      currentRate = 196e3;
    }
    const conditions = ["p.status = 'published'"];
    const bindings = [];
    if (requestedSlug) {
      conditions.push("p.slug = ?");
      bindings.push(requestedSlug);
    }
    if (requestedCategory) {
      conditions.push("p.category = ?");
      bindings.push(requestedCategory);
    }
    if (!includeOutOfStock) {
      conditions.push("p.in_stock = 1");
    }
    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const productsQuery = `
      SELECT
        p.id, p.slug, p.name, p.category, p.price, p.price_label, p.show_price,
        p.stock_quantity, p.in_stock, p.stock_label, p.short_description,
        p.description, p.primary_image, p.page_url, p.status, p.created_at, p.updated_at,
        p.price_type, p.base_price, p.profit_type, p.profit_value, p.fixed_fee,
        p.rounding_type, p.rounding_method, p.calculated_price, p.price_calculated_at
      FROM products p
      ${whereClause}
      ORDER BY
        CASE WHEN p.in_stock = 1 AND p.stock_quantity > 0 THEN 0 ELSE 1 END,
        p.id ASC
    `;
    const productsResult = bindings.length ? await db.prepare(productsQuery).bind(...bindings).all() : await db.prepare(productsQuery).all();
    const productRows = Array.isArray(productsResult?.results) ? productsResult.results : [];
    if (!productRows.length) {
      return json25({ success: true, total: 0, products: [], rate: currentRate });
    }
    const productIds = productRows.map((product) => Number(product.id));
    const placeholders = productIds.map(() => "?").join(",");
    const imagesQuery = `
      SELECT id, product_id, image_url, alt_text, sort_order, is_primary
      FROM product_images
      WHERE product_id IN (${placeholders})
      ORDER BY product_id ASC, is_primary DESC, sort_order ASC, id ASC
    `;
    const imagesResult = await db.prepare(imagesQuery).bind(...productIds).all();
    const imageRows = Array.isArray(imagesResult?.results) ? imagesResult.results : [];
    const products = productRows.map((product) => productFromRow3(product, imageRows, currentRate));
    return json25({ success: true, total: products.length, products, rate: currentRate });
  } catch (error) {
    return json25({ success: false, error: String(error?.message || error) }, 500, { "Cache-Control": "no-store" });
  }
}
var init_products2 = __esm({
  "api/products.js"() {
    init_functionsRoutes_0_6149654476194794();
    init_rate();
    __name(json25, "json");
    __name(cleanText3, "cleanText");
    __name(toBoolean, "toBoolean");
    __name(normalizeImagePath, "normalizeImagePath");
    __name(normalizePageUrl, "normalizePageUrl");
    __name(formatNumber5, "formatNumber");
    __name(buildPriceLabel, "buildPriceLabel");
    __name(buildStockLabel, "buildStockLabel");
    __name(productFromRow3, "productFromRow");
    __name(onRequestOptions4, "onRequestOptions");
    __name(onRequestGet22, "onRequestGet");
  }
});

// api/test-db.js
async function onRequestGet23(context) {
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
var init_test_db = __esm({
  "api/test-db.js"() {
    init_functionsRoutes_0_6149654476194794();
    __name(onRequestGet23, "onRequestGet");
  }
});

// ../.wrangler/tmp/pages-2pJlxI/functionsRoutes-0.6149654476194794.mjs
var routes;
var init_functionsRoutes_0_6149654476194794 = __esm({
  "../.wrangler/tmp/pages-2pJlxI/functionsRoutes-0.6149654476194794.mjs"() {
    init_default();
    init_password2();
    init_id();
    init_id();
    init_order();
    init_order2();
    init_order2();
    init_order2();
    init_id2();
    init_id2();
    init_id2();
    init_addresses();
    init_addresses();
    init_addresses();
    init_addresses();
    init_create_order();
    init_orders();
    init_wallet();
    init_me();
    init_orders2();
    init_orders2();
    init_orders2();
    init_products();
    init_products();
    init_products();
    init_products();
    init_settings();
    init_settings();
    init_shipping();
    init_shipping();
    init_stats();
    init_users();
    init_users();
    init_users();
    init_wallet2();
    init_wallet2();
    init_login();
    init_logout();
    init_me2();
    init_profile();
    init_profile();
    init_register();
    init_current();
    init_current();
    init_history();
    init_history();
    init_update();
    init_update();
    init_calculate();
    init_methods();
    init_provinces();
    init_catalog();
    init_products2();
    init_products2();
    init_test_db();
    routes = [
      {
        routePath: "/api/account/addresses/:id/default",
        mountPath: "/api/account/addresses/:id",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost]
      },
      {
        routePath: "/api/admin/users/password",
        mountPath: "/api/admin/users",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost2]
      },
      {
        routePath: "/api/account/addresses/:id",
        mountPath: "/api/account/addresses",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete]
      },
      {
        routePath: "/api/account/addresses/:id",
        mountPath: "/api/account/addresses",
        method: "PUT",
        middlewares: [],
        modules: [onRequestPut]
      },
      {
        routePath: "/api/account/orders/:order",
        mountPath: "/api/account/orders",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet]
      },
      {
        routePath: "/api/admin/orders/:order",
        mountPath: "/api/admin/orders",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet2]
      },
      {
        routePath: "/api/admin/orders/:order",
        mountPath: "/api/admin/orders",
        method: "PATCH",
        middlewares: [],
        modules: [onRequestPatch]
      },
      {
        routePath: "/api/admin/orders/:order",
        mountPath: "/api/admin/orders",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost3]
      },
      {
        routePath: "/api/admin/products/:id",
        mountPath: "/api/admin/products",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete2]
      },
      {
        routePath: "/api/admin/products/:id",
        mountPath: "/api/admin/products",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet3]
      },
      {
        routePath: "/api/admin/products/:id",
        mountPath: "/api/admin/products",
        method: "PUT",
        middlewares: [],
        modules: [onRequestPut2]
      },
      {
        routePath: "/api/account/addresses",
        mountPath: "/api/account",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete3]
      },
      {
        routePath: "/api/account/addresses",
        mountPath: "/api/account",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet4]
      },
      {
        routePath: "/api/account/addresses",
        mountPath: "/api/account",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost4]
      },
      {
        routePath: "/api/account/addresses",
        mountPath: "/api/account",
        method: "PUT",
        middlewares: [],
        modules: [onRequestPut3]
      },
      {
        routePath: "/api/account/create-order",
        mountPath: "/api/account",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost5]
      },
      {
        routePath: "/api/account/orders",
        mountPath: "/api/account",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet5]
      },
      {
        routePath: "/api/account/wallet",
        mountPath: "/api/account",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet6]
      },
      {
        routePath: "/api/admin/me",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet7]
      },
      {
        routePath: "/api/admin/orders",
        mountPath: "/api/admin",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete4]
      },
      {
        routePath: "/api/admin/orders",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet8]
      },
      {
        routePath: "/api/admin/orders",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost6]
      },
      {
        routePath: "/api/admin/products",
        mountPath: "/api/admin",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete5]
      },
      {
        routePath: "/api/admin/products",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet9]
      },
      {
        routePath: "/api/admin/products",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost7]
      },
      {
        routePath: "/api/admin/products",
        mountPath: "/api/admin",
        method: "PUT",
        middlewares: [],
        modules: [onRequestPut4]
      },
      {
        routePath: "/api/admin/settings",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet10]
      },
      {
        routePath: "/api/admin/settings",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost8]
      },
      {
        routePath: "/api/admin/shipping",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet11]
      },
      {
        routePath: "/api/admin/shipping",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost9]
      },
      {
        routePath: "/api/admin/stats",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet12]
      },
      {
        routePath: "/api/admin/users",
        mountPath: "/api/admin",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete6]
      },
      {
        routePath: "/api/admin/users",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet13]
      },
      {
        routePath: "/api/admin/users",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost10]
      },
      {
        routePath: "/api/admin/wallet",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet14]
      },
      {
        routePath: "/api/admin/wallet",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost11]
      },
      {
        routePath: "/api/auth/login",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost12]
      },
      {
        routePath: "/api/auth/logout",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost13]
      },
      {
        routePath: "/api/auth/me",
        mountPath: "/api/auth",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet15]
      },
      {
        routePath: "/api/auth/profile",
        mountPath: "/api/auth",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet16]
      },
      {
        routePath: "/api/auth/profile",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost14]
      },
      {
        routePath: "/api/auth/register",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost15]
      },
      {
        routePath: "/api/rate/current",
        mountPath: "/api/rate",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet17]
      },
      {
        routePath: "/api/rate/current",
        mountPath: "/api/rate",
        method: "OPTIONS",
        middlewares: [],
        modules: [onRequestOptions]
      },
      {
        routePath: "/api/rate/history",
        mountPath: "/api/rate",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet18]
      },
      {
        routePath: "/api/rate/history",
        mountPath: "/api/rate",
        method: "OPTIONS",
        middlewares: [],
        modules: [onRequestOptions2]
      },
      {
        routePath: "/api/rate/update",
        mountPath: "/api/rate",
        method: "OPTIONS",
        middlewares: [],
        modules: [onRequestOptions3]
      },
      {
        routePath: "/api/rate/update",
        mountPath: "/api/rate",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost16]
      },
      {
        routePath: "/api/shipping/calculate",
        mountPath: "/api/shipping",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost17]
      },
      {
        routePath: "/api/shipping/methods",
        mountPath: "/api/shipping",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet19]
      },
      {
        routePath: "/api/shipping/provinces",
        mountPath: "/api/shipping",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet20]
      },
      {
        routePath: "/api/catalog",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet21]
      },
      {
        routePath: "/api/products",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet22]
      },
      {
        routePath: "/api/products",
        mountPath: "/api",
        method: "OPTIONS",
        middlewares: [],
        modules: [onRequestOptions4]
      },
      {
        routePath: "/api/test-db",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet23]
      }
    ];
  }
});

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
init_functionsRoutes_0_6149654476194794();

// ../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
init_functionsRoutes_0_6149654476194794();
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
