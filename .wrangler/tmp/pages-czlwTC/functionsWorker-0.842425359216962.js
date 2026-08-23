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
    init_functionsRoutes_0_42576649940160716();
    __name(getCookie, "getCookie");
    __name(getCurrentUser, "getCurrentUser");
    __name(json, "json");
    __name(onRequestPost, "onRequestPost");
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
async function getSessionUser(env, sessionId) {
  const db = getDb(env);
  return db.prepare(`SELECT
                s.id AS session_id,
                s.user_id,
                u.id,
                u.full_name,
                u.phone,
                u.email,
                u.created_at
              FROM sessions s
              INNER JOIN users u ON u.id = s.user_id
              WHERE s.id = ?`).bind(sessionId).first();
}
async function createTelegramToken(env, userId, tokenHash) {
  const db = getDb(env);
  const result = await db.prepare(`
      INSERT INTO telegram_tokens (user_id, token_hash, created_at, expires_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now', '+10 minutes'))
    `).bind(userId, tokenHash).run();
  return {
    success: true,
    id: result.meta?.last_row_id
  };
}
async function findTelegramTokenByHash(env, tokenHash) {
  const db = getDb(env);
  return db.prepare(`
      SELECT id, user_id, token_hash, is_used, created_at, expires_at
      FROM telegram_tokens
      WHERE token_hash = ?
      LIMIT 1
    `).bind(tokenHash).first();
}
async function markTelegramTokenAsUsed(env, tokenId) {
  const db = getDb(env);
  await db.prepare(`
      UPDATE telegram_tokens
      SET is_used = 1
      WHERE id = ?
    `).bind(tokenId).run();
  return true;
}
async function saveTelegramConnection(env, userId, chatId, userInfo = {}) {
  const db = getDb(env);
  const existing = await db.prepare(`
      SELECT id, user_id, is_active
      FROM user_telegram_connections
      WHERE chat_id = ? AND is_active = 1
    `).bind(chatId).first();
  if (existing && existing.user_id !== userId) {
    throw new Error("\u0627\u06CC\u0646 \u062D\u0633\u0627\u0628 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0642\u0628\u0644\u0627\u064B \u0628\u0647 \u06A9\u0627\u0631\u0628\u0631 \u062F\u06CC\u06AF\u0631\u06CC \u0645\u062A\u0635\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A.");
  }
  await db.prepare(`
      UPDATE user_telegram_connections
      SET is_active = 0, disconnected_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND is_active = 1
    `).bind(userId).run();
  const result = await db.prepare(`
      INSERT INTO user_telegram_connections (
        user_id,
        chat_id,
        telegram_user_id,
        telegram_username,
        first_name,
        last_name,
        is_active,
        connected_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        chat_id = excluded.chat_id,
        telegram_user_id = excluded.telegram_user_id,
        telegram_username = excluded.telegram_username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        is_active = 1,
        connected_at = CURRENT_TIMESTAMP,
        disconnected_at = NULL
    `).bind(
    userId,
    chatId,
    userInfo.id || null,
    userInfo.username || null,
    userInfo.first_name || null,
    userInfo.last_name || null
  ).run();
  return {
    success: true,
    id: result.meta?.last_row_id
  };
}
async function findTelegramConnectionByUserId(env, userId) {
  const db = getDb(env);
  return db.prepare(`
      SELECT
        id,
        user_id,
        chat_id,
        telegram_user_id,
        telegram_username,
        first_name,
        last_name,
        is_active,
        connected_at,
        last_used_at,
        disconnected_at
      FROM user_telegram_connections
      WHERE user_id = ? AND is_active = 1
      LIMIT 1
    `).bind(userId).first();
}
async function disconnectTelegram(env, userId) {
  const db = getDb(env);
  await db.prepare(`
      UPDATE user_telegram_connections
      SET is_active = 0, disconnected_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND is_active = 1
    `).bind(userId).run();
  return { success: true };
}
async function updateTelegramLastUsed(env, userId) {
  const db = getDb(env);
  await db.prepare(`
      UPDATE user_telegram_connections
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND is_active = 1
    `).bind(userId).run();
  return { success: true };
}
async function getUserNotificationPreferences(env, userId) {
  const db = getDb(env);
  const result = await db.prepare(`
      SELECT
        user_id,
        order_created,
        payment_success,
        payment_failed,
        order_status_changed,
        order_preparing,
        order_shipped,
        tracking_code_added,
        order_completed,
        order_cancelled,
        announcements,
        promotions,
        marketing,
        created_at,
        updated_at
      FROM user_notification_preferences
      WHERE user_id = ?
      LIMIT 1
    `).bind(userId).first();
  if (!result) return null;
  return {
    user_id: result.user_id,
    order_created: result.order_created === 1,
    payment_success: result.payment_success === 1,
    payment_failed: result.payment_failed === 1,
    order_status_changed: result.order_status_changed === 1,
    order_preparing: result.order_preparing === 1,
    order_shipped: result.order_shipped === 1,
    tracking_code_added: result.tracking_code_added === 1,
    order_completed: result.order_completed === 1,
    order_cancelled: result.order_cancelled === 1,
    announcements: result.announcements === 1,
    promotions: result.promotions === 1,
    marketing: result.marketing === 1,
    created_at: result.created_at,
    updated_at: result.updated_at
  };
}
async function saveUserNotificationPreferences(env, userId, preferences) {
  const db = getDb(env);
  const fields = [
    "order_created",
    "payment_success",
    "payment_failed",
    "order_status_changed",
    "order_preparing",
    "order_shipped",
    "tracking_code_added",
    "order_completed",
    "order_cancelled",
    "announcements",
    "promotions",
    "marketing"
  ];
  const updates = [];
  const values = [];
  for (const field of fields) {
    if (preferences[field] !== void 0) {
      updates.push(`${field} = ?`);
      values.push(preferences[field] ? 1 : 0);
    }
  }
  if (updates.length === 0) {
    throw new Error("\u0647\u06CC\u0686 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A\u06CC \u0628\u0631\u0627\u06CC \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");
  }
  const existing = await db.prepare(`SELECT id FROM user_notification_preferences WHERE user_id = ?`).bind(userId).first();
  if (existing) {
    values.push(userId);
    const query = `
      UPDATE user_notification_preferences
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;
    await db.prepare(query).bind(...values).run();
  } else {
    const insertFields = ["user_id", ...fields];
    const placeholders = insertFields.map(() => "?").join(", ");
    const insertValues = [userId];
    for (const field of fields) {
      const val = preferences[field] !== void 0 ? preferences[field] : 1;
      insertValues.push(val ? 1 : 0);
    }
    const query = `
      INSERT INTO user_notification_preferences (${insertFields.join(", ")})
      VALUES (${placeholders})
    `;
    await db.prepare(query).bind(...insertValues).run();
  }
  return { success: true };
}
var init_db = __esm({
  "lib/db.js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(getDb, "getDb");
    __name(getSessionUser, "getSessionUser");
    __name(createTelegramToken, "createTelegramToken");
    __name(findTelegramTokenByHash, "findTelegramTokenByHash");
    __name(markTelegramTokenAsUsed, "markTelegramTokenAsUsed");
    __name(saveTelegramConnection, "saveTelegramConnection");
    __name(findTelegramConnectionByUserId, "findTelegramConnectionByUserId");
    __name(disconnectTelegram, "disconnectTelegram");
    __name(updateTelegramLastUsed, "updateTelegramLastUsed");
    __name(getUserNotificationPreferences, "getUserNotificationPreferences");
    __name(saveUserNotificationPreferences, "saveUserNotificationPreferences");
  }
});

// api/account/telegram/connect.js
function getCookie2(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json2(data, status = 200) {
  return Response.json(data, { status });
}
async function hashToken(token) {
  const encoder2 = new TextEncoder();
  const data = encoder2.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function generateRandomToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function onRequestPost2(context) {
  try {
    const { env, request } = context;
    const cookieString = request.headers.get("cookie") || "";
    const sessionId = getCookie2(cookieString, "session_id");
    if (!sessionId) {
      return json2({ success: false, error: "unauthorized" }, 401);
    }
    const user = await getSessionUser(env, sessionId);
    if (!user) {
      return json2({ success: false, error: "unauthorized" }, 401);
    }
    const existingConnection = await findTelegramConnectionByUserId(env, user.id);
    if (existingConnection) {
      return json2({
        success: false,
        error: "\u0634\u0645\u0627 \u0642\u0628\u0644\u0627\u064B \u0628\u0647 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0645\u062A\u0635\u0644 \u0647\u0633\u062A\u06CC\u062F. \u062F\u0631 \u0635\u0648\u0631\u062A \u0646\u06CC\u0627\u0632\u060C \u0627\u0628\u062A\u062F\u0627 \u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0642\u0637\u0639 \u06A9\u0646\u06CC\u062F."
      });
    }
    const rawToken = generateRandomToken();
    const tokenHash = await hashToken(rawToken);
    await createTelegramToken(env, user.id, tokenHash);
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return json2({
        success: false,
        error: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u062A\u0644\u06AF\u0631\u0627\u0645 \u06A9\u0627\u0645\u0644 \u0646\u06CC\u0633\u062A."
      });
    }
    const botUsername = env.TELEGRAM_BOT_USERNAME || "takdaro_bot";
    const baseUrl = env.SITE_BASE_URL || "https://takdaro.com";
    const telegramLink = `https://t.me/${botUsername}?start=${rawToken}`;
    return json2({
      success: true,
      telegram_link: telegramLink,
      token: rawToken,
      expires_in: "10 \u062F\u0642\u06CC\u0642\u0647"
    });
  } catch (error) {
    return json2(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_connect = __esm({
  "api/account/telegram/connect.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_db();
    init_db();
    init_db();
    __name(getCookie2, "getCookie");
    __name(json2, "json");
    __name(hashToken, "hashToken");
    __name(generateRandomToken, "generateRandomToken");
    __name(onRequestPost2, "onRequestPost");
  }
});

// api/account/telegram/disconnect.js
function getCookie3(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json3(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestPost3(context) {
  try {
    const { env, request } = context;
    const cookieString = request.headers.get("cookie") || "";
    const sessionId = getCookie3(cookieString, "session_id");
    if (!sessionId) {
      return json3({ success: false, error: "unauthorized" }, 401);
    }
    const user = await getSessionUser(env, sessionId);
    if (!user) {
      return json3({ success: false, error: "unauthorized" }, 401);
    }
    const connection = await findTelegramConnectionByUserId(env, user.id);
    if (!connection) {
      return json3({
        success: false,
        error: "\u0634\u0645\u0627 \u0628\u0647 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A\u06CC\u062F."
      });
    }
    await disconnectTelegram(env, user.id);
    return json3({
      success: true,
      message: "\u0627\u062A\u0635\u0627\u0644 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0642\u0637\u0639 \u0634\u062F."
    });
  } catch (error) {
    return json3(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_disconnect = __esm({
  "api/account/telegram/disconnect.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_db();
    init_db();
    init_db();
    __name(getCookie3, "getCookie");
    __name(json3, "json");
    __name(onRequestPost3, "onRequestPost");
  }
});

// api/account/telegram/preferences.js
function getCookie4(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json4(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const cookieString = request.headers.get("cookie") || "";
    const sessionId = getCookie4(cookieString, "session_id");
    if (!sessionId) {
      return json4({ success: false, error: "unauthorized" }, 401);
    }
    const user = await getSessionUser(env, sessionId);
    if (!user) {
      return json4({ success: false, error: "unauthorized" }, 401);
    }
    const preferences = await getUserNotificationPreferences(env, user.id);
    const defaultPrefs = {
      order_created: true,
      payment_success: true,
      payment_failed: true,
      order_status_changed: true,
      order_preparing: true,
      order_shipped: true,
      tracking_code_added: true,
      order_completed: true,
      order_cancelled: true,
      announcements: false,
      promotions: false,
      marketing: false
    };
    const prefs = preferences || defaultPrefs;
    return json4({
      success: true,
      preferences: prefs
    });
  } catch (error) {
    return json4(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
async function onRequestPut(context) {
  try {
    const { env, request } = context;
    const cookieString = request.headers.get("cookie") || "";
    const sessionId = getCookie4(cookieString, "session_id");
    if (!sessionId) {
      return json4({ success: false, error: "unauthorized" }, 401);
    }
    const user = await getSessionUser(env, sessionId);
    if (!user) {
      return json4({ success: false, error: "unauthorized" }, 401);
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json4({
        success: false,
        error: "\u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631."
      }, 400);
    }
    const allowedFields = [
      "order_created",
      "payment_success",
      "payment_failed",
      "order_status_changed",
      "order_preparing",
      "order_shipped",
      "tracking_code_added",
      "order_completed",
      "order_cancelled",
      "announcements",
      "promotions",
      "marketing"
    ];
    const preferences = {};
    let hasValidField = false;
    for (const field of allowedFields) {
      if (body[field] !== void 0) {
        preferences[field] = Boolean(body[field]);
        hasValidField = true;
      }
    }
    if (!hasValidField) {
      return json4({
        success: false,
        error: "\u0647\u06CC\u0686 \u0641\u06CC\u0644\u062F \u0645\u0639\u062A\u0628\u0631\u06CC \u0628\u0631\u0627\u06CC \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A."
      }, 400);
    }
    await saveUserNotificationPreferences(env, user.id, preferences);
    const updatedPrefs = await getUserNotificationPreferences(env, user.id);
    return json4({
      success: true,
      message: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.",
      preferences: updatedPrefs
    });
  } catch (error) {
    return json4(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_preferences = __esm({
  "api/account/telegram/preferences.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_db();
    init_db();
    init_db();
    __name(getCookie4, "getCookie");
    __name(json4, "json");
    __name(onRequestGet, "onRequestGet");
    __name(onRequestPut, "onRequestPut");
  }
});

// api/account/telegram/status.js
function getCookie5(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json5(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet2(context) {
  try {
    const { env, request } = context;
    const cookieString = request.headers.get("cookie") || "";
    const sessionId = getCookie5(cookieString, "session_id");
    if (!sessionId) {
      return json5({ success: false, error: "unauthorized" }, 401);
    }
    const user = await getSessionUser(env, sessionId);
    if (!user) {
      return json5({ success: false, error: "unauthorized" }, 401);
    }
    const connection = await findTelegramConnectionByUserId(env, user.id);
    if (!connection) {
      return json5({
        success: true,
        connected: false,
        data: null
      });
    }
    return json5({
      success: true,
      connected: true,
      data: {
        chat_id: connection.chat_id,
        telegram_user_id: connection.telegram_user_id,
        telegram_username: connection.telegram_username,
        first_name: connection.first_name,
        last_name: connection.last_name,
        connected_at: connection.connected_at,
        last_used_at: connection.last_used_at
      }
    });
  } catch (error) {
    return json5(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_status = __esm({
  "api/account/telegram/status.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_db();
    init_db();
    __name(getCookie5, "getCookie");
    __name(json5, "json");
    __name(onRequestGet2, "onRequestGet");
  }
});

// lib/telegram.js
async function sendTelegramMessage(botToken, chatId, text, options = {}) {
  if (!botToken || !chatId || !text) {
    throw new Error("botToken, chatId \u0648 text \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F.");
  }
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: String(chatId),
    text: String(text),
    parse_mode: "HTML",
    disable_web_page_preview: true
  };
  if (options.replyMarkup && Array.isArray(options.replyMarkup) && options.replyMarkup.length > 0) {
    payload.reply_markup = {
      inline_keyboard: options.replyMarkup
    };
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.description || "\u0627\u0631\u0633\u0627\u0644 \u067E\u06CC\u0627\u0645 \u0628\u0647 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F.");
    }
    return {
      success: true,
      result: data.result,
      message_id: data.result?.message_id
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}
function createOrderViewButton(orderNumber, baseUrl = "") {
  const siteUrl = baseUrl || "https://takdaro-site.pages.dev";
  const url = `${siteUrl}/admin.html?panel=orders&order=${encodeURIComponent(orderNumber)}`;
  return [
    [
      {
        text: "\u{1F50D} \u0645\u0634\u0627\u0647\u062F\u0647 \u0633\u0641\u0627\u0631\u0634",
        url
      }
    ]
  ];
}
function createUserViewButton(userId, baseUrl = "") {
  const siteUrl = baseUrl || "https://takdaro-site.pages.dev";
  const url = `${siteUrl}/admin.html?panel=users&user=${encodeURIComponent(userId)}`;
  return [
    [
      {
        text: "\u{1F464} \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0627\u0631\u0628\u0631",
        url
      }
    ]
  ];
}
function formatNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(Number(value || 0));
}
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch {
    return dateString || "-";
  }
}
function getStatusText(status, type = "order") {
  const orderMap = {
    "order_created": "\u0633\u0641\u0627\u0631\u0634 \u062B\u0628\u062A \u0634\u062F",
    "payment_pending": "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u067E\u0631\u062F\u0627\u062E\u062A",
    "payment_success": "\u067E\u0631\u062F\u0627\u062E\u062A \u0645\u0648\u0641\u0642",
    "payment_failed": "\u067E\u0631\u062F\u0627\u062E\u062A \u0646\u0627\u0645\u0648\u0641\u0642",
    "payment_review": "\u0628\u0631\u0631\u0633\u06CC \u067E\u0631\u062F\u0627\u062E\u062A",
    "order_confirmed": "\u062A\u0623\u06CC\u06CC\u062F \u0633\u0641\u0627\u0631\u0634",
    "processing": "\u062F\u0631 \u062D\u0627\u0644 \u067E\u0631\u062F\u0627\u0632\u0634",
    "ready_to_ship": "\u0622\u0645\u0627\u062F\u0647 \u0627\u0631\u0633\u0627\u0644",
    "courier_delivery": "\u0627\u0631\u0633\u0627\u0644 \u0628\u0627 \u067E\u06CC\u06A9",
    "bus_shipping": "\u0627\u0631\u0633\u0627\u0644 \u0628\u0627 \u0627\u062A\u0648\u0628\u0648\u0633",
    "shipped": "\u0627\u0631\u0633\u0627\u0644 \u0634\u062F",
    "delivered": "\u062A\u062D\u0648\u06CC\u0644 \u062F\u0627\u062F\u0647 \u0634\u062F",
    "completed": "\u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F",
    "cancelled": "\u0644\u063A\u0648 \u0634\u062F",
    "returned": "\u0645\u0631\u062C\u0648\u0639 \u0634\u062F",
    "processing_failed": "\u067E\u0631\u062F\u0627\u0632\u0634 \u0646\u0627\u0645\u0648\u0641\u0642"
  };
  const paymentMap = {
    "payment_pending": "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u067E\u0631\u062F\u0627\u062E\u062A",
    "payment_success": "\u067E\u0631\u062F\u0627\u062E\u062A \u0645\u0648\u0641\u0642",
    "payment_failed": "\u067E\u0631\u062F\u0627\u062E\u062A \u0646\u0627\u0645\u0648\u0641\u0642",
    "payment_review": "\u0628\u0631\u0631\u0633\u06CC \u067E\u0631\u062F\u0627\u062E\u062A",
    "pending": "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u067E\u0631\u062F\u0627\u062E\u062A",
    "paid": "\u067E\u0631\u062F\u0627\u062E\u062A \u0634\u062F\u0647",
    "completed": "\u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F",
    "failed": "\u0646\u0627\u0645\u0648\u0641\u0642",
    "refunded": "\u0628\u0627\u0632\u06AF\u0634\u062A \u062F\u0627\u062F\u0647 \u0634\u062F\u0647"
  };
  const withdrawalMap = {
    "pending": "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u0628\u0631\u0631\u0633\u06CC",
    "approved": "\u062A\u0623\u06CC\u06CC\u062F \u0634\u062F",
    "rejected": "\u0631\u062F \u0634\u062F"
  };
  if (type === "payment") {
    return paymentMap[String(status || "").toLowerCase()] || status || "-";
  }
  if (type === "withdrawal") {
    return withdrawalMap[String(status || "").toLowerCase()] || status || "-";
  }
  return orderMap[String(status || "").toLowerCase()] || status || "-";
}
function buildOrderCreatedMessage(orderData, userData, items) {
  const {
    orderNumber,
    totalAmount,
    shippingAmount,
    walletUsedAmount,
    payableAmount,
    cashbackAmount,
    createdAt
  } = orderData;
  const { fullName, email, phone } = userData;
  let productsText = "";
  let itemsTotal = 0;
  if (Array.isArray(items) && items.length > 0) {
    productsText = items.map((item) => {
      const name = item.product_name || item.name || "\u0645\u062D\u0635\u0648\u0644";
      const qty = Number(item.quantity || 0);
      const total = Number(item.total_price || 0);
      itemsTotal += total;
      return `  \u2022 ${name} \xD7 ${qty} - ${formatNumber(total)} \u062A\u0648\u0645\u0627\u0646`;
    }).join("\n");
  } else {
    productsText = "  \u2022 (\u0622\u06CC\u062A\u0645\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647)";
    itemsTotal = 0;
  }
  let message = `\u{1F6D2} <b>\u0633\u0641\u0627\u0631\u0634 \u062C\u062F\u06CC\u062F #${orderNumber}</b>

`;
  message += `\u{1F464} <b>\u0645\u0634\u062A\u0631\u06CC:</b>
`;
  message += `  ${fullName || "-"}`;
  if (email) message += `
  \u{1F4E7} ${email}`;
  if (phone) message += `
  \u{1F4F1} ${phone}`;
  message += `

`;
  message += `\u{1F4E6} <b>\u0645\u062D\u0635\u0648\u0644\u0627\u062A:</b>
`;
  message += productsText;
  message += `

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A \u06A9\u0644:</b>
`;
  message += `  \u062C\u0645\u0639 \u0645\u062D\u0635\u0648\u0644\u0627\u062A: ${formatNumber(itemsTotal)} \u062A\u0648\u0645\u0627\u0646
`;
  if (shippingAmount > 0) {
    message += `  \u0647\u0632\u06CC\u0646\u0647 \u0627\u0631\u0633\u0627\u0644: ${formatNumber(shippingAmount)} \u062A\u0648\u0645\u0627\u0646
`;
  }
  if (walletUsedAmount > 0) {
    message += `  \u0628\u0631\u062F\u0627\u0634\u062A \u0627\u0632 \u06A9\u06CC\u0641 \u067E\u0648\u0644: -${formatNumber(walletUsedAmount)} \u062A\u0648\u0645\u0627\u0646
`;
  }
  message += `  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;
  message += `  <b>\u0645\u0628\u0644\u063A \u0642\u0627\u0628\u0644 \u067E\u0631\u062F\u0627\u062E\u062A: ${formatNumber(payableAmount || totalAmount)} \u062A\u0648\u0645\u0627\u0646</b>
`;
  if (cashbackAmount > 0) {
    message += `
  \u{1F381} <b>\u06A9\u0634\u200C\u0628\u06A9 \u0627\u06CC\u0646 \u0633\u0641\u0627\u0631\u0634: ${formatNumber(cashbackAmount)} \u062A\u0648\u0645\u0627\u0646</b>`;
    message += `
  (\u067E\u0633 \u0627\u0632 \u062A\u06A9\u0645\u06CC\u0644 \u0633\u0641\u0627\u0631\u0634 \u0628\u0647 \u06A9\u06CC\u0641 \u067E\u0648\u0644 \u0627\u0636\u0627\u0641\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F)`;
  }
  message += `

`;
  message += `\u{1F4B3} <b>\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
  message += `  ${getStatusText(orderData.paymentStatus, "payment")}

`;
  message += `\u{1F4E6} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  ${getStatusText(orderData.status, "order")}

`;
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E \u0648 \u0633\u0627\u0639\u062A:</b>
`;
  message += `  ${formatDate(createdAt)}
`;
  return message;
}
function buildPaymentSuccessMessage(orderData, userData, paymentMethod = "") {
  const { orderNumber, totalAmount, payableAmount, status, createdAt } = orderData;
  const { fullName, email, phone } = userData;
  let message = `\u2705 <b>\u067E\u0631\u062F\u0627\u062E\u062A \u0645\u0648\u0641\u0642</b>

`;
  message += `\u{1F6D2} <b>\u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  #${orderNumber}

`;
  message += `\u{1F464} <b>\u0645\u0634\u062A\u0631\u06CC:</b>
`;
  message += `  ${fullName || "-"}`;
  if (email) message += `
  \u{1F4E7} ${email}`;
  if (phone) message += `
  \u{1F4F1} ${phone}`;
  message += `

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A \u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
  message += `  ${formatNumber(payableAmount || totalAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  if (paymentMethod) {
    message += `\u{1F4B3} <b>\u0631\u0648\u0634 \u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
    message += `  ${paymentMethod}

`;
  }
  message += `\u{1F4E6} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  ${getStatusText(status, "order")}

`;
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E \u0648 \u0633\u0627\u0639\u062A:</b>
`;
  message += `  ${formatDate(createdAt)}
`;
  return message;
}
function buildPaymentStatusChangedMessage(orderData, userData, oldStatus, newStatus) {
  const { orderNumber, totalAmount, status: orderStatus, createdAt } = orderData;
  const { fullName, email } = userData;
  let message = `\u{1F4B3} <b>\u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A</b>

`;
  message += `\u{1F6D2} <b>\u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  #${orderNumber}

`;
  message += `\u{1F464} <b>\u0645\u0634\u062A\u0631\u06CC:</b>
`;
  message += `  ${fullName || "-"}`;
  if (email) message += `
  \u{1F4E7} ${email}`;
  message += `

`;
  message += `\u{1F504} <b>\u0648\u0636\u0639\u06CC\u062A \u0642\u0628\u0644\u06CC:</b>
`;
  message += `  ${getStatusText(oldStatus, "payment")}

`;
  message += `\u27A1\uFE0F <b>\u0648\u0636\u0639\u06CC\u062A \u062C\u062F\u06CC\u062F:</b>
`;
  message += `  ${getStatusText(newStatus, "payment")}

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A:</b>
`;
  message += `  ${formatNumber(totalAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  message += `\u{1F4E6} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  ${getStatusText(orderStatus, "order")}

`;
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E \u0648 \u0633\u0627\u0639\u062A:</b>
`;
  message += `  ${formatDate(createdAt)}
`;
  return message;
}
function buildOrderStatusChangedMessage(orderData, userData, oldStatus, newStatus) {
  const { orderNumber, totalAmount, paymentStatus, createdAt } = orderData;
  const { fullName, email } = userData;
  let message = `\u{1F4E6} <b>\u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634</b>

`;
  message += `\u{1F6D2} <b>\u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  #${orderNumber}

`;
  message += `\u{1F464} <b>\u0645\u0634\u062A\u0631\u06CC:</b>
`;
  message += `  ${fullName || "-"}`;
  if (email) message += `
  \u{1F4E7} ${email}`;
  message += `

`;
  message += `\u{1F504} <b>\u0648\u0636\u0639\u06CC\u062A \u0642\u0628\u0644\u06CC:</b>
`;
  message += `  ${getStatusText(oldStatus, "order")}

`;
  message += `\u27A1\uFE0F <b>\u0648\u0636\u0639\u06CC\u062A \u062C\u062F\u06CC\u062F:</b>
`;
  message += `  ${getStatusText(newStatus, "order")}

`;
  message += `\u{1F4B3} <b>\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
  message += `  ${getStatusText(paymentStatus, "payment")}

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A:</b>
`;
  message += `  ${formatNumber(totalAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E \u0648 \u0633\u0627\u0639\u062A:</b>
`;
  message += `  ${formatDate(createdAt)}
`;
  return message;
}
function buildOrderCancelledMessage(orderData, userData, refundAmount = 0) {
  const { orderNumber, totalAmount, paymentStatus, createdAt } = orderData;
  const { fullName, email, phone } = userData;
  let message = `\u274C <b>\u0633\u0641\u0627\u0631\u0634 \u0644\u063A\u0648 \u0634\u062F</b>

`;
  message += `\u{1F6D2} <b>\u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  #${orderNumber}

`;
  message += `\u{1F464} <b>\u0645\u0634\u062A\u0631\u06CC:</b>
`;
  message += `  ${fullName || "-"}`;
  if (email) message += `
  \u{1F4E7} ${email}`;
  if (phone) message += `
  \u{1F4F1} ${phone}`;
  message += `

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A:</b>
`;
  message += `  ${formatNumber(totalAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  if (refundAmount > 0) {
    message += `\u21A9\uFE0F <b>\u0645\u0628\u0644\u063A \u0628\u0627\u0632\u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
    message += `  ${formatNumber(refundAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  }
  message += `\u{1F4B3} <b>\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
  message += `  ${getStatusText(paymentStatus, "payment")}

`;
  message += `\u{1F4E6} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  \u0644\u063A\u0648 \u0634\u062F

`;
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E \u0648 \u0633\u0627\u0639\u062A:</b>
`;
  message += `  ${formatDate(createdAt)}
`;
  return message;
}
function buildRefundMessage(orderData, userData, refundAmount, refundMethod = "") {
  const { orderNumber, totalAmount, createdAt } = orderData;
  const { fullName, email, phone } = userData;
  let message = `\u21A9\uFE0F <b>\u0628\u0627\u0632\u067E\u0631\u062F\u0627\u062E\u062A \u0627\u0646\u062C\u0627\u0645 \u0634\u062F</b>

`;
  message += `\u{1F6D2} <b>\u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  #${orderNumber}

`;
  message += `\u{1F464} <b>\u0645\u0634\u062A\u0631\u06CC:</b>
`;
  message += `  ${fullName || "-"}`;
  if (email) message += `
  \u{1F4E7} ${email}`;
  if (phone) message += `
  \u{1F4F1} ${phone}`;
  message += `

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A \u0628\u0627\u0632\u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
  message += `  ${formatNumber(refundAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  if (refundMethod) {
    message += `\u{1F4B3} <b>\u0631\u0648\u0634 \u0628\u0627\u0632\u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
    message += `  ${refundMethod}

`;
  }
  message += `\u{1F4E6} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  ${getStatusText(orderData.status, "order")}

`;
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E \u0648 \u0633\u0627\u0639\u062A:</b>
`;
  message += `  ${formatDate(createdAt)}
`;
  return message;
}
function buildWalletTopupMessage(userData, amount, paymentMethod = "", newBalance = 0) {
  const { fullName, email, phone } = userData;
  let message = `\u{1F4B0} <b>\u0634\u0627\u0631\u0698 \u06A9\u06CC\u0641 \u067E\u0648\u0644</b>

`;
  message += `\u{1F464} <b>\u0645\u0634\u062A\u0631\u06CC:</b>
`;
  message += `  ${fullName || "-"}`;
  if (email) message += `
  \u{1F4E7} ${email}`;
  if (phone) message += `
  \u{1F4F1} ${phone}`;
  message += `

`;
  message += `\u{1F4B5} <b>\u0645\u0628\u0644\u063A \u0634\u0627\u0631\u0698:</b>
`;
  message += `  ${formatNumber(amount)} \u062A\u0648\u0645\u0627\u0646

`;
  if (paymentMethod) {
    message += `\u{1F4B3} <b>\u0631\u0648\u0634 \u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
    message += `  ${paymentMethod}

`;
  }
  message += `\u{1F4CB} <b>\u0648\u0636\u0639\u06CC\u062A:</b>
`;
  message += `  \u0645\u0648\u0641\u0642

`;
  if (newBalance > 0) {
    message += `\u{1F45B} <b>\u0645\u0648\u062C\u0648\u062F\u06CC \u062C\u062F\u06CC\u062F \u06A9\u06CC\u0641 \u067E\u0648\u0644:</b>
`;
    message += `  ${formatNumber(newBalance)} \u062A\u0648\u0645\u0627\u0646

`;
  }
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E \u0648 \u0633\u0627\u0639\u062A:</b>
`;
  message += `  ${formatDate((/* @__PURE__ */ new Date()).toISOString())}
`;
  return message;
}
function buildWalletWithdrawalRequestMessage(userData, amount, destinationInfo = "", requestId = "") {
  const { fullName, email, phone } = userData;
  let message = `\u{1F4B8} <b>\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0628\u0631\u062F\u0627\u0634\u062A \u0627\u0632 \u06A9\u06CC\u0641 \u067E\u0648\u0644</b>

`;
  message += `\u{1F464} <b>\u0645\u0634\u062A\u0631\u06CC:</b>
`;
  message += `  ${fullName || "-"}`;
  if (email) message += `
  \u{1F4E7} ${email}`;
  if (phone) message += `
  \u{1F4F1} ${phone}`;
  message += `

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A \u0628\u0631\u062F\u0627\u0634\u062A:</b>
`;
  message += `  ${formatNumber(amount)} \u062A\u0648\u0645\u0627\u0646

`;
  if (destinationInfo) {
    message += `\u{1F3E6} <b>\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0645\u0642\u0635\u062F:</b>
`;
    message += `  ${destinationInfo}

`;
  }
  if (requestId) {
    message += `\u{1F4CB} <b>\u0634\u0646\u0627\u0633\u0647 \u062F\u0631\u062E\u0648\u0627\u0633\u062A:</b>
`;
    message += `  #${requestId}

`;
  }
  message += `\u{1F4CB} <b>\u0648\u0636\u0639\u06CC\u062A \u062F\u0631\u062E\u0648\u0627\u0633\u062A:</b>
`;
  message += `  \u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u0628\u0631\u0631\u0633\u06CC

`;
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E \u0648 \u0633\u0627\u0639\u062A:</b>
`;
  message += `  ${formatDate((/* @__PURE__ */ new Date()).toISOString())}
`;
  return message;
}
function buildWalletWithdrawalStatusMessage(userData, amount, oldStatus, newStatus, requestId = "", reason = "") {
  const { fullName, email } = userData;
  const statusEmoji = newStatus === "approved" ? "\u2705" : newStatus === "rejected" ? "\u274C" : "\u{1F4CB}";
  const statusText = newStatus === "approved" ? "\u062A\u0623\u06CC\u06CC\u062F \u0634\u062F" : newStatus === "rejected" ? "\u0631\u062F \u0634\u062F" : getStatusText(newStatus, "withdrawal");
  let message = `${statusEmoji} <b>\u0628\u0631\u062F\u0627\u0634\u062A \u06A9\u06CC\u0641 \u067E\u0648\u0644 ${statusText}</b>

`;
  message += `\u{1F464} <b>\u0645\u0634\u062A\u0631\u06CC:</b>
`;
  message += `  ${fullName || "-"}`;
  if (email) message += `
  \u{1F4E7} ${email}`;
  message += `

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A:</b>
`;
  message += `  ${formatNumber(amount)} \u062A\u0648\u0645\u0627\u0646

`;
  if (requestId) {
    message += `\u{1F4CB} <b>\u0634\u0646\u0627\u0633\u0647 \u062F\u0631\u062E\u0648\u0627\u0633\u062A:</b>
`;
    message += `  #${requestId}

`;
  }
  message += `\u{1F504} <b>\u0648\u0636\u0639\u06CC\u062A \u0642\u0628\u0644\u06CC:</b>
`;
  message += `  ${getStatusText(oldStatus, "withdrawal")}

`;
  message += `\u27A1\uFE0F <b>\u0648\u0636\u0639\u06CC\u062A \u062C\u062F\u06CC\u062F:</b>
`;
  message += `  ${statusText}

`;
  if (reason && newStatus === "rejected") {
    message += `\u{1F4DD} <b>\u062F\u0644\u06CC\u0644:</b>
`;
    message += `  ${reason}

`;
  }
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E \u0648 \u0633\u0627\u0639\u062A:</b>
`;
  message += `  ${formatDate((/* @__PURE__ */ new Date()).toISOString())}
`;
  return message;
}
function buildCashbackAppliedMessage(orderData, userData, cashbackAmount, newBalance = 0) {
  const { orderNumber, createdAt } = orderData;
  const { fullName, email } = userData;
  let message = `\u{1F381} <b>\u06A9\u0634\u200C\u0628\u06A9 \u0627\u0639\u0645\u0627\u0644 \u0634\u062F</b>

`;
  message += `\u{1F6D2} <b>\u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  #${orderNumber}

`;
  message += `\u{1F464} <b>\u0645\u0634\u062A\u0631\u06CC:</b>
`;
  message += `  ${fullName || "-"}`;
  if (email) message += `
  \u{1F4E7} ${email}`;
  message += `

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A \u06A9\u0634\u200C\u0628\u06A9:</b>
`;
  message += `  ${formatNumber(cashbackAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  if (newBalance > 0) {
    message += `\u{1F45B} <b>\u0645\u0648\u062C\u0648\u062F\u06CC \u062C\u062F\u06CC\u062F \u06A9\u06CC\u0641 \u067E\u0648\u0644:</b>
`;
    message += `  ${formatNumber(newBalance)} \u062A\u0648\u0645\u0627\u0646

`;
  }
  message += `\u{1F4E6} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  ${getStatusText(orderData.status, "order")}

`;
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E \u0648 \u0633\u0627\u0639\u062A:</b>
`;
  message += `  ${formatDate(createdAt || (/* @__PURE__ */ new Date()).toISOString())}
`;
  return message;
}
function buildUserOrderCreatedMessage(orderData, userData, items) {
  const {
    orderNumber,
    totalAmount,
    shippingAmount,
    walletUsedAmount,
    payableAmount,
    cashbackAmount,
    status,
    paymentStatus,
    createdAt
  } = orderData;
  const { fullName } = userData;
  let message = `\u{1F6CD}\uFE0F <b>\u0633\u0641\u0627\u0631\u0634 \u0634\u0645\u0627 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062B\u0628\u062A \u0634\u062F</b>

`;
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  message += `\u{1F9FE} <b>\u0634\u0645\u0627\u0631\u0647 \u0633\u0641\u0627\u0631\u0634:</b> #${orderNumber}
`;
  message += `\u{1F4C5} <b>\u062A\u0627\u0631\u06CC\u062E \u062B\u0628\u062A:</b> ${formatDate(createdAt)}

`;
  let productsText = "";
  let itemsTotal = 0;
  if (Array.isArray(items) && items.length > 0) {
    productsText = items.map((item) => {
      const name = item.product_name || item.name || "\u0645\u062D\u0635\u0648\u0644";
      const qty = Number(item.quantity || 0);
      const total = Number(item.total_price || 0);
      itemsTotal += total;
      return `  \u2022 ${name} \xD7 ${qty} - ${formatNumber(total)} \u062A\u0648\u0645\u0627\u0646`;
    }).join("\n");
  } else {
    productsText = "  \u2022 (\u0622\u06CC\u062A\u0645\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647)";
  }
  message += `\u{1F4E6} <b>\u0627\u0642\u0644\u0627\u0645 \u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += productsText;
  message += `

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A \u06A9\u0627\u0644\u0627\u0647\u0627:</b> ${formatNumber(itemsTotal)} \u062A\u0648\u0645\u0627\u0646
`;
  if (shippingAmount > 0) {
    message += `\u{1F69A} <b>\u0647\u0632\u06CC\u0646\u0647 \u0627\u0631\u0633\u0627\u0644:</b> ${formatNumber(shippingAmount)} \u062A\u0648\u0645\u0627\u0646
`;
  }
  if (walletUsedAmount > 0) {
    message += `\u{1F45B} <b>\u0628\u0631\u062F\u0627\u0634\u062A \u0627\u0632 \u06A9\u06CC\u0641 \u067E\u0648\u0644:</b> -${formatNumber(walletUsedAmount)} \u062A\u0648\u0645\u0627\u0646
`;
  }
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  message += `\u{1F4B3} <b>\u0645\u0628\u0644\u063A \u0646\u0647\u0627\u06CC\u06CC:</b> ${formatNumber(payableAmount || totalAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  if (cashbackAmount > 0) {
    message += `\u{1F4B0} <b>\u06A9\u0634\u200C\u0628\u06A9 \u0627\u06CC\u0646 \u0633\u0641\u0627\u0631\u0634:</b> ${formatNumber(cashbackAmount)} \u062A\u0648\u0645\u0627\u0646
`;
    message += `(\u067E\u0633 \u0627\u0632 \u062A\u06A9\u0645\u06CC\u0644 \u0633\u0641\u0627\u0631\u0634 \u0628\u0647 \u06A9\u06CC\u0641 \u067E\u0648\u0644 \u0634\u0645\u0627 \u0627\u0636\u0627\u0641\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F)

`;
  }
  message += `\u{1F4CC} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634:</b> ${getStatusText(status, "order")}
`;
  message += `\u{1F4CC} <b>\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A:</b> ${getStatusText(paymentStatus, "payment")}

`;
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  message += `\u0627\u0632 \u062E\u0631\u06CC\u062F \u0634\u0645\u0627 \u0633\u067E\u0627\u0633\u06AF\u0632\u0627\u0631\u06CC\u0645 \u2764\uFE0F
`;
  return message;
}
function buildUserPaymentSuccessMessage(orderData, userData, paymentMethod = "") {
  const { orderNumber, totalAmount, payableAmount, cashbackAmount, status, createdAt } = orderData;
  const { fullName } = userData;
  let message = `\u2705 <b>\u067E\u0631\u062F\u0627\u062E\u062A \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u0634\u062F</b>

`;
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  message += `\u{1F9FE} <b>\u0634\u0645\u0627\u0631\u0647 \u0633\u0641\u0627\u0631\u0634:</b> #${orderNumber}
`;
  message += `\u{1F464} <b>\u0646\u0627\u0645:</b> ${fullName || "-"}

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A \u067E\u0631\u062F\u0627\u062E\u062A\u200C\u0634\u062F\u0647:</b>
`;
  message += `  ${formatNumber(payableAmount || totalAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  if (paymentMethod) {
    message += `\u{1F4B3} <b>\u0631\u0648\u0634 \u067E\u0631\u062F\u0627\u062E\u062A:</b> ${paymentMethod}

`;
  }
  if (cashbackAmount > 0) {
    message += `\u{1F381} <b>\u06A9\u0634\u200C\u0628\u06A9 \u0627\u06CC\u0646 \u0633\u0641\u0627\u0631\u0634:</b> ${formatNumber(cashbackAmount)} \u062A\u0648\u0645\u0627\u0646
`;
    message += `(\u067E\u0633 \u0627\u0632 \u062A\u06A9\u0645\u06CC\u0644 \u0633\u0641\u0627\u0631\u0634 \u0628\u0647 \u06A9\u06CC\u0641 \u067E\u0648\u0644 \u0634\u0645\u0627 \u0627\u0636\u0627\u0641\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F)

`;
  }
  message += `\u{1F4CC} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634:</b> ${getStatusText(status, "order")}

`;
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  message += `\u0627\u0632 \u0627\u0639\u062A\u0645\u0627\u062F \u0634\u0645\u0627 \u0633\u067E\u0627\u0633\u06AF\u0632\u0627\u0631\u06CC\u0645 \u2764\uFE0F
`;
  return message;
}
function buildUserOrderStatusChangedMessage(orderData, userData, oldStatus, newStatus, trackingCode = "") {
  const { orderNumber, totalAmount, paymentStatus, createdAt } = orderData;
  const { fullName } = userData;
  const statusEmoji = {
    "pending": "\u23F3",
    "processing": "\u{1F504}",
    "preparing": "\u{1F4E6}",
    "shipped": "\u{1F69A}",
    "completed": "\u2705",
    "cancelled": "\u274C"
  };
  const emoji = statusEmoji[String(newStatus).toLowerCase()] || "\u{1F4CB}";
  let message = `${emoji} <b>\u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634</b>

`;
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  message += `\u{1F9FE} <b>\u0634\u0645\u0627\u0631\u0647 \u0633\u0641\u0627\u0631\u0634:</b> #${orderNumber}
`;
  message += `\u{1F464} <b>\u0646\u0627\u0645:</b> ${fullName || "-"}

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A \u0633\u0641\u0627\u0631\u0634:</b> ${formatNumber(totalAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  message += `\u{1F504} <b>\u0648\u0636\u0639\u06CC\u062A \u0642\u0628\u0644\u06CC:</b>
`;
  message += `  ${getStatusText(oldStatus, "order")}

`;
  message += `\u27A1\uFE0F <b>\u0648\u0636\u0639\u06CC\u062A \u062C\u062F\u06CC\u062F:</b>
`;
  message += `  ${getStatusText(newStatus, "order")}

`;
  message += `\u{1F4B3} <b>\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
  message += `  ${getStatusText(paymentStatus, "payment")}

`;
  if (trackingCode) {
    message += `\u{1F4EE} <b>\u06A9\u062F \u0631\u0647\u06AF\u06CC\u0631\u06CC:</b>
`;
    message += `  ${trackingCode}

`;
  }
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E:</b> ${formatDate(createdAt)}

`;
  if (newStatus === "shipped") {
    message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
    message += `\u{1F4CC} <b>\u0646\u06A9\u062A\u0647:</b>
`;
    message += `  \u0633\u0641\u0627\u0631\u0634 \u0634\u0645\u0627 \u0627\u0631\u0633\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A. \u06A9\u062F \u0631\u0647\u06AF\u06CC\u0631\u06CC \u0631\u0627 \u062F\u0631 \u0628\u0627\u0644\u0627 \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0646\u06CC\u062F.
`;
  } else if (newStatus === "completed") {
    message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
    message += `\u{1F389} <b>\u0633\u0641\u0627\u0631\u0634 \u0634\u0645\u0627 \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F!</b>
`;
    message += `  \u0627\u0632 \u062E\u0631\u06CC\u062F \u0634\u0645\u0627 \u0645\u062A\u0634\u06A9\u0631\u06CC\u0645.
`;
  }
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  return message;
}
function buildUserOrderCancelledMessage(orderData, userData, refundAmount = 0) {
  const { orderNumber, totalAmount, paymentStatus, createdAt } = orderData;
  const { fullName } = userData;
  let message = `\u274C <b>\u0633\u0641\u0627\u0631\u0634 \u0634\u0645\u0627 \u0644\u063A\u0648 \u0634\u062F</b>

`;
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  message += `\u{1F9FE} <b>\u0634\u0645\u0627\u0631\u0647 \u0633\u0641\u0627\u0631\u0634:</b> #${orderNumber}
`;
  message += `\u{1F464} <b>\u0646\u0627\u0645:</b> ${fullName || "-"}

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A \u0633\u0641\u0627\u0631\u0634:</b> ${formatNumber(totalAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  if (refundAmount > 0) {
    message += `\u21A9\uFE0F <b>\u0645\u0628\u0644\u063A \u0628\u0627\u0632\u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
    message += `  ${formatNumber(refundAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  }
  message += `\u{1F4CC} <b>\u0648\u0636\u0639\u06CC\u062A:</b>
`;
  message += `  \u0644\u063A\u0648 \u0634\u062F\u0647

`;
  message += `\u{1F4B3} <b>\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
  message += `  ${getStatusText(paymentStatus, "payment")}

`;
  message += `\u{1F550} <b>\u062A\u0627\u0631\u06CC\u062E:</b> ${formatDate(createdAt)}

`;
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  return message;
}
function buildUserOrderTrackingMessage(orderData, userData, items = []) {
  const { orderNumber, totalAmount, payableAmount, status, paymentStatus, createdAt, updatedAt } = orderData;
  const { fullName } = userData;
  let message = `\u{1F50E} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634 \u0634\u0645\u0627</b>

`;
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  message += `\u{1F9FE} <b>\u0634\u0645\u0627\u0631\u0647 \u0633\u0641\u0627\u0631\u0634:</b> #${orderNumber}
`;
  message += `\u{1F464} <b>\u0646\u0627\u0645:</b> ${fullName || "-"}

`;
  let productsText = "";
  if (Array.isArray(items) && items.length > 0) {
    productsText = items.map((item) => {
      const name = item.product_name || item.name || "\u0645\u062D\u0635\u0648\u0644";
      const qty = Number(item.quantity || 0);
      return `  \u2022 ${name} \xD7 ${qty}`;
    }).join("\n");
  } else {
    productsText = "  -";
  }
  message += `\u{1F4E6} <b>\u0645\u062D\u0635\u0648\u0644\u0627\u062A:</b>
`;
  message += productsText;
  message += `

`;
  message += `\u{1F4CC} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  ${getStatusText(status, "order")}

`;
  message += `\u{1F4B3} <b>\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
  message += `  ${getStatusText(paymentStatus, "payment")}

`;
  message += `\u{1F4B0} <b>\u0645\u0628\u0644\u063A:</b>
`;
  message += `  ${formatNumber(payableAmount || totalAmount)} \u062A\u0648\u0645\u0627\u0646

`;
  message += `\u{1F4C5} <b>\u062A\u0627\u0631\u06CC\u062E \u062B\u0628\u062A:</b>
`;
  message += `  ${formatDate(createdAt)}

`;
  if (updatedAt && updatedAt !== createdAt) {
    message += `\u{1F550} <b>\u0622\u062E\u0631\u06CC\u0646 \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC:</b>
`;
    message += `  ${formatDate(updatedAt)}

`;
  }
  message += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
`;
  message += `\u{1F4CC} \u0628\u0631\u0627\u06CC \u0645\u0634\u0627\u0647\u062F\u0647 \u062C\u0632\u0626\u06CC\u0627\u062A \u06A9\u0627\u0645\u0644\u060C \u0631\u0648\u06CC \u062F\u06A9\u0645\u0647 \u0632\u06CC\u0631 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F.
`;
  return message;
}
function createUserOrderTrackingButton(orderNumber, baseUrl = "") {
  const siteUrl = baseUrl || "https://takdaro-site.pages.dev";
  const url = `${siteUrl}/invoice.html?order=${encodeURIComponent(orderNumber)}`;
  return [
    [
      {
        text: "\u{1F50D} \u0645\u0634\u0627\u0647\u062F\u0647 \u062C\u0632\u0626\u06CC\u0627\u062A \u0633\u0641\u0627\u0631\u0634",
        url
      }
    ],
    [
      {
        text: "\u{1F4DE} \u062A\u0645\u0627\u0633 \u0628\u0627 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC",
        url: `${siteUrl}/contact.html`
      }
    ]
  ];
}
var init_telegram = __esm({
  "lib/telegram.js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(sendTelegramMessage, "sendTelegramMessage");
    __name(createOrderViewButton, "createOrderViewButton");
    __name(createUserViewButton, "createUserViewButton");
    __name(formatNumber, "formatNumber");
    __name(formatDate, "formatDate");
    __name(getStatusText, "getStatusText");
    __name(buildOrderCreatedMessage, "buildOrderCreatedMessage");
    __name(buildPaymentSuccessMessage, "buildPaymentSuccessMessage");
    __name(buildPaymentStatusChangedMessage, "buildPaymentStatusChangedMessage");
    __name(buildOrderStatusChangedMessage, "buildOrderStatusChangedMessage");
    __name(buildOrderCancelledMessage, "buildOrderCancelledMessage");
    __name(buildRefundMessage, "buildRefundMessage");
    __name(buildWalletTopupMessage, "buildWalletTopupMessage");
    __name(buildWalletWithdrawalRequestMessage, "buildWalletWithdrawalRequestMessage");
    __name(buildWalletWithdrawalStatusMessage, "buildWalletWithdrawalStatusMessage");
    __name(buildCashbackAppliedMessage, "buildCashbackAppliedMessage");
    __name(buildUserOrderCreatedMessage, "buildUserOrderCreatedMessage");
    __name(buildUserPaymentSuccessMessage, "buildUserPaymentSuccessMessage");
    __name(buildUserOrderStatusChangedMessage, "buildUserOrderStatusChangedMessage");
    __name(buildUserOrderCancelledMessage, "buildUserOrderCancelledMessage");
    __name(buildUserOrderTrackingMessage, "buildUserOrderTrackingMessage");
    __name(createUserOrderTrackingButton, "createUserOrderTrackingButton");
  }
});

// lib/sms.js
function generateMessageId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function normalizePhoneNumber(phone) {
  if (!phone) return "";
  let cleaned = String(phone).trim();
  cleaned = cleaned.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = "+98" + cleaned.substring(1);
  }
  if (cleaned.startsWith("98") && cleaned.length === 12 && !cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  if (cleaned.startsWith("9") && cleaned.length === 10 && !cleaned.startsWith("+")) {
    cleaned = "+98" + cleaned;
  }
  return cleaned;
}
function getPersianOrderStatus(status) {
  const map = {
    "order_created": "\u0633\u0641\u0627\u0631\u0634 \u062B\u0628\u062A \u0634\u062F",
    "payment_pending": "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u067E\u0631\u062F\u0627\u062E\u062A",
    "payment_success": "\u067E\u0631\u062F\u0627\u062E\u062A \u0645\u0648\u0641\u0642",
    "payment_failed": "\u067E\u0631\u062F\u0627\u062E\u062A \u0646\u0627\u0645\u0648\u0641\u0642",
    "payment_review": "\u0628\u0631\u0631\u0633\u06CC \u067E\u0631\u062F\u0627\u062E\u062A",
    "order_confirmed": "\u062A\u0623\u06CC\u06CC\u062F \u0633\u0641\u0627\u0631\u0634",
    "processing": "\u062F\u0631 \u062D\u0627\u0644 \u067E\u0631\u062F\u0627\u0632\u0634",
    "ready_to_ship": "\u0622\u0645\u0627\u062F\u0647 \u0627\u0631\u0633\u0627\u0644",
    "courier_delivery": "\u0627\u0631\u0633\u0627\u0644 \u0628\u0627 \u067E\u06CC\u06A9",
    "bus_shipping": "\u0627\u0631\u0633\u0627\u0644 \u0628\u0627 \u0627\u062A\u0648\u0628\u0648\u0633",
    "shipped": "\u0627\u0631\u0633\u0627\u0644 \u0634\u062F",
    "delivered": "\u062A\u062D\u0648\u06CC\u0644 \u062F\u0627\u062F\u0647 \u0634\u062F",
    "completed": "\u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F",
    "cancelled": "\u0644\u063A\u0648 \u0634\u062F",
    "returned": "\u0645\u0631\u062C\u0648\u0639 \u0634\u062F",
    "processing_failed": "\u067E\u0631\u062F\u0627\u0632\u0634 \u0646\u0627\u0645\u0648\u0641\u0642"
  };
  return map[String(status || "").toLowerCase()] || status || "";
}
function getPersianPaymentStatus(status) {
  const map = {
    "payment_pending": "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u067E\u0631\u062F\u0627\u062E\u062A",
    "payment_success": "\u067E\u0631\u062F\u0627\u062E\u062A \u0645\u0648\u0641\u0642",
    "payment_failed": "\u067E\u0631\u062F\u0627\u062E\u062A \u0646\u0627\u0645\u0648\u0641\u0642",
    "payment_review": "\u0628\u0631\u0631\u0633\u06CC \u067E\u0631\u062F\u0627\u062E\u062A",
    "pending": "\u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u067E\u0631\u062F\u0627\u062E\u062A",
    "paid": "\u067E\u0631\u062F\u0627\u062E\u062A \u0634\u062F\u0647",
    "completed": "\u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F\u0647",
    "failed": "\u0646\u0627\u0645\u0648\u0641\u0642",
    "refunded": "\u0628\u0627\u0632\u06AF\u0634\u062A \u062F\u0627\u062F\u0647 \u0634\u062F\u0647"
  };
  return map[String(status || "").toLowerCase()] || status || "";
}
function formatPersianAmount(amount) {
  const num = Number(amount || 0);
  return num.toLocaleString("fa-IR");
}
async function getSmsTemplate(env, eventType) {
  const db = getDb(env);
  const result = await db.prepare(`
      SELECT 
        id,
        event_type,
        title,
        message_template,
        is_enabled,
        created_at,
        updated_at
      FROM sms_templates
      WHERE event_type = ?
    `).bind(eventType).first();
  return result;
}
async function getAllSmsTemplates(env, onlyEnabled = false) {
  const db = getDb(env);
  let query = `
    SELECT 
      id,
      event_type,
      title,
      message_template,
      is_enabled,
      created_at,
      updated_at
    FROM sms_templates
  `;
  if (onlyEnabled) {
    query += ` WHERE is_enabled = 1`;
  }
  query += ` ORDER BY id ASC`;
  const result = await db.prepare(query).all();
  return Array.isArray(result?.results) ? result.results : [];
}
async function saveSmsTemplate(env, data) {
  const db = getDb(env);
  const {
    eventType,
    title,
    messageTemplate,
    isEnabled
  } = data;
  if (!eventType || !title || !messageTemplate) {
    throw new Error("eventType, title \u0648 messageTemplate \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F.");
  }
  const existing = await db.prepare(`SELECT id FROM sms_templates WHERE event_type = ?`).bind(eventType).first();
  if (existing) {
    await db.prepare(`
        UPDATE sms_templates
        SET 
          title = ?,
          message_template = ?,
          is_enabled = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE event_type = ?
      `).bind(title, messageTemplate, isEnabled ? 1 : 0, eventType).run();
  } else {
    await db.prepare(`
        INSERT INTO sms_templates (event_type, title, message_template, is_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(eventType, title, messageTemplate, isEnabled ? 1 : 0).run();
  }
  return { success: true };
}
async function toggleSmsTemplate(env, eventType, isEnabled) {
  const db = getDb(env);
  await db.prepare(`
      UPDATE sms_templates
      SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE event_type = ?
    `).bind(isEnabled ? 1 : 0, eventType).run();
  return { success: true };
}
function renderSmsTemplate(template, data) {
  if (!template) return "";
  let result = template;
  const variables = {
    "{customer_name}": data.customer_name || "",
    "{customer_phone}": data.customer_phone || "",
    "{order_number}": data.order_number || "",
    "{amount}": formatPersianAmount(data.amount),
    "{payment_status}": getPersianPaymentStatus(data.payment_status),
    "{order_status}": getPersianOrderStatus(data.order_status),
    "{tracking_code}": data.tracking_code || ""
  };
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(key, "g"), value);
  }
  return result;
}
async function getAndRenderSmsTemplate(env, eventType, data) {
  const template = await getSmsTemplate(env, eventType);
  if (!template) {
    return {
      template: null,
      rendered: null,
      isEnabled: false,
      error: "Template \u06CC\u0627\u0641\u062A \u0646\u0634\u062F"
    };
  }
  const rendered = renderSmsTemplate(template.message_template, data);
  return {
    template,
    rendered,
    isEnabled: template.is_enabled === 1
  };
}
async function getSmsSettings(env) {
  const db = getDb(env);
  const result = await db.prepare(`
      SELECT 
        id,
        is_enabled,
        admin_phone,
        gateway_url,
        polling_interval,
        max_sms_per_minute,
        retry_interval,
        default_sender,
        event_order_created_admin,
        event_order_created_user,
        event_order_status_changed_user,
        event_payment_success_admin,
        event_payment_success_user,
        event_order_cancelled_user,
        extra_config,
        updated_by_user_id,
        created_at,
        updated_at
      FROM sms_settings
      LIMIT 1
    `).first();
  if (!result) {
    return {
      is_enabled: false,
      admin_phone: "",
      gateway_url: "",
      polling_interval: 30,
      max_sms_per_minute: 10,
      retry_interval: 300,
      default_sender: "",
      event_order_created_admin: true,
      event_order_created_user: false,
      event_order_status_changed_user: false,
      event_payment_success_admin: true,
      event_payment_success_user: false,
      event_order_cancelled_user: false,
      extra_config: {}
    };
  }
  let extraConfig = {};
  try {
    if (result.extra_config && typeof result.extra_config === "string") {
      extraConfig = JSON.parse(result.extra_config);
    } else if (result.extra_config && typeof result.extra_config === "object") {
      extraConfig = result.extra_config;
    }
  } catch (_) {
    extraConfig = {};
  }
  return {
    id: result.id,
    is_enabled: result.is_enabled === 1,
    admin_phone: result.admin_phone || "",
    gateway_url: result.gateway_url || "",
    polling_interval: result.polling_interval || 30,
    max_sms_per_minute: result.max_sms_per_minute || 10,
    retry_interval: result.retry_interval || 300,
    default_sender: result.default_sender || "",
    event_order_created_admin: result.event_order_created_admin === 1,
    event_order_created_user: result.event_order_created_user === 1,
    event_order_status_changed_user: result.event_order_status_changed_user === 1,
    event_payment_success_admin: result.event_payment_success_admin === 1,
    event_payment_success_user: result.event_payment_success_user === 1,
    event_order_cancelled_user: result.event_order_cancelled_user === 1,
    extra_config: extraConfig,
    updated_by_user_id: result.updated_by_user_id,
    created_at: result.created_at,
    updated_at: result.updated_at
  };
}
async function saveSmsSettings(env, settings, userId) {
  const db = getDb(env);
  const allowedFields = [
    "is_enabled",
    "admin_phone",
    "gateway_url",
    "polling_interval",
    "max_sms_per_minute",
    "retry_interval",
    "default_sender",
    "event_order_created_admin",
    "event_order_created_user",
    "event_order_status_changed_user",
    "event_payment_success_admin",
    "event_payment_success_user",
    "event_order_cancelled_user",
    "extra_config"
  ];
  const updates = [];
  const values = [];
  for (const field of allowedFields) {
    if (settings[field] !== void 0) {
      let value = settings[field];
      if (typeof value === "boolean") {
        value = value ? 1 : 0;
      }
      if (field === "extra_config" && typeof value === "object") {
        value = JSON.stringify(value);
      }
      updates.push(`${field} = ?`);
      values.push(value);
    }
  }
  if (updates.length === 0) {
    throw new Error("\u0647\u06CC\u0686 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A\u06CC \u0628\u0631\u0627\u06CC \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");
  }
  const existing = await db.prepare(`SELECT id FROM sms_settings LIMIT 1`).first();
  if (existing) {
    values.push(userId);
    const query = `
      UPDATE sms_settings
      SET ${updates.join(", ")}, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    values.push(existing.id);
    await db.prepare(query).bind(...values).run();
  } else {
    const insertFields = [...allowedFields, "updated_by_user_id"];
    const placeholders = insertFields.map(() => "?").join(", ");
    const insertValues = [];
    for (const field of allowedFields) {
      const val = settings[field] !== void 0 ? settings[field] : null;
      let value = val;
      if (typeof value === "boolean") {
        value = value ? 1 : 0;
      }
      if (field === "extra_config" && typeof value === "object") {
        value = JSON.stringify(value);
      }
      insertValues.push(value);
    }
    insertValues.push(userId);
    const query = `
      INSERT INTO sms_settings (${insertFields.join(", ")}, created_at, updated_at)
      VALUES (${placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    await db.prepare(query).bind(...insertValues).run();
  }
  return { success: true };
}
async function addSmsToOutbox(env, data) {
  const db = getDb(env);
  const {
    recipient,
    message,
    sender = "",
    priority = 0,
    eventType = null,
    referenceId = null,
    referenceType = null,
    createdByUserId = null,
    maxRetry = 3
  } = data;
  if (!recipient || !message) {
    throw new Error("\u06AF\u06CC\u0631\u0646\u062F\u0647 \u0648 \u0645\u062A\u0646 \u067E\u06CC\u0627\u0645 \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F.");
  }
  const normalizedRecipient = normalizePhoneNumber(recipient);
  if (!normalizedRecipient) {
    throw new Error("\u0634\u0645\u0627\u0631\u0647 \u06AF\u06CC\u0631\u0646\u062F\u0647 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
  }
  const messageId = generateMessageId();
  const result = await db.prepare(`
      INSERT INTO sms_outbox (
        message_id,
        recipient,
        message,
        sender,
        priority,
        status,
        retry_count,
        max_retry,
        event_type,
        reference_id,
        reference_type,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
    messageId,
    normalizedRecipient,
    message,
    sender || "",
    priority || 0,
    maxRetry || 3,
    eventType || null,
    referenceId || null,
    referenceType || null,
    createdByUserId || null
  ).run();
  await logGatewayActivity(env, {
    direction: "outbound",
    messageId,
    gatewayAction: "queued",
    status: "pending",
    durationMs: null,
    gatewayIp: null,
    errorMessage: null
  });
  return {
    success: true,
    messageId,
    id: result.meta?.last_row_id || null
  };
}
async function getIncomingSms(env, options = {}) {
  const db = getDb(env);
  const {
    sender,
    recipient,
    status,
    processed,
    limit = 50,
    offset = 0,
    fromDate,
    toDate
  } = options;
  let query = `
    SELECT 
      id,
      message_id,
      sender,
      recipient,
      message,
      received_at,
      processed,
      processed_at,
      processed_by,
      status,
      reference_id,
      reference_type,
      note,
      created_at,
      updated_at
    FROM sms_inbox
    WHERE 1=1
  `;
  const params = [];
  if (sender) {
    query += ` AND sender = ?`;
    params.push(normalizePhoneNumber(sender));
  }
  if (recipient) {
    query += ` AND recipient = ?`;
    params.push(normalizePhoneNumber(recipient));
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (processed !== void 0) {
    query += ` AND processed = ?`;
    params.push(processed ? 1 : 0);
  }
  if (fromDate) {
    query += ` AND received_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    query += ` AND received_at <= ?`;
    params.push(toDate);
  }
  query += ` ORDER BY received_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  const result = await db.prepare(query).bind(...params).all();
  let countQuery = `
    SELECT COUNT(*) as total
    FROM sms_inbox
    WHERE 1=1
  `;
  const countParams = [];
  if (sender) {
    countQuery += ` AND sender = ?`;
    countParams.push(normalizePhoneNumber(sender));
  }
  if (recipient) {
    countQuery += ` AND recipient = ?`;
    countParams.push(normalizePhoneNumber(recipient));
  }
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  if (processed !== void 0) {
    countQuery += ` AND processed = ?`;
    countParams.push(processed ? 1 : 0);
  }
  if (fromDate) {
    countQuery += ` AND received_at >= ?`;
    countParams.push(fromDate);
  }
  if (toDate) {
    countQuery += ` AND received_at <= ?`;
    countParams.push(toDate);
  }
  const countResult = await db.prepare(countQuery).bind(...countParams).first();
  return {
    sms: Array.isArray(result?.results) ? result.results : [],
    total: countResult?.total || 0,
    limit,
    offset
  };
}
async function logGatewayActivity(env, data) {
  const db = getDb(env);
  const {
    direction,
    messageId,
    gatewayAction,
    requestPayload = null,
    responsePayload = null,
    status,
    errorMessage = null,
    durationMs = null,
    gatewayIp = null
  } = data;
  if (!direction || !gatewayAction || !status) {
    throw new Error("direction, gatewayAction \u0648 status \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F.");
  }
  const result = await db.prepare(`
      INSERT INTO sms_gateway_logs (
        direction,
        message_id,
        gateway_action,
        request_payload,
        response_payload,
        status,
        error_message,
        duration_ms,
        gateway_ip,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
    direction,
    messageId || null,
    gatewayAction,
    requestPayload || null,
    responsePayload || null,
    status,
    errorMessage || null,
    durationMs || null,
    gatewayIp || null
  ).run();
  return result.meta?.last_row_id || null;
}
async function getGatewayLogs(env, options = {}) {
  const db = getDb(env);
  const {
    direction,
    status,
    messageId,
    limit = 50,
    offset = 0,
    fromDate,
    toDate
  } = options;
  let query = `
    SELECT 
      id,
      direction,
      message_id,
      gateway_action,
      status,
      error_message,
      duration_ms,
      gateway_ip,
      created_at
    FROM sms_gateway_logs
    WHERE 1=1
  `;
  const params = [];
  if (direction) {
    query += ` AND direction = ?`;
    params.push(direction);
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (messageId) {
    query += ` AND message_id = ?`;
    params.push(messageId);
  }
  if (fromDate) {
    query += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    query += ` AND created_at <= ?`;
    params.push(toDate);
  }
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  const result = await db.prepare(query).bind(...params).all();
  let countQuery = `
    SELECT COUNT(*) as total
    FROM sms_gateway_logs
    WHERE 1=1
  `;
  const countParams = [];
  if (direction) {
    countQuery += ` AND direction = ?`;
    countParams.push(direction);
  }
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  if (messageId) {
    countQuery += ` AND message_id = ?`;
    countParams.push(messageId);
  }
  if (fromDate) {
    countQuery += ` AND created_at >= ?`;
    countParams.push(fromDate);
  }
  if (toDate) {
    countQuery += ` AND created_at <= ?`;
    countParams.push(toDate);
  }
  const countResult = await db.prepare(countQuery).bind(...countParams).first();
  return {
    logs: Array.isArray(result?.results) ? result.results : [],
    total: countResult?.total || 0,
    limit,
    offset
  };
}
async function getSmsStats(env) {
  const db = getDb(env);
  const outboxStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'retry' THEN 1 ELSE 0 END) as retry
      FROM sms_outbox
    `).first();
  const inboxStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN processed = 0 THEN 1 ELSE 0 END) as unprocessed
      FROM sms_inbox
    `).first();
  const logStats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM sms_gateway_logs
    `).first();
  const lastSent = await db.prepare(`
      SELECT message_id, recipient, sent_at
      FROM sms_outbox
      WHERE status = 'sent'
      ORDER BY sent_at DESC
      LIMIT 1
    `).first();
  const lastReceived = await db.prepare(`
      SELECT message_id, sender, received_at
      FROM sms_inbox
      ORDER BY received_at DESC
      LIMIT 1
    `).first();
  return {
    outbox: {
      total: outboxStats?.total || 0,
      pending: outboxStats?.pending || 0,
      sent: outboxStats?.sent || 0,
      failed: outboxStats?.failed || 0,
      retry: outboxStats?.retry || 0
    },
    inbox: {
      total: inboxStats?.total || 0,
      processed: inboxStats?.processed || 0,
      unprocessed: inboxStats?.unprocessed || 0
    },
    logs: {
      total: logStats?.total || 0,
      outbound: logStats?.outbound || 0,
      inbound: logStats?.inbound || 0,
      success: logStats?.success || 0,
      failed: logStats?.failed || 0
    },
    last_sent: lastSent || null,
    last_received: lastReceived || null
  };
}
async function sendSmsWithTemplate(env, data) {
  const {
    eventType,
    recipient,
    data: templateData,
    sender = "",
    referenceId = null,
    referenceType = null,
    createdByUserId = null
  } = data;
  if (!eventType || !recipient) {
    throw new Error("eventType \u0648 recipient \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F.");
  }
  const result = await getAndRenderSmsTemplate(env, eventType, templateData);
  if (!result.template) {
    return {
      success: false,
      error: `Template \u0628\u0631\u0627\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F ${eventType} \u06CC\u0627\u0641\u062A \u0646\u0634\u062F`
    };
  }
  if (!result.isEnabled) {
    return {
      success: false,
      error: `Template \u0628\u0631\u0627\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F ${eventType} \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A`,
      template: result.template
    };
  }
  const sendResult = await addSmsToOutbox(env, {
    recipient,
    message: result.rendered,
    sender,
    priority: 0,
    eventType,
    referenceId,
    referenceType,
    createdByUserId
  });
  return {
    success: sendResult.success,
    messageId: sendResult.messageId,
    template: result.template,
    rendered: result.rendered
  };
}
async function sendSms(env, data) {
  const settings = await getSmsSettings(env);
  if (!settings.is_enabled) {
    return {
      success: false,
      error: "\u0633\u06CC\u0633\u062A\u0645 SMS \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A."
    };
  }
  if (data.eventType && !data.message) {
    return sendSmsWithTemplate(env, {
      eventType: data.eventType,
      recipient: data.recipient,
      data: data.templateData || {},
      sender: data.sender || "",
      referenceId: data.referenceId || null,
      referenceType: data.referenceType || null,
      createdByUserId: data.createdByUserId || null
    });
  }
  return addSmsToOutbox(env, data);
}
var init_sms = __esm({
  "lib/sms.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_db();
    __name(generateMessageId, "generateMessageId");
    __name(normalizePhoneNumber, "normalizePhoneNumber");
    __name(getPersianOrderStatus, "getPersianOrderStatus");
    __name(getPersianPaymentStatus, "getPersianPaymentStatus");
    __name(formatPersianAmount, "formatPersianAmount");
    __name(getSmsTemplate, "getSmsTemplate");
    __name(getAllSmsTemplates, "getAllSmsTemplates");
    __name(saveSmsTemplate, "saveSmsTemplate");
    __name(toggleSmsTemplate, "toggleSmsTemplate");
    __name(renderSmsTemplate, "renderSmsTemplate");
    __name(getAndRenderSmsTemplate, "getAndRenderSmsTemplate");
    __name(getSmsSettings, "getSmsSettings");
    __name(saveSmsSettings, "saveSmsSettings");
    __name(addSmsToOutbox, "addSmsToOutbox");
    __name(getIncomingSms, "getIncomingSms");
    __name(logGatewayActivity, "logGatewayActivity");
    __name(getGatewayLogs, "getGatewayLogs");
    __name(getSmsStats, "getSmsStats");
    __name(sendSmsWithTemplate, "sendSmsWithTemplate");
    __name(sendSms, "sendSms");
  }
});

// lib/notification.js
var notification_exports = {};
__export(notification_exports, {
  getChannelSettings: () => getChannelSettings,
  getNotificationLogs: () => getNotificationLogs,
  getNotificationStats: () => getNotificationStats,
  getSiteBaseUrl: () => getSiteBaseUrl,
  getUserNotificationPreferences: () => getUserNotificationPreferences2,
  hasDuplicateLog: () => hasDuplicateLog,
  logNotification: () => logNotification,
  saveChannelSettings: () => saveChannelSettings,
  sendCashbackAppliedNotification: () => sendCashbackAppliedNotification,
  sendNotificationToAdminAndUser: () => sendNotificationToAdminAndUser,
  sendOrderCancelledNotification: () => sendOrderCancelledNotification,
  sendOrderCreatedNotification: () => sendOrderCreatedNotification,
  sendOrderStatusChangedNotification: () => sendOrderStatusChangedNotification,
  sendPaymentStatusChangedNotification: () => sendPaymentStatusChangedNotification,
  sendPaymentSuccessNotification: () => sendPaymentSuccessNotification,
  sendRefundNotification: () => sendRefundNotification,
  sendSmsNotification: () => sendSmsNotification,
  sendTelegramNotification: () => sendTelegramNotification,
  sendUserOrderCancelledNotification: () => sendUserOrderCancelledNotification,
  sendUserOrderCreatedNotification: () => sendUserOrderCreatedNotification,
  sendUserOrderStatusChangedNotification: () => sendUserOrderStatusChangedNotification,
  sendUserOrderTrackingNotification: () => sendUserOrderTrackingNotification,
  sendUserPaymentSuccessNotification: () => sendUserPaymentSuccessNotification,
  sendUserSmsNotification: () => sendUserSmsNotification,
  sendUserTelegramNotification: () => sendUserTelegramNotification,
  sendWalletTopupNotification: () => sendWalletTopupNotification,
  sendWalletWithdrawalRequestNotification: () => sendWalletWithdrawalRequestNotification,
  sendWalletWithdrawalStatusNotification: () => sendWalletWithdrawalStatusNotification,
  testSmsNotification: () => testSmsNotification,
  testTelegramNotification: () => testTelegramNotification,
  toggleChannel: () => toggleChannel,
  updateLogStatus: () => updateLogStatus,
  updateUserNotificationPreferences: () => updateUserNotificationPreferences
});
async function getChannelSettings(env, channel) {
  const result = await env.DB.prepare(`
      SELECT 
        id,
        channel,
        is_enabled,
        config,
        updated_by_user_id,
        updated_at
      FROM notification_settings
      WHERE channel = ?
      LIMIT 1
    `).bind(channel).first();
  if (!result) return null;
  let config = {};
  try {
    if (result.config && typeof result.config === "string") {
      config = JSON.parse(result.config);
    } else if (result.config && typeof result.config === "object") {
      config = result.config;
    }
  } catch (_) {
    config = {};
  }
  return {
    id: result.id,
    channel: result.channel,
    is_enabled: result.is_enabled === 1,
    config,
    updated_by_user_id: result.updated_by_user_id,
    updated_at: result.updated_at
  };
}
async function saveChannelSettings(env, channel, config, userId) {
  const allowedChannels = ["telegram", "email", "sms"];
  if (!allowedChannels.includes(channel)) {
    throw new Error(`\u06A9\u0627\u0646\u0627\u0644 ${channel} \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.`);
  }
  if (channel === "telegram") {
    if (config.bot_token && config.bot_token.length < 20) {
      throw new Error("\u062A\u0648\u06A9\u0646 \u0631\u0628\u0627\u062A \u062A\u0644\u06AF\u0631\u0627\u0645 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
    }
    if (config.chat_id && !config.chat_id.trim()) {
      throw new Error("\u0634\u0646\u0627\u0633\u0647 \u0686\u062A \u062A\u0644\u06AF\u0631\u0627\u0645 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A.");
    }
  }
  const existing = await env.DB.prepare(`SELECT id FROM notification_settings WHERE channel = ?`).bind(channel).first();
  const configJson = JSON.stringify(config);
  if (existing) {
    await env.DB.prepare(`
        UPDATE notification_settings
        SET config = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE channel = ?
      `).bind(configJson, userId, channel).run();
  } else {
    await env.DB.prepare(`
        INSERT INTO notification_settings (channel, is_enabled, config, updated_by_user_id, created_at, updated_at)
        VALUES (?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(channel, configJson, userId).run();
  }
  return { success: true, channel, config };
}
async function toggleChannel(env, channel, enabled, userId) {
  const existing = await env.DB.prepare(`SELECT id FROM notification_settings WHERE channel = ?`).bind(channel).first();
  if (!existing) {
    throw new Error(`\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u06A9\u0627\u0646\u0627\u0644 ${channel} \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.`);
  }
  await env.DB.prepare(`
      UPDATE notification_settings
      SET is_enabled = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE channel = ?
    `).bind(enabled ? 1 : 0, userId, channel).run();
  return { success: true, channel, is_enabled: enabled };
}
async function logNotification(env, data) {
  const {
    eventType,
    channel,
    recipient,
    subject,
    content,
    status,
    errorMessage,
    orderId,
    userId,
    isUserNotification
  } = data;
  try {
    const result = await env.DB.prepare(`
        INSERT INTO notification_logs (
          event_type,
          channel,
          recipient,
          subject,
          content,
          status,
          error_message,
          order_id,
          user_id,
          is_user_notification,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
      eventType || "order_created",
      channel || "telegram",
      recipient || null,
      subject || null,
      content || null,
      status || "pending",
      errorMessage || null,
      orderId || null,
      userId || null,
      isUserNotification ? 1 : 0
    ).run();
    return result.meta?.last_row_id || null;
  } catch (error) {
    console.error("\u274C logNotification error:", error);
    console.error("\u{1F4CB} logNotification data:", { eventType, channel, recipient, orderId, userId, isUserNotification });
    return null;
  }
}
async function updateLogStatus(env, logId, status, errorMessage = null) {
  await env.DB.prepare(`
      UPDATE notification_logs
      SET 
        status = ?,
        error_message = COALESCE(?, error_message),
        sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END
      WHERE id = ?
    `).bind(status, errorMessage, status, logId).run();
  return true;
}
async function hasDuplicateLog(env, eventType, referenceId, channel = "telegram", hours = 1) {
  const result = await env.DB.prepare(`
      SELECT id
      FROM notification_logs
      WHERE event_type = ?
        AND channel = ?
        AND order_id = ?
        AND status = 'sent'
        AND created_at > datetime('now', '-' || ? || ' hours')
      LIMIT 1
    `).bind(eventType, channel, referenceId, hours).first();
  return !!result;
}
async function sendTelegramNotification(env, eventType, message, replyMarkup = null, referenceId = null, checkDuplicate = true) {
  const results = [];
  const telegramSettings = await getChannelSettings(env, "telegram");
  if (!telegramSettings || !telegramSettings.is_enabled) {
    results.push({
      channel: "telegram",
      success: false,
      error: "\u06A9\u0627\u0646\u0627\u0644 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A \u06CC\u0627 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F."
    });
    return { success: false, results };
  }
  const config = telegramSettings.config || {};
  const botToken = config.bot_token || env.TELEGRAM_BOT_TOKEN;
  const chatId = config.chat_id;
  if (!botToken || !chatId) {
    results.push({
      channel: "telegram",
      success: false,
      error: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u062A\u0644\u06AF\u0631\u0627\u0645 \u06A9\u0627\u0645\u0644 \u0646\u06CC\u0633\u062A (Bot Token \u06CC\u0627 Chat ID \u0645\u0648\u062C\u0648\u062F \u0646\u06CC\u0633\u062A)."
    });
    return { success: false, results };
  }
  if (checkDuplicate && referenceId) {
    const isDuplicate = await hasDuplicateLog(env, eventType, referenceId, "telegram", 1);
    if (isDuplicate) {
      results.push({
        channel: "telegram",
        success: false,
        error: "\u0627\u0639\u0644\u0627\u0646 \u062A\u06A9\u0631\u0627\u0631\u06CC \u062A\u0634\u062E\u06CC\u0635 \u062F\u0627\u062F\u0647 \u0634\u062F (\u062F\u0631 \u06CC\u06A9 \u0633\u0627\u0639\u062A \u06AF\u0630\u0634\u062A\u0647 \u0627\u0631\u0633\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A)."
      });
      return { success: false, results };
    }
  }
  const logId = await logNotification(env, {
    eventType,
    channel: "telegram",
    recipient: chatId,
    subject: message.substring(0, 100),
    content: message,
    status: "pending",
    orderId: referenceId
  });
  const sendResult = await sendTelegramMessage(botToken, chatId, message, { replyMarkup });
  if (sendResult.success) {
    await updateLogStatus(env, logId, "sent");
    results.push({
      channel: "telegram",
      success: true,
      message_id: sendResult.message_id,
      log_id: logId
    });
  } else {
    await updateLogStatus(env, logId, "failed", sendResult.error);
    results.push({
      channel: "telegram",
      success: false,
      error: sendResult.error,
      log_id: logId
    });
  }
  return { success: sendResult.success, results };
}
async function sendSmsNotification(env, eventType, recipient, templateData = {}, referenceId = null, checkDuplicate = true) {
  const smsSettings = await getSmsSettings(env);
  if (!smsSettings.is_enabled) {
    return {
      success: false,
      error: "\u06A9\u0627\u0646\u0627\u0644 SMS \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A."
    };
  }
  if (!recipient) {
    return {
      success: false,
      error: "\u0634\u0645\u0627\u0631\u0647 \u06AF\u06CC\u0631\u0646\u062F\u0647 \u0645\u0634\u062E\u0635 \u0646\u06CC\u0633\u062A."
    };
  }
  if (checkDuplicate && referenceId) {
    const isDuplicate = await hasDuplicateLog(env, eventType, referenceId, "sms", 1);
    if (isDuplicate) {
      return {
        success: false,
        error: "\u0627\u0639\u0644\u0627\u0646 \u062A\u06A9\u0631\u0627\u0631\u06CC \u062A\u0634\u062E\u06CC\u0635 \u062F\u0627\u062F\u0647 \u0634\u062F (\u062F\u0631 \u06CC\u06A9 \u0633\u0627\u0639\u062A \u06AF\u0630\u0634\u062A\u0647 \u0627\u0631\u0633\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A)."
      };
    }
  }
  const sendResult = await sendSmsWithTemplate(env, {
    eventType,
    recipient,
    data: templateData,
    referenceId,
    referenceType: "order",
    createdByUserId: null
  });
  if (sendResult.success) {
    return {
      success: true,
      message_id: sendResult.messageId,
      rendered: sendResult.rendered,
      template: sendResult.template
    };
  } else {
    return {
      success: false,
      error: sendResult.error || "\u0627\u0631\u0633\u0627\u0644 SMS \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F."
    };
  }
}
async function sendOrderCreatedNotification(env, orderData, userData, items, baseUrl = "") {
  const message = buildOrderCreatedMessage(orderData, userData, items);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, baseUrl);
  const telegramResult = await sendTelegramNotification(
    env,
    "order_created",
    message,
    replyMarkup,
    orderData.orderId,
    true
  );
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_created_admin && smsSettings.admin_phone) {
    const templateData = {
      customer_name: userData.fullName || "",
      customer_phone: userData.phone || "",
      order_number: orderData.orderNumber || "",
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || "pending",
      order_status: orderData.status || "pending",
      tracking_code: orderData.trackingCode || "",
      admin_note: "\u0644\u0637\u0641\u0627\u064B \u0633\u0641\u0627\u0631\u0634 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646\u06CC\u062F"
      // متغیر اختصاصی برای ادمین
    };
    smsResult = await sendSmsNotification(
      env,
      "admin_order_created",
      // ⭐ رویداد مجزا برای ادمین
      smsSettings.admin_phone,
      templateData,
      orderData.orderId,
      false
    );
  }
  return {
    success: telegramResult.success || smsResult && smsResult.success,
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult
    }
  };
}
async function sendPaymentSuccessNotification(env, orderData, userData, paymentMethod = "") {
  const message = buildPaymentSuccessMessage(orderData, userData, paymentMethod);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, "");
  const telegramResult = await sendTelegramNotification(
    env,
    "payment_success",
    message,
    replyMarkup,
    orderData.orderId,
    true
  );
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_payment_success_admin && smsSettings.admin_phone) {
    const templateData = {
      customer_name: userData.fullName || "",
      customer_phone: userData.phone || "",
      order_number: orderData.orderNumber || "",
      amount: orderData.totalAmount || 0,
      payment_status: "paid",
      order_status: orderData.status || "pending",
      tracking_code: orderData.trackingCode || "",
      admin_note: "\u067E\u0631\u062F\u0627\u062E\u062A \u062A\u0623\u06CC\u06CC\u062F \u0634\u062F"
      // متغیر اختصاصی برای ادمین
    };
    smsResult = await sendSmsNotification(
      env,
      "admin_payment_success",
      // ⭐ رویداد مجزا برای ادمین
      smsSettings.admin_phone,
      templateData,
      orderData.orderId,
      true
    );
  }
  return {
    success: telegramResult.success || smsResult && smsResult.success,
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult
    }
  };
}
async function sendPaymentStatusChangedNotification(env, orderData, userData, oldStatus, newStatus) {
  const message = buildPaymentStatusChangedMessage(orderData, userData, oldStatus, newStatus);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, "");
  return sendTelegramNotification(
    env,
    "payment_status_changed",
    message,
    replyMarkup,
    orderData.orderId,
    true
  );
}
async function sendOrderStatusChangedNotification(env, orderData, userData, oldStatus, newStatus) {
  const message = buildOrderStatusChangedMessage(orderData, userData, oldStatus, newStatus);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, "");
  const telegramResult = await sendTelegramNotification(
    env,
    "order_status_changed",
    message,
    replyMarkup,
    orderData.orderId,
    false
  );
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_status_changed_user && smsSettings.admin_phone) {
    let eventType = newStatus || "order_processing";
    const templateData = {
      customer_name: userData.fullName || "",
      customer_phone: userData.phone || "",
      order_number: orderData.orderNumber || "",
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || "pending",
      order_status: newStatus || "pending",
      tracking_code: orderData.trackingCode || ""
    };
    smsResult = await sendSmsNotification(
      env,
      eventType,
      smsSettings.admin_phone,
      templateData,
      orderData.orderId,
      false
    );
  }
  return {
    success: telegramResult.success || smsResult && smsResult.success,
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult
    }
  };
}
async function sendOrderCancelledNotification(env, orderData, userData, refundAmount = 0) {
  const message = buildOrderCancelledMessage(orderData, userData, refundAmount);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, "");
  const telegramResult = await sendTelegramNotification(
    env,
    "order_cancelled",
    message,
    replyMarkup,
    orderData.orderId,
    false
  );
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_cancelled_user && smsSettings.admin_phone) {
    const templateData = {
      customer_name: userData.fullName || "",
      customer_phone: userData.phone || "",
      order_number: orderData.orderNumber || "",
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || "pending",
      order_status: "cancelled",
      tracking_code: orderData.trackingCode || ""
    };
    smsResult = await sendSmsNotification(
      env,
      "order_cancelled",
      smsSettings.admin_phone,
      templateData,
      orderData.orderId,
      false
    );
  }
  return {
    success: telegramResult.success || smsResult && smsResult.success,
    results: {
      telegram: telegramResult.results || [telegramResult],
      sms: smsResult
    }
  };
}
async function sendRefundNotification(env, orderData, userData, refundAmount, refundMethod = "") {
  const message = buildRefundMessage(orderData, userData, refundAmount, refundMethod);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, "");
  return sendTelegramNotification(
    env,
    "refund",
    message,
    replyMarkup,
    orderData.orderId,
    true
  );
}
async function sendWalletTopupNotification(env, userData, amount, paymentMethod = "", newBalance = 0) {
  const message = buildWalletTopupMessage(userData, amount, paymentMethod, newBalance);
  const replyMarkup = createUserViewButton(userData.id, "");
  return sendTelegramNotification(
    env,
    "wallet_topup",
    message,
    replyMarkup,
    userData.id,
    true
  );
}
async function sendWalletWithdrawalRequestNotification(env, userData, amount, destinationInfo = "", requestId = "") {
  const message = buildWalletWithdrawalRequestMessage(userData, amount, destinationInfo, requestId);
  const replyMarkup = createUserViewButton(userData.id, "");
  return sendTelegramNotification(
    env,
    "wallet_withdrawal_requested",
    message,
    replyMarkup,
    requestId || userData.id,
    true
  );
}
async function sendWalletWithdrawalStatusNotification(env, userData, amount, oldStatus, newStatus, requestId = "", reason = "") {
  const message = buildWalletWithdrawalStatusMessage(userData, amount, oldStatus, newStatus, requestId, reason);
  const replyMarkup = createUserViewButton(userData.id, "");
  return sendTelegramNotification(
    env,
    newStatus === "approved" ? "wallet_withdrawal_approved" : "wallet_withdrawal_rejected",
    message,
    replyMarkup,
    requestId || userData.id,
    true
  );
}
async function sendCashbackAppliedNotification(env, orderData, userData, cashbackAmount, newBalance = 0) {
  const message = buildCashbackAppliedMessage(orderData, userData, cashbackAmount, newBalance);
  const replyMarkup = createOrderViewButton(orderData.orderNumber, "");
  return sendTelegramNotification(
    env,
    "cashback_applied",
    message,
    replyMarkup,
    orderData.orderId,
    true
  );
}
async function testTelegramNotification(env, botToken, chatId, userId) {
  const logId = await logNotification(env, {
    eventType: "test",
    channel: "telegram",
    recipient: chatId,
    subject: "\u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u062A\u0644\u06AF\u0631\u0627\u0645",
    content: "\u0627\u06CC\u0646 \u06CC\u06A9 \u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0627\u0632 \u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0627\u0633\u062A.",
    status: "pending"
  });
  const testMessage = `\u{1F514} <b>\u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC</b>

\u2705 \u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u0631\u0628\u0627\u062A \u062A\u0644\u06AF\u0631\u0627\u0645 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0631\u0642\u0631\u0627\u0631 \u0634\u062F.

\u{1F550} \u0632\u0645\u0627\u0646: ${(/* @__PURE__ */ new Date()).toLocaleString("fa-IR")}

\u{1F4CC} \u0627\u06CC\u0646 \u067E\u06CC\u0627\u0645 \u0627\u0632 \u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A.`;
  const sendResult = await sendTelegramMessage(botToken, chatId, testMessage);
  if (sendResult.success) {
    await updateLogStatus(env, logId, "sent");
  } else {
    await updateLogStatus(env, logId, "failed", sendResult.error);
  }
  return {
    success: sendResult.success,
    log_id: logId,
    error: sendResult.error || null
  };
}
async function testSmsNotification(env, phoneNumber, userId, eventType = "order_created") {
  const logId = await logNotification(env, {
    eventType: "test",
    channel: "sms",
    recipient: phoneNumber,
    subject: "\u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC SMS",
    content: "\u0627\u06CC\u0646 \u06CC\u06A9 \u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0627\u0632 \u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0627\u0633\u062A.",
    status: "pending"
  });
  const template = await getSmsTemplate(env, eventType);
  let message = "\u{1F514} \u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC\n\n\u2705 \u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u0633\u06CC\u0633\u062A\u0645 SMS \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0631\u0642\u0631\u0627\u0631 \u0634\u062F.\n\n\u{1F4CC} \u0627\u06CC\u0646 \u067E\u06CC\u0627\u0645 \u0627\u0632 \u067E\u0646\u0644 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A.";
  if (template) {
    const testData = {
      customer_name: "\u06A9\u0627\u0631\u0628\u0631 \u062A\u0633\u062A",
      customer_phone: phoneNumber,
      order_number: "TT-20260819-TEST",
      amount: "100000",
      payment_status: "pending",
      order_status: "pending",
      tracking_code: "TEST-123456"
    };
    message = renderSmsTemplate(template.message_template, testData);
  }
  const sendResult = await sendSms(env, {
    recipient: phoneNumber,
    message,
    eventType,
    createdByUserId: userId
  });
  if (sendResult.success) {
    await updateLogStatus(env, logId, "sent");
  } else {
    await updateLogStatus(env, logId, "failed", sendResult.error);
  }
  return {
    success: sendResult.success,
    log_id: logId,
    error: sendResult.error || null
  };
}
async function getNotificationLogs(env, options = {}) {
  const {
    channel,
    eventType,
    status,
    userId,
    isUserNotification,
    limit = 50,
    offset = 0
  } = options;
  let query = `
    SELECT 
      id,
      event_type,
      channel,
      recipient,
      subject,
      status,
      error_message,
      order_id,
      user_id,
      is_user_notification,
      created_at,
      sent_at
    FROM notification_logs
    WHERE 1=1
  `;
  const params = [];
  if (channel) {
    query += ` AND channel = ?`;
    params.push(channel);
  }
  if (eventType) {
    query += ` AND event_type = ?`;
    params.push(eventType);
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (userId) {
    query += ` AND user_id = ?`;
    params.push(userId);
  }
  if (isUserNotification !== void 0) {
    query += ` AND is_user_notification = ?`;
    params.push(isUserNotification ? 1 : 0);
  }
  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  const result = await env.DB.prepare(query).bind(...params).all();
  let countQuery = `
    SELECT COUNT(*) as total
    FROM notification_logs
    WHERE 1=1
  `;
  const countParams = [];
  if (channel) {
    countQuery += ` AND channel = ?`;
    countParams.push(channel);
  }
  if (eventType) {
    countQuery += ` AND event_type = ?`;
    countParams.push(eventType);
  }
  if (status) {
    countQuery += ` AND status = ?`;
    countParams.push(status);
  }
  if (userId) {
    countQuery += ` AND user_id = ?`;
    countParams.push(userId);
  }
  if (isUserNotification !== void 0) {
    countQuery += ` AND is_user_notification = ?`;
    countParams.push(isUserNotification ? 1 : 0);
  }
  const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
  const logs = Array.isArray(result?.results) ? result.results : [];
  return {
    logs,
    total: countResult?.total || 0,
    limit,
    offset
  };
}
async function getNotificationStats(env) {
  const totalResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM notification_logs`).first();
  const statusResult = await env.DB.prepare(`SELECT status, COUNT(*) as count FROM notification_logs GROUP BY status`).all();
  const statusCounts = {};
  if (Array.isArray(statusResult?.results)) {
    for (const row of statusResult.results) {
      statusCounts[row.status] = row.count;
    }
  }
  const channelResult = await env.DB.prepare(`SELECT channel, COUNT(*) as count FROM notification_logs GROUP BY channel`).all();
  const channelCounts = {};
  if (Array.isArray(channelResult?.results)) {
    for (const row of channelResult.results) {
      channelCounts[row.channel] = row.count;
    }
  }
  const lastSentResult = await env.DB.prepare(`
      SELECT id, event_type, channel, recipient, created_at, sent_at
      FROM notification_logs
      WHERE status = 'sent'
      ORDER BY sent_at DESC
      LIMIT 1
    `).first();
  return {
    total: totalResult?.total || 0,
    status_counts: statusCounts,
    channel_counts: channelCounts,
    last_sent: lastSentResult || null
  };
}
async function sendUserTelegramNotification(env, userId, eventType, message, replyMarkup = null, orderId = null, checkDuplicate = true) {
  const user = await env.DB.prepare(`SELECT id, full_name, email, phone FROM users WHERE id = ?`).bind(userId).first();
  if (!user) {
    return { success: false, error: "\u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." };
  }
  const connection = await env.DB.prepare(`SELECT chat_id, is_active FROM user_telegram_connections WHERE user_id = ? AND is_active = 1`).bind(userId).first();
  if (!connection) {
    return { success: false, error: "\u06A9\u0627\u0631\u0628\u0631 \u0628\u0647 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A." };
  }
  const telegramSettings = await getChannelSettings(env, "telegram");
  if (!telegramSettings || !telegramSettings.is_enabled) {
    return { success: false, error: "\u06A9\u0627\u0646\u0627\u0644 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A." };
  }
  const config = telegramSettings.config || {};
  const botToken = config.bot_token || env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { success: false, error: "\u062A\u0648\u06A9\u0646 \u0631\u0628\u0627\u062A \u062A\u0644\u06AF\u0631\u0627\u0645 \u062A\u0646\u0638\u06CC\u0645 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." };
  }
  const prefs = await getUserNotificationPreferences2(env, userId);
  if (prefs && prefs[eventType] === 0) {
    return { success: false, error: "\u0627\u06CC\u0646 \u0646\u0648\u0639 \u0627\u0639\u0644\u0627\u0646 \u062A\u0648\u0633\u0637 \u06A9\u0627\u0631\u0628\u0631 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A." };
  }
  if (checkDuplicate && orderId) {
    const isDuplicate = await hasDuplicateLog(env, eventType, orderId, "telegram", 1);
    if (isDuplicate) {
      return { success: false, error: "\u0627\u0639\u0644\u0627\u0646 \u062A\u06A9\u0631\u0627\u0631\u06CC \u062A\u0634\u062E\u06CC\u0635 \u062F\u0627\u062F\u0647 \u0634\u062F." };
    }
  }
  const logId = await logNotification(env, {
    eventType,
    channel: "telegram",
    recipient: connection.chat_id,
    subject: message.substring(0, 100),
    content: message,
    status: "pending",
    orderId,
    userId,
    isUserNotification: true
  });
  const sendResult = await sendTelegramMessage(botToken, connection.chat_id, message, { replyMarkup });
  if (sendResult.success) {
    await updateLogStatus(env, logId, "sent");
    await env.DB.prepare(`UPDATE user_telegram_connections SET last_used_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(userId).run();
  } else {
    await updateLogStatus(env, logId, "failed", sendResult.error);
  }
  return {
    success: sendResult.success,
    log_id: logId,
    error: sendResult.error || null
  };
}
async function sendUserSmsNotification(env, userId, eventType, templateData = {}, orderId = null, checkDuplicate = true) {
  try {
    console.log(`\u{1F4F1} sendUserSmsNotification - \u0634\u0631\u0648\u0639: userId=${userId}, eventType=${eventType}, orderId=${orderId}`);
    const user = await env.DB.prepare(`SELECT id, full_name, email, phone FROM users WHERE id = ?`).bind(userId).first();
    if (!user) {
      console.log(`\u274C sendUserSmsNotification - \u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F: userId=${userId}`);
      return { success: false, error: "\u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." };
    }
    console.log(`\u{1F4F1} sendUserSmsNotification - user: id=${user.id}, phone=${user.phone}, full_name=${user.full_name}`);
    if (!user.phone) {
      console.log(`\u274C sendUserSmsNotification - \u06A9\u0627\u0631\u0628\u0631 \u0634\u0645\u0627\u0631\u0647 \u062A\u0644\u0641\u0646 \u0646\u062F\u0627\u0631\u062F: userId=${userId}`);
      return { success: false, error: "\u06A9\u0627\u0631\u0628\u0631 \u0634\u0645\u0627\u0631\u0647 \u062A\u0644\u0641\u0646 \u0646\u062F\u0627\u0631\u062F." };
    }
    const smsSettings = await getSmsSettings(env);
    console.log(`\u{1F4F1} sendUserSmsNotification - smsSettings: is_enabled=${smsSettings.is_enabled}`);
    if (!smsSettings.is_enabled) {
      console.log(`\u274C sendUserSmsNotification - \u06A9\u0627\u0646\u0627\u0644 SMS \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A`);
      return { success: false, error: "\u06A9\u0627\u0646\u0627\u0644 SMS \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A." };
    }
    const prefs = await getUserNotificationPreferences2(env, userId);
    console.log(`\u{1F4F1} sendUserSmsNotification - prefs:`, prefs);
    if (prefs && prefs[eventType] === 0) {
      console.log(`\u274C sendUserSmsNotification - \u06A9\u0627\u0631\u0628\u0631 \u0627\u06CC\u0646 \u0646\u0648\u0639 \u0627\u0639\u0644\u0627\u0646 \u0631\u0627 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u06A9\u0631\u062F\u0647: eventType=${eventType}`);
      return { success: false, error: "\u0627\u06CC\u0646 \u0646\u0648\u0639 \u0627\u0639\u0644\u0627\u0646 \u062A\u0648\u0633\u0637 \u06A9\u0627\u0631\u0628\u0631 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A." };
    }
    if (checkDuplicate && orderId) {
      const isDuplicate = await hasDuplicateLog(env, eventType, orderId, "sms", 1);
      if (isDuplicate) {
        console.log(`\u274C sendUserSmsNotification - \u0627\u0639\u0644\u0627\u0646 \u062A\u06A9\u0631\u0627\u0631\u06CC \u062A\u0634\u062E\u06CC\u0635 \u062F\u0627\u062F\u0647 \u0634\u062F: orderId=${orderId}`);
        return { success: false, error: "\u0627\u0639\u0644\u0627\u0646 \u062A\u06A9\u0631\u0627\u0631\u06CC \u062A\u0634\u062E\u06CC\u0635 \u062F\u0627\u062F\u0647 \u0634\u062F." };
      }
    }
    console.log(`\u{1F4F1} sendUserSmsNotification - \u062F\u0631 \u062D\u0627\u0644 \u0627\u0631\u0633\u0627\u0644 SMS \u0628\u0627 Template...`);
    const sendResult = await sendSmsWithTemplate(env, {
      eventType,
      recipient: user.phone,
      data: templateData,
      referenceId: orderId,
      referenceType: "order",
      createdByUserId: userId
    });
    console.log(`\u{1F4F1} sendUserSmsNotification - sendResult: success=${sendResult.success}, messageId=${sendResult.messageId}`);
    if (sendResult.success) {
      return {
        success: true,
        message_id: sendResult.messageId,
        rendered: sendResult.rendered,
        template: sendResult.template
      };
    } else {
      return {
        success: false,
        error: sendResult.error || "\u0627\u0631\u0633\u0627\u0644 SMS \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F."
      };
    }
  } catch (error) {
    console.error("\u274C sendUserSmsNotification - \u062E\u0637\u0627\u06CC \u063A\u06CC\u0631\u0645\u0646\u062A\u0638\u0631\u0647:", error);
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}
async function getUserNotificationPreferences2(env, userId) {
  const result = await env.DB.prepare(`SELECT * FROM user_notification_preferences WHERE user_id = ?`).bind(userId).first();
  if (!result) return null;
  const prefs = {};
  const fields = [
    "order_created",
    "payment_success",
    "payment_failed",
    "order_status_changed",
    "order_preparing",
    "order_shipped",
    "tracking_code_added",
    "order_completed",
    "order_cancelled",
    "announcements",
    "promotions",
    "marketing"
  ];
  for (const field of fields) {
    prefs[field] = result[field] === 1;
  }
  return prefs;
}
async function updateUserNotificationPreferences(env, userId, preferences) {
  const fields = [
    "order_created",
    "payment_success",
    "payment_failed",
    "order_status_changed",
    "order_preparing",
    "order_shipped",
    "tracking_code_added",
    "order_completed",
    "order_cancelled",
    "announcements",
    "promotions",
    "marketing"
  ];
  const updates = [];
  const values = [];
  for (const field of fields) {
    if (preferences[field] !== void 0) {
      updates.push(`${field} = ?`);
      values.push(preferences[field] ? 1 : 0);
    }
  }
  if (updates.length === 0) {
    throw new Error("\u0647\u06CC\u0686 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A\u06CC \u0628\u0631\u0627\u06CC \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");
  }
  const existing = await env.DB.prepare(`SELECT id FROM user_notification_preferences WHERE user_id = ?`).bind(userId).first();
  if (existing) {
    values.push(userId);
    const query = `
      UPDATE user_notification_preferences
      SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;
    await env.DB.prepare(query).bind(...values).run();
  } else {
    const insertFields = ["user_id", ...fields];
    const placeholders = insertFields.map(() => "?").join(", ");
    const insertValues = [userId];
    for (const field of fields) {
      const val = preferences[field] !== void 0 ? preferences[field] : 1;
      insertValues.push(val ? 1 : 0);
    }
    const query = `
      INSERT INTO user_notification_preferences (${insertFields.join(", ")})
      VALUES (${placeholders})
    `;
    await env.DB.prepare(query).bind(...insertValues).run();
  }
  return { success: true };
}
async function sendUserOrderCreatedNotification(env, orderData, userData, items, baseUrl = "") {
  console.log("\u{1F4F1} sendUserOrderCreatedNotification - \u0634\u0631\u0648\u0639:", {
    orderId: orderData.orderId,
    userId: userData.id,
    userPhone: userData.phone,
    hasItems: Array.isArray(items) ? items.length : 0
  });
  const message = buildUserOrderCreatedMessage(orderData, userData, items);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    "order_created",
    message,
    replyMarkup,
    orderData.orderId,
    false
  );
  const smsSettings = await getSmsSettings(env);
  console.log("\u{1F4F1} sendUserOrderCreatedNotification - smsSettings:", {
    is_enabled: smsSettings.is_enabled,
    event_order_created_user: smsSettings.event_order_created_user
  });
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_created_user) {
    const templateData = {
      customer_name: userData.fullName || "",
      customer_phone: userData.phone || "",
      order_number: orderData.orderNumber || "",
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || "pending",
      order_status: orderData.status || "pending",
      tracking_code: orderData.trackingCode || ""
    };
    smsResult = await sendUserSmsNotification(
      env,
      userData.id,
      "order_created",
      templateData,
      orderData.orderId,
      false
    );
    console.log("\u{1F4F1} sendUserOrderCreatedNotification - smsResult:", smsResult);
  }
  return {
    success: telegramResult.success || smsResult && smsResult.success,
    results: {
      telegram: telegramResult,
      sms: smsResult
    }
  };
}
async function sendUserPaymentSuccessNotification(env, orderData, userData, paymentMethod = "", baseUrl = "") {
  const message = buildUserPaymentSuccessMessage(orderData, userData, paymentMethod);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    "payment_success",
    message,
    replyMarkup,
    orderData.orderId,
    true
  );
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_payment_success_user) {
    const templateData = {
      customer_name: userData.fullName || "",
      customer_phone: userData.phone || "",
      order_number: orderData.orderNumber || "",
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || "pending",
      order_status: orderData.status || "pending",
      tracking_code: orderData.trackingCode || ""
    };
    smsResult = await sendUserSmsNotification(
      env,
      userData.id,
      "payment_success",
      templateData,
      orderData.orderId,
      true
    );
  }
  return {
    success: telegramResult.success || smsResult && smsResult.success,
    results: {
      telegram: telegramResult,
      sms: smsResult
    }
  };
}
async function sendUserOrderStatusChangedNotification(env, orderData, userData, oldStatus, newStatus, trackingCode = "", baseUrl = "") {
  const statusEventMap = {
    "order_created": "order_created",
    "payment_pending": "payment_pending",
    "payment_success": "payment_success",
    "payment_failed": "payment_failed",
    "payment_review": "payment_review",
    "order_confirmed": "order_confirmed",
    "processing": "processing",
    "ready_to_ship": "ready_to_ship",
    "courier_delivery": "courier_delivery",
    "bus_shipping": "bus_shipping",
    "shipped": "shipped",
    "delivered": "delivered",
    "completed": "completed",
    "cancelled": "cancelled",
    "returned": "returned",
    "processing_failed": "processing_failed"
  };
  let eventType = statusEventMap[newStatus] || "order_processing";
  const message = buildUserOrderStatusChangedMessage(orderData, userData, oldStatus, newStatus, trackingCode);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    "order_status_changed",
    message,
    replyMarkup,
    orderData.orderId,
    false
  );
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_status_changed_user) {
    const templateData = {
      customer_name: userData.fullName || "",
      customer_phone: userData.phone || "",
      order_number: orderData.orderNumber || "",
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || "pending",
      order_status: newStatus || "pending",
      tracking_code: trackingCode || ""
    };
    smsResult = await sendUserSmsNotification(
      env,
      userData.id,
      eventType,
      templateData,
      orderData.orderId,
      false
    );
  }
  return {
    success: telegramResult.success || smsResult && smsResult.success,
    results: {
      telegram: telegramResult,
      sms: smsResult
    }
  };
}
async function sendUserOrderCancelledNotification(env, orderData, userData, refundAmount = 0, baseUrl = "") {
  const message = buildUserOrderCancelledMessage(orderData, userData, refundAmount);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  const telegramResult = await sendUserTelegramNotification(
    env,
    userData.id,
    "order_cancelled",
    message,
    replyMarkup,
    orderData.orderId,
    false
  );
  const smsSettings = await getSmsSettings(env);
  let smsResult = null;
  if (smsSettings.is_enabled && smsSettings.event_order_cancelled_user) {
    const templateData = {
      customer_name: userData.fullName || "",
      customer_phone: userData.phone || "",
      order_number: orderData.orderNumber || "",
      amount: orderData.totalAmount || 0,
      payment_status: orderData.paymentStatus || "pending",
      order_status: "cancelled",
      tracking_code: orderData.trackingCode || ""
    };
    smsResult = await sendUserSmsNotification(
      env,
      userData.id,
      "order_cancelled",
      templateData,
      orderData.orderId,
      false
    );
  }
  return {
    success: telegramResult.success || smsResult && smsResult.success,
    results: {
      telegram: telegramResult,
      sms: smsResult
    }
  };
}
async function sendUserOrderTrackingNotification(env, orderData, userData, items = [], baseUrl = "") {
  const message = buildUserOrderTrackingMessage(orderData, userData, items);
  const replyMarkup = createUserOrderTrackingButton(orderData.orderNumber, baseUrl);
  return sendUserTelegramNotification(
    env,
    userData.id,
    "order_tracking",
    message,
    replyMarkup,
    orderData.orderId,
    false
  );
}
async function sendNotificationToAdminAndUser(env, adminEventType, userEventType, orderData, userData, items, baseUrl = "", paymentMethod = "", trackingCode = "") {
  const results = {
    admin: null,
    user: null
  };
  if (adminEventType === "order_created") {
    results.admin = await sendOrderCreatedNotification(env, orderData, userData, items, baseUrl);
  } else if (adminEventType === "payment_success") {
    results.admin = await sendPaymentSuccessNotification(env, orderData, userData, paymentMethod);
  } else if (adminEventType === "order_status_changed") {
    results.admin = { success: false, error: "\u0646\u06CC\u0627\u0632 \u0628\u0647 \u067E\u0627\u0631\u0627\u0645\u062A\u0631\u0647\u0627\u06CC \u0628\u06CC\u0634\u062A\u0631 \u062F\u0627\u0631\u062F." };
  }
  if (userEventType === "order_created") {
    results.user = await sendUserOrderCreatedNotification(env, orderData, userData, items, baseUrl);
  } else if (userEventType === "payment_success") {
    results.user = await sendUserPaymentSuccessNotification(env, orderData, userData, paymentMethod, baseUrl);
  } else if (userEventType === "order_status_changed") {
    results.user = await sendUserOrderStatusChangedNotification(env, orderData, userData, null, null, trackingCode, baseUrl);
  } else if (userEventType === "order_tracking") {
    results.user = await sendUserOrderTrackingNotification(env, orderData, userData, items, baseUrl);
  }
  return results;
}
async function getSiteBaseUrl(env) {
  try {
    const result = await env.DB.prepare(`SELECT setting_value FROM app_settings WHERE setting_key = 'site_base_url'`).first();
    if (result && result.setting_value) {
      return result.setting_value;
    }
  } catch (_) {
  }
  return "https://takdaro-site.pages.dev";
}
var init_notification = __esm({
  "lib/notification.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_telegram();
    init_sms();
    __name(getChannelSettings, "getChannelSettings");
    __name(saveChannelSettings, "saveChannelSettings");
    __name(toggleChannel, "toggleChannel");
    __name(logNotification, "logNotification");
    __name(updateLogStatus, "updateLogStatus");
    __name(hasDuplicateLog, "hasDuplicateLog");
    __name(sendTelegramNotification, "sendTelegramNotification");
    __name(sendSmsNotification, "sendSmsNotification");
    __name(sendOrderCreatedNotification, "sendOrderCreatedNotification");
    __name(sendPaymentSuccessNotification, "sendPaymentSuccessNotification");
    __name(sendPaymentStatusChangedNotification, "sendPaymentStatusChangedNotification");
    __name(sendOrderStatusChangedNotification, "sendOrderStatusChangedNotification");
    __name(sendOrderCancelledNotification, "sendOrderCancelledNotification");
    __name(sendRefundNotification, "sendRefundNotification");
    __name(sendWalletTopupNotification, "sendWalletTopupNotification");
    __name(sendWalletWithdrawalRequestNotification, "sendWalletWithdrawalRequestNotification");
    __name(sendWalletWithdrawalStatusNotification, "sendWalletWithdrawalStatusNotification");
    __name(sendCashbackAppliedNotification, "sendCashbackAppliedNotification");
    __name(testTelegramNotification, "testTelegramNotification");
    __name(testSmsNotification, "testSmsNotification");
    __name(getNotificationLogs, "getNotificationLogs");
    __name(getNotificationStats, "getNotificationStats");
    __name(sendUserTelegramNotification, "sendUserTelegramNotification");
    __name(sendUserSmsNotification, "sendUserSmsNotification");
    __name(getUserNotificationPreferences2, "getUserNotificationPreferences");
    __name(updateUserNotificationPreferences, "updateUserNotificationPreferences");
    __name(sendUserOrderCreatedNotification, "sendUserOrderCreatedNotification");
    __name(sendUserPaymentSuccessNotification, "sendUserPaymentSuccessNotification");
    __name(sendUserOrderStatusChangedNotification, "sendUserOrderStatusChangedNotification");
    __name(sendUserOrderCancelledNotification, "sendUserOrderCancelledNotification");
    __name(sendUserOrderTrackingNotification, "sendUserOrderTrackingNotification");
    __name(sendNotificationToAdminAndUser, "sendNotificationToAdminAndUser");
    __name(getSiteBaseUrl, "getSiteBaseUrl");
  }
});

// api/account/telegram/track-order.js
function getCookie6(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json6(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestPost4(context) {
  try {
    const { env, request } = context;
    const cookieString = request.headers.get("cookie") || "";
    const sessionId = getCookie6(cookieString, "session_id");
    if (!sessionId) {
      return json6({ success: false, error: "unauthorized" }, 401);
    }
    const user = await getSessionUser(env, sessionId);
    if (!user) {
      return json6({ success: false, error: "unauthorized" }, 401);
    }
    const body = await request.json().catch(() => null);
    if (!body || !body.order_number) {
      return json6({
        success: false,
        error: "\u0634\u0645\u0627\u0631\u0647 \u0633\u0641\u0627\u0631\u0634 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."
      }, 400);
    }
    const orderNumber = String(body.order_number).trim();
    if (!orderNumber) {
      return json6({
        success: false,
        error: "\u0634\u0645\u0627\u0631\u0647 \u0633\u0641\u0627\u0631\u0634 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A."
      }, 400);
    }
    const order = await env.DB.prepare(`
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.payment_status,
          o.subtotal_amount,
          o.shipping_amount,
          o.total_amount,
          o.wallet_used_amount,
          o.payable_amount,
          o.cashback_amount,
          o.cashback_status,
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
      `).bind(user.id, orderNumber).first();
    if (!order) {
      return json6({
        success: false,
        error: "\u0633\u0641\u0627\u0631\u0634 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F."
      }, 404);
    }
    const itemsResult = await env.DB.prepare(`
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
      `).bind(order.id).all();
    const items = Array.isArray(itemsResult?.results) ? itemsResult.results.map((item) => ({
      id: Number(item.id || 0),
      product_id: item.product_id == null ? null : Number(item.product_id || 0),
      product_name: item.product_name || "",
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0)
    })) : [];
    const connection = await findTelegramConnectionByUserId(env, user.id);
    if (!connection) {
      return json6({
        success: false,
        error: "\u0634\u0645\u0627 \u0628\u0647 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A\u06CC\u062F. \u0644\u0637\u0641\u0627\u064B \u0627\u0628\u062A\u062F\u0627 \u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0628\u0631\u0642\u0631\u0627\u0631 \u06A9\u0646\u06CC\u062F."
      });
    }
    const orderData = {
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      subtotalAmount: Number(order.subtotal_amount || 0),
      shippingAmount: Number(order.shipping_amount || 0),
      totalAmount: Number(order.total_amount || 0),
      walletUsedAmount: Number(order.wallet_used_amount || 0),
      payableAmount: Number(order.payable_amount || 0),
      cashbackAmount: Number(order.cashback_amount || 0),
      cashbackStatus: order.cashback_status || "none",
      createdAt: order.created_at,
      updatedAt: order.updated_at
    };
    const userData = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone
    };
    const baseUrl = env.SITE_BASE_URL || "https://takdaro.com";
    const result = await sendUserOrderTrackingNotification(
      env,
      orderData,
      userData,
      items,
      baseUrl
    );
    await updateTelegramLastUsed(env, user.id);
    if (!result.success) {
      return json6({
        success: false,
        error: result.error || "\u0627\u0631\u0633\u0627\u0644 \u067E\u06CC\u0627\u0645 \u0628\u0627 \u062E\u0637\u0627 \u0645\u0648\u0627\u062C\u0647 \u0634\u062F."
      });
    }
    return json6({
      success: true,
      message: "\u067E\u06CC\u0627\u0645 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0633\u0641\u0627\u0631\u0634 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u0634\u062F.",
      log_id: result.log_id
    });
  } catch (error) {
    return json6(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_track_order = __esm({
  "api/account/telegram/track-order.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_db();
    init_db();
    init_db();
    init_notification();
    __name(getCookie6, "getCookie");
    __name(json6, "json");
    __name(onRequestPost4, "onRequestPost");
  }
});

// lib/admin.js
function json7(data, status = 200) {
  return Response.json(data, { status });
}
function getHeader(request, name) {
  return request.headers.get(name) || request.headers.get(name.toLowerCase()) || request.headers.get(name.toUpperCase()) || null;
}
function getCookie7(cookieString, key) {
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
  const sessionId = getCookie7(cookieString, "session_id");
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
      response: json7({ success: false, error: "unauthorized" }, 401)
    };
  }
  const role = String(user.role || "").toLowerCase();
  if (!["admin", "super_admin"].includes(role)) {
    return {
      ok: false,
      user,
      response: json7({ success: false, error: "forbidden" }, 403)
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
    init_functionsRoutes_0_42576649940160716();
    __name(json7, "json");
    __name(getHeader, "getHeader");
    __name(getCookie7, "getCookie");
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
    init_functionsRoutes_0_42576649940160716();
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
function json8(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestPost5(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const body = await context.request.json();
    const user_id = Number(body.user_id || 0);
    const password = String(body.password || "");
    const password_confirm = String(body.password_confirm || "");
    if (!user_id) {
      return json8({ success: false, error: "user_id required" }, 400);
    }
    if (!password || !password_confirm) {
      return json8({ success: false, error: "password and password_confirm required" }, 400);
    }
    if (password.length < 8) {
      return json8({ success: false, error: "password must be at least 8 characters" }, 400);
    }
    if (password !== password_confirm) {
      return json8({ success: false, error: "password confirmation does not match" }, 400);
    }
    const targetUser = await context.env.DB.prepare("SELECT id, role FROM users WHERE id = ?").bind(user_id).first();
    if (!targetUser) {
      return json8({ success: false, error: "user not found" }, 404);
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
    return json8({
      success: true,
      message: "password updated successfully"
    });
  } catch (error) {
    return json8(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_password2 = __esm({
  "api/admin/users/password.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    init_password();
    __name(json8, "json");
    __name(onRequestPost5, "onRequestPost");
  }
});

// api/account/addresses/[id].js
function getCookie8(cookieString, key) {
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
  const sessionId = getCookie8(request.headers.get("cookie"), "session_id");
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
function json9(data, status = 200) {
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
async function onRequestPut2(context) {
  try {
    const user = await getCurrentUser3(context.request, context.env);
    if (!user) {
      return json9({ success: false, error: "Unauthorized" }, 401);
    }
    const addressId = Number(context.params.id);
    if (!addressId) {
      return json9({ success: false, error: "\u0634\u0646\u0627\u0633\u0647 \u0622\u062F\u0631\u0633 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." }, 400);
    }
    const existing = await getOwnedAddress(context.env, user.id, addressId);
    if (!existing) {
      return json9({ success: false, error: "\u0622\u062F\u0631\u0633 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
    }
    const body = await context.request.json();
    const data = normalizeAddressInput(body);
    const validationError = validateAddressInput(data);
    if (validationError) {
      return json9({ success: false, error: validationError }, 400);
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
    return json9({
      success: true,
      address
    });
  } catch (error) {
    return json9(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
async function onRequestDelete(context) {
  try {
    const user = await getCurrentUser3(context.request, context.env);
    if (!user) {
      return json9({ success: false, error: "Unauthorized" }, 401);
    }
    const addressId = Number(context.params.id);
    if (!addressId) {
      return json9({ success: false, error: "\u0634\u0646\u0627\u0633\u0647 \u0622\u062F\u0631\u0633 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." }, 400);
    }
    const existing = await getOwnedAddress(context.env, user.id, addressId);
    if (!existing) {
      return json9({ success: false, error: "\u0622\u062F\u0631\u0633 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
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
    return json9({
      success: true
    });
  } catch (error) {
    return json9(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_id = __esm({
  "api/account/addresses/[id].js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(getCookie8, "getCookie");
    __name(normalizePhone, "normalizePhone");
    __name(getCurrentUser3, "getCurrentUser");
    __name(json9, "json");
    __name(normalizeAddressInput, "normalizeAddressInput");
    __name(validateAddressInput, "validateAddressInput");
    __name(getOwnedAddress, "getOwnedAddress");
    __name(onRequestPut2, "onRequestPut");
    __name(onRequestDelete, "onRequestDelete");
  }
});

// api/account/orders/[order].js
function getCookie9(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json10(data, status = 200) {
  return Response.json(data, { status });
}
async function getCurrentUserId(context) {
  const cookieString = context.request.headers.get("cookie") || "";
  const sessionId = getCookie9(cookieString, "session_id");
  if (!sessionId) return null;
  const session = await context.env.DB.prepare(`
      SELECT user_id
      FROM sessions
      WHERE id = ?
      LIMIT 1
    `).bind(sessionId).first();
  return session?.user_id ?? null;
}
async function onRequestGet3(context) {
  try {
    const userId = await getCurrentUserId(context);
    if (!userId) {
      return json10({ success: false, error: "unauthorized" }, 401);
    }
    const orderNumber = decodeURIComponent(String(context.params?.order || "")).trim();
    if (!orderNumber) {
      return json10({ success: false, error: "order_number_required" }, 400);
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
      return json10({ success: false, error: "order_not_found" }, 404);
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
    return json10({
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
    return json10(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_order = __esm({
  "api/account/orders/[order].js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(getCookie9, "getCookie");
    __name(json10, "json");
    __name(getCurrentUserId, "getCurrentUserId");
    __name(onRequestGet3, "onRequestGet");
  }
});

// api/admin/orders/[order].js
function getCookie10(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json11(data, status = 200) {
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
  const sessionId = getCookie10(cookieString, "session_id");
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
      a.address_line AS address_line,
      a.postal_code AS postal_code,
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
    ORDER BY id DESC
  `).bind(orderId).all();
  return Array.isArray(result?.results) ? result.results : [];
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
function getPaymentStatusForOrderStatus(status, currentPaymentStatus = "pending") {
  const statusMap = {
    // وضعیت‌های ابتدایی سفارش
    "order_created": "pending",
    "payment_pending": "pending",
    "payment_success": "paid",
    "payment_failed": "failed",
    "payment_review": "payment_review",
    // وضعیت‌های تأیید و پردازش
    "order_confirmed": "paid",
    "processing": "paid",
    "ready_to_ship": "paid",
    "courier_delivery": "paid",
    "bus_shipping": "paid",
    "shipped": "paid",
    "delivered": "paid",
    "completed": "paid",
    // وضعیت‌های خاص - payment_status را تغییر نمی‌دهیم
    "cancelled": currentPaymentStatus,
    "returned": currentPaymentStatus,
    "processing_failed": currentPaymentStatus
  };
  return statusMap[status] || "pending";
}
async function onRequestGet4(context) {
  try {
    const user = await getCurrentUser4(context);
    if (!user || !isAdmin(user)) {
      return json11({ success: false, error: "unauthorized" }, 401);
    }
    const orderNumber = decodeURIComponent(context.params.order || "").trim();
    if (!orderNumber) {
      return json11({ success: false, error: "order_number_required" }, 400);
    }
    const order = await getOrderByNumber(context.env.DB, orderNumber);
    if (!order) {
      return json11({ success: false, error: "order_not_found" }, 404);
    }
    const items = await getOrderItems(context.env.DB, order.id);
    const shippingAddress = order.address_id ? {
      full_name: order.address_full_name || "",
      address_line: order.address_line || "",
      postal_code: order.postal_code || "",
      phone: order.address_phone || "",
      city: order.address_city || "",
      state: order.address_state || ""
    } : null;
    return json11({
      success: true,
      order: {
        id: Number(order.id || 0),
        order_number: order.order_number || "",
        status: order.status || "order_created",
        payment_status: order.payment_status || "pending",
        subtotal_amount: Number(order.subtotal_amount || 0),
        shipping_amount: Number(order.shipping_amount || 0),
        total_amount: Number(order.total_amount || 0),
        wallet_used_amount: Number(order.wallet_used_amount || 0),
        payable_amount: Math.max(0, Number(order.total_amount || 0) - Number(order.wallet_used_amount || 0)),
        cashback_amount: Number(order.cashback_amount || 0),
        cashback_status: order.cashback_status || "none",
        notes: order.notes || "",
        created_at: order.created_at || null,
        updated_at: order.updated_at || null,
        full_name: order.full_name || "",
        email: order.email || "",
        phone: order.phone || "",
        items_count: items.length,
        items,
        shipping_address: shippingAddress,
        address: shippingAddress
      }
    });
  } catch (error) {
    return json11(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
async function onRequestPost6(context) {
  try {
    console.log("\u{1F525}\u{1F525}\u{1F525} onRequestPost \u0627\u062C\u0631\u0627 \u0634\u062F! \u062A\u0627\u0631\u06CC\u062E: 2026-08-21");
    const user = await getCurrentUser4(context);
    if (!user || !isAdmin(user)) {
      return json11({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json().catch(() => null);
    const orderNumber = normalizeText(
      context.params?.order || body?.order_number || ""
    );
    const nextStatus = normalizeText(body?.status).toLowerCase();
    console.log(`\u{1F4CA} \u0648\u0636\u0639\u06CC\u062A \u062F\u0631\u06CC\u0627\u0641\u062A\u06CC \u0627\u0632 \u067E\u0646\u0644: "${nextStatus}"`);
    if (!orderNumber) {
      return json11({ success: false, error: "order_number_required" }, 400);
    }
    if (nextStatus && !ALLOWED_UNIFIED_STATUSES.includes(nextStatus)) {
      return json11({
        success: false,
        error: "invalid_order_status",
        allowed: ALLOWED_UNIFIED_STATUSES
      }, 400);
    }
    const currentOrder = await getOrderByNumber(context.env.DB, orderNumber);
    if (!currentOrder) {
      return json11({ success: false, error: "order_not_found" }, 404);
    }
    const oldStatus = String(currentOrder.status || "order_created").toLowerCase();
    const oldPaymentStatus = String(currentOrder.payment_status || "pending").toLowerCase();
    const finalStatus = nextStatus || oldStatus;
    const finalPaymentStatus = getPaymentStatusForOrderStatus(finalStatus, oldPaymentStatus);
    console.log(`\u{1F4CA} \u0648\u0636\u0639\u06CC\u062A \u0646\u0647\u0627\u06CC\u06CC \u0633\u0641\u0627\u0631\u0634: "${finalStatus}"`);
    console.log(`\u{1F4CA} \u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A \u062A\u0639\u06CC\u06CC\u0646\u200C\u0634\u062F\u0647: "${finalPaymentStatus}"`);
    console.log(`\u{1F4CA} \u0648\u0636\u0639\u06CC\u062A \u0642\u0628\u0644\u06CC \u0633\u0641\u0627\u0631\u0634: "${oldStatus}"`);
    console.log(`\u{1F4CA} \u0648\u0636\u0639\u06CC\u062A \u0642\u0628\u0644\u06CC \u067E\u0631\u062F\u0627\u062E\u062A: "${oldPaymentStatus}"`);
    await context.env.DB.prepare(`
      UPDATE orders
      SET
        status = ?,
        payment_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(finalStatus, finalPaymentStatus, currentOrder.id).run();
    const updatedOrder = await getOrderByNumber(context.env.DB, orderNumber);
    let cashbackResult = null;
    if (finalStatus === "completed") {
      cashbackResult = await applyCashbackIfNeeded(context.env.DB, updatedOrder, user.id);
    } else if (ALLOWED_UNIFIED_STATUSES.filter((s) => s !== "completed").includes(finalStatus) && String(updatedOrder.cashback_status || "").toLowerCase() === "completed") {
      cashbackResult = await reverseCashbackIfNeeded(context.env.DB, updatedOrder, user.id);
    }
    const finalOrder = await getOrderByNumber(context.env.DB, orderNumber);
    const items = await getOrderItems(context.env.DB, finalOrder.id);
    const payableAmount = Math.max(
      0,
      normalizeNumber(finalOrder.total_amount) - normalizeNumber(finalOrder.wallet_used_amount)
    );
    let notificationResults = {
      admin: null,
      user: null,
      adminSuccess: false,
      userSuccess: false
    };
    try {
      let baseUrl = "";
      try {
        const urlResult = await context.env.DB.prepare(`SELECT setting_value FROM app_settings WHERE setting_key = 'site_base_url'`).first();
        if (urlResult) {
          baseUrl = urlResult.setting_value || "";
        }
      } catch (_) {
        baseUrl = "";
      }
      if (!baseUrl) {
        const requestUrl = new URL(context.request.url);
        baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
      }
      console.log(`\u{1F310} Base URL: ${baseUrl}`);
      const orderData = {
        orderId: finalOrder.id,
        orderNumber: finalOrder.order_number,
        totalAmount: normalizeNumber(finalOrder.total_amount),
        shippingAmount: normalizeNumber(finalOrder.shipping_amount),
        walletUsedAmount: normalizeNumber(finalOrder.wallet_used_amount),
        payableAmount,
        cashbackAmount: normalizeNumber(finalOrder.cashback_amount),
        status: finalStatus,
        paymentStatus: finalPaymentStatus,
        createdAt: finalOrder.created_at || (/* @__PURE__ */ new Date()).toISOString()
      };
      const userData = {
        id: finalOrder.user_id,
        fullName: finalOrder.full_name || "",
        email: finalOrder.email || "",
        phone: finalOrder.phone || ""
      };
      console.log(`\u{1F4E6} Order Data:`, JSON.stringify(orderData, null, 2));
      if (finalStatus !== oldStatus) {
        console.log(`\u2705 \u0648\u0636\u0639\u06CC\u062A \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A: ${oldStatus} \u2192 ${finalStatus}`);
        if (finalStatus === "cancelled") {
          console.log(`\u{1F504} \u0648\u0627\u0631\u062F \u0628\u062E\u0634 CANCELLED \u0634\u062F!`);
          let refundAmount = 0;
          if (finalPaymentStatus === "paid" || finalPaymentStatus === "completed") {
            refundAmount = payableAmount;
          }
          const { sendOrderCancelledNotification: sendOrderCancelledNotification2, sendUserOrderCancelledNotification: sendUserOrderCancelledNotification2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
          try {
            notificationResults.admin = await sendOrderCancelledNotification2(
              context.env,
              orderData,
              userData,
              refundAmount
            );
            if (notificationResults.admin && notificationResults.admin.success) {
              notificationResults.adminSuccess = true;
              console.log(`\u2705 \u0627\u0639\u0644\u0627\u0646 \u0644\u063A\u0648 \u0633\u0641\u0627\u0631\u0634 ${orderNumber} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647 \u0627\u062F\u0645\u06CC\u0646 \u0627\u0631\u0633\u0627\u0644 \u0634\u062F.`);
            } else {
              const errorMsg = notificationResults.admin?.error || "\u062E\u0637\u0627\u06CC \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647";
              notificationResults.adminSuccess = false;
              console.error(`\u274C \u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u0644\u063A\u0648 \u0633\u0641\u0627\u0631\u0634 ${orderNumber} \u0628\u0647 \u0627\u062F\u0645\u06CC\u0646:`, errorMsg);
            }
            notificationResults.user = await sendUserOrderCancelledNotification2(
              context.env,
              orderData,
              userData,
              refundAmount,
              baseUrl
            );
            if (notificationResults.user && notificationResults.user.success) {
              notificationResults.userSuccess = true;
              console.log(`\u2705 \u0627\u0639\u0644\u0627\u0646 \u0644\u063A\u0648 \u0633\u0641\u0627\u0631\u0634 ${orderNumber} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647 \u06A9\u0627\u0631\u0628\u0631 \u0627\u0631\u0633\u0627\u0644 \u0634\u062F.`);
            } else {
              notificationResults.userSuccess = false;
              if (notificationResults.user?.error) {
                console.warn(`\u26A0\uFE0F \u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u0644\u063A\u0648 \u0633\u0641\u0627\u0631\u0634 \u0628\u0647 \u06A9\u0627\u0631\u0628\u0631 ${orderNumber}:`, notificationResults.user.error);
              }
            }
          } catch (sendError) {
            notificationResults.adminSuccess = false;
            notificationResults.userSuccess = false;
            notificationResults.admin = { success: false, error: String(sendError.message || sendError) };
            console.error(`\u274C \u062E\u0637\u0627\u06CC \u063A\u06CC\u0631\u0645\u0646\u062A\u0638\u0631\u0647 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u0644\u063A\u0648 \u0633\u0641\u0627\u0631\u0634 ${orderNumber}:`, sendError);
          }
        } else {
          console.log(`\u{1F504} \u0648\u0627\u0631\u062F \u0628\u062E\u0634 OTHER \u0634\u062F! \u0648\u0636\u0639\u06CC\u062A: ${finalStatus}`);
          try {
            notificationResults.admin = await sendOrderStatusChangedNotification(
              context.env,
              orderData,
              userData,
              oldStatus,
              finalStatus
            );
            if (notificationResults.admin && notificationResults.admin.success) {
              notificationResults.adminSuccess = true;
              console.log(`\u2705 \u0627\u0639\u0644\u0627\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634 ${orderNumber} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u0634\u062F.`);
            } else {
              notificationResults.adminSuccess = false;
              console.error(`\u274C \u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634 ${orderNumber}:`, notificationResults.admin?.error);
            }
          } catch (sendError) {
            notificationResults.adminSuccess = false;
            notificationResults.admin = { success: false, error: String(sendError.message || sendError) };
            console.error(`\u274C \u062E\u0637\u0627\u06CC \u063A\u06CC\u0631\u0645\u0646\u062A\u0638\u0631\u0647 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634 ${orderNumber}:`, sendError);
          }
        }
      } else {
        console.log(`\u274C \u0648\u0636\u0639\u06CC\u062A \u062A\u063A\u06CC\u06CC\u0631 \u0646\u06A9\u0631\u062F\u0647 \u0627\u0633\u062A.`);
      }
      if (finalStatus !== oldStatus && finalStatus !== "cancelled") {
        try {
          notificationResults.user = await sendUserOrderStatusChangedNotification(
            context.env,
            orderData,
            userData,
            oldStatus,
            finalStatus,
            "",
            baseUrl
          );
          if (notificationResults.user && notificationResults.user.success) {
            notificationResults.userSuccess = true;
            console.log(`\u2705 \u0627\u0639\u0644\u0627\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634 ${orderNumber} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647 \u06A9\u0627\u0631\u0628\u0631 \u0627\u0631\u0633\u0627\u0644 \u0634\u062F.`);
          } else {
            notificationResults.userSuccess = false;
            if (notificationResults.user?.error) {
              console.warn(`\u26A0\uFE0F \u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u0628\u0647 \u06A9\u0627\u0631\u0628\u0631 \u0628\u0631\u0627\u06CC \u0633\u0641\u0627\u0631\u0634 ${orderNumber}:`, notificationResults.user.error);
            }
          }
        } catch (sendError) {
          notificationResults.userSuccess = false;
          notificationResults.user = { success: false, error: String(sendError.message || sendError) };
          console.error(`\u274C \u062E\u0637\u0627\u06CC \u063A\u06CC\u0631\u0645\u0646\u062A\u0638\u0631\u0647 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u0628\u0647 \u06A9\u0627\u0631\u0628\u0631 \u0628\u0631\u0627\u06CC \u0633\u0641\u0627\u0631\u0634 ${orderNumber}:`, sendError);
        }
      }
      if (finalStatus === "completed" && cashbackResult && cashbackResult.applied) {
        try {
          const { sendCashbackAppliedNotification: sendCashbackAppliedNotification2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
          const userWallet = await context.env.DB.prepare(`
            SELECT wallet_balance FROM users WHERE id = ?
          `).bind(finalOrder.user_id).first();
          const newBalance = userWallet?.wallet_balance || 0;
          const cashbackOrderData = {
            orderId: finalOrder.id,
            orderNumber: finalOrder.order_number,
            status: finalStatus,
            createdAt: finalOrder.created_at || (/* @__PURE__ */ new Date()).toISOString()
          };
          const cashbackUserData = {
            id: finalOrder.user_id,
            fullName: finalOrder.full_name || "",
            email: finalOrder.email || "",
            phone: finalOrder.phone || ""
          };
          const cashbackNotification = await sendCashbackAppliedNotification2(
            context.env,
            cashbackOrderData,
            cashbackUserData,
            cashbackResult.amount,
            newBalance
          );
          if (cashbackNotification && cashbackNotification.success) {
            console.log(`\u2705 \u0627\u0639\u0644\u0627\u0646 \u06A9\u0634\u200C\u0628\u06A9 \u0633\u0641\u0627\u0631\u0634 ${orderNumber} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647 \u06A9\u0627\u0631\u0628\u0631 \u0627\u0631\u0633\u0627\u0644 \u0634\u062F.`);
          } else {
            console.warn(`\u26A0\uFE0F \u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u06A9\u0634\u200C\u0628\u06A9 \u0633\u0641\u0627\u0631\u0634 ${orderNumber}:`, cashbackNotification?.error);
          }
        } catch (cashbackError) {
          console.error("\u274C \u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u06A9\u0634\u200C\u0628\u06A9:", cashbackError);
        }
      }
    } catch (notificationError) {
      console.error("\u274C \u062E\u0637\u0627\u06CC \u06A9\u0644\u06CC \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646:", notificationError);
      notificationResults.adminSuccess = false;
      notificationResults.userSuccess = false;
    }
    return json11({
      success: true,
      message: "order_updated",
      cashback_result: cashbackResult,
      notification_results: {
        admin_sent: notificationResults.adminSuccess,
        user_sent: notificationResults.userSuccess,
        admin_details: notificationResults.admin ? {
          success: notificationResults.admin.success || false,
          error: notificationResults.admin.error || null
        } : null,
        user_details: notificationResults.user ? {
          success: notificationResults.user.success || false,
          error: notificationResults.user.error || null
        } : null
      },
      order: {
        ...finalOrder,
        subtotal_amount: normalizeNumber(finalOrder.subtotal_amount),
        shipping_amount: normalizeNumber(finalOrder.shipping_amount),
        total_amount: normalizeNumber(finalOrder.total_amount),
        wallet_used_amount: normalizeNumber(finalOrder.wallet_used_amount),
        cashback_amount: normalizeNumber(finalOrder.cashback_amount),
        payable_amount: payableAmount,
        items
      }
    });
  } catch (error) {
    console.error("\u274C \u062E\u0637\u0627\u06CC \u06A9\u0644\u06CC \u062F\u0631 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0633\u0641\u0627\u0631\u0634:", error);
    return json11({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestDelete2(context) {
  try {
    const user = await getCurrentUser4(context);
    if (!user || !isAdmin(user)) {
      return json11({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json().catch(() => null);
    const orderNumber = normalizeText(body?.order_number);
    if (!orderNumber) {
      return json11({ success: false, error: "order_number_required" }, 400);
    }
    const order = await getOrderByNumber(context.env.DB, orderNumber);
    if (!order) {
      return json11({ success: false, error: "order_not_found" }, 404);
    }
    await context.env.DB.batch([
      context.env.DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(order.id),
      context.env.DB.prepare(`DELETE FROM orders WHERE id = ?`).bind(order.id)
    ]);
    return json11({ success: true, message: "order_deleted" });
  } catch (error) {
    return json11({ success: false, error: String(error?.message || error) }, 500);
  }
}
var ALLOWED_UNIFIED_STATUSES;
var init_order2 = __esm({
  "api/admin/orders/[order].js"() {
    init_functionsRoutes_0_42576649940160716();
    init_notification();
    __name(getCookie10, "getCookie");
    __name(json11, "json");
    __name(normalizeText, "normalizeText");
    __name(normalizeNumber, "normalizeNumber");
    __name(getCurrentUser4, "getCurrentUser");
    __name(isAdmin, "isAdmin");
    __name(getOrderByNumber, "getOrderByNumber");
    __name(getOrderItems, "getOrderItems");
    __name(hasCompletedCashbackTx, "hasCompletedCashbackTx");
    __name(hasCashbackReversalTx, "hasCashbackReversalTx");
    __name(applyCashbackIfNeeded, "applyCashbackIfNeeded");
    __name(reverseCashbackIfNeeded, "reverseCashbackIfNeeded");
    ALLOWED_UNIFIED_STATUSES = [
      "order_created",
      "payment_pending",
      "payment_success",
      "payment_failed",
      "payment_review",
      "order_confirmed",
      "processing",
      "ready_to_ship",
      "courier_delivery",
      "bus_shipping",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
      "returned",
      "processing_failed"
    ];
    __name(getPaymentStatusForOrderStatus, "getPaymentStatusForOrderStatus");
    __name(onRequestGet4, "onRequestGet");
    __name(onRequestPost6, "onRequestPost");
    __name(onRequestDelete2, "onRequestDelete");
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
    init_functionsRoutes_0_42576649940160716();
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

// api/admin/products/[id].js
function json12(data, status = 200) {
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
function formatNumber2(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
function productFromRow(row, images) {
  const primaryImage = row.primary_image || images.find((image) => image.is_primary === 1)?.image_url || images[0]?.image_url || "";
  let displayPrice = null;
  const priceType = row.price_type || "fixed";
  if (priceType === "rate_based") {
    if (row.calculated_price !== null && row.calculated_price !== void 0) {
      displayPrice = Number(row.calculated_price);
    } else if (row.base_price !== null && row.base_price !== void 0 && row.base_price > 0) {
      const rate = 196e3;
      displayPrice = Number(row.base_price) * rate;
    }
  } else {
    if (row.price !== null && row.price !== void 0) {
      displayPrice = Number(row.price);
    }
  }
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
    display_price_formatted: displayPrice !== null ? `${formatNumber2(displayPrice)} \u062A\u0648\u0645\u0627\u0646` : "\u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F"
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
async function onRequestGet5(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const productId = getProductId(context);
    if (!productId) {
      return json12({ success: false, error: "invalid_product_id" }, 400);
    }
    const product = await getProduct(context, productId);
    if (!product) {
      return json12({ success: false, error: "\u0645\u062D\u0635\u0648\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
    }
    return json12({ success: true, product });
  } catch (error) {
    return json12(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
async function onRequestPut3(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const productId = getProductId(context);
    if (!productId) {
      return json12({ success: false, error: "invalid_product_id" }, 400);
    }
    const currentProduct = await getProduct(context, productId);
    if (!currentProduct) {
      return json12({ success: false, error: "\u0645\u062D\u0635\u0648\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
    }
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json12({ success: false, error: "invalid_request_body" }, 400);
    }
    const name = cleanText(body.name ?? currentProduct.name, 250);
    const slug = cleanSlug(body.slug ?? currentProduct.slug);
    if (!name) {
      return json12({ success: false, error: "\u0646\u0627\u0645 \u0645\u062D\u0635\u0648\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." }, 400);
    }
    if (!slug) {
      return json12(
        {
          success: false,
          error: "slug \u0645\u062D\u0635\u0648\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A."
        },
        400
      );
    }
    const duplicateSlug = await context.env.DB.prepare("SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1").bind(slug, productId).first();
    if (duplicateSlug) {
      return json12(
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
    const priceType = body.price_type ?? body.priceType ?? currentProduct.price_type ?? "fixed";
    const basePrice = Object.prototype.hasOwnProperty.call(body, "base_price") || Object.prototype.hasOwnProperty.call(body, "basePrice") ? toOptionalPrice(body.base_price ?? body.basePrice) : currentProduct.base_price;
    const profitType = body.profit_type ?? body.profitType ?? currentProduct.profit_type ?? "none";
    const profitValue = Object.prototype.hasOwnProperty.call(body, "profit_value") || Object.prototype.hasOwnProperty.call(body, "profitValue") ? toOptionalPrice(body.profit_value ?? body.profitValue) : currentProduct.profit_value;
    const fixedFee = Object.prototype.hasOwnProperty.call(body, "fixed_fee") || Object.prototype.hasOwnProperty.call(body, "fixedFee") ? toOptionalPrice(body.fixed_fee ?? body.fixedFee) : currentProduct.fixed_fee;
    const roundingType = body.rounding_type ?? body.roundingType ?? currentProduct.rounding_type ?? "none";
    const roundingMethod = body.rounding_method ?? body.roundingMethod ?? currentProduct.rounding_method ?? "nearest";
    let calculatedPrice = null;
    if (priceType === "rate_based" && basePrice && basePrice > 0) {
      try {
        const rateResult = await context.env.DB.prepare(`
            SELECT rate FROM rates WHERE currency_code = 'USD' AND is_active = 1 LIMIT 1
          `).first();
        if (rateResult && rateResult.rate) {
          const tempProduct = {
            price_type: priceType,
            base_price: basePrice,
            profit_type: profitType,
            profit_value: profitValue,
            fixed_fee: fixedFee,
            rounding_type: roundingType,
            rounding_method: roundingMethod
          };
          const { calculateProductPrice: calculateProductPrice2 } = await Promise.resolve().then(() => (init_rate(), rate_exports));
          calculatedPrice = calculateProductPrice2(tempProduct, rateResult.rate);
        }
      } catch (_) {
        calculatedPrice = null;
      }
    } else if (priceType === "fixed") {
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
      priceType,
      basePrice || null,
      profitType,
      profitValue || null,
      fixedFee || null,
      roundingType,
      roundingMethod,
      calculatedPrice,
      calculatedPrice,
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
      description: `Updated product: ${name} (${slug}) - Price type: ${priceType}`
    });
    return json12({
      success: true,
      message: "\u0645\u062D\u0635\u0648\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.",
      product: updatedProduct
    });
  } catch (error) {
    return json12(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
async function onRequestDelete3(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const productId = getProductId(context);
    if (!productId) {
      return json12({ success: false, error: "invalid_product_id" }, 400);
    }
    const product = await getProduct(context, productId);
    if (!product) {
      return json12({ success: false, error: "\u0645\u062D\u0635\u0648\u0644 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F." }, 404);
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
    return json12({
      success: true,
      message: "\u0645\u062D\u0635\u0648\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F.",
      deleted_product: {
        id: productId,
        name: product.name,
        slug: product.slug
      }
    });
  } catch (error) {
    return json12(
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
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    __name(json12, "json");
    __name(cleanText, "cleanText");
    __name(cleanSlug, "cleanSlug");
    __name(toInteger, "toInteger");
    __name(toOptionalPrice, "toOptionalPrice");
    __name(toBooleanInteger, "toBooleanInteger");
    __name(normalizeStatus, "normalizeStatus");
    __name(normalizeImageUrl, "normalizeImageUrl");
    __name(normalizeImages, "normalizeImages");
    __name(formatNumber2, "formatNumber");
    __name(productFromRow, "productFromRow");
    __name(getProduct, "getProduct");
    __name(getProductId, "getProductId");
    __name(onRequestGet5, "onRequestGet");
    __name(onRequestPut3, "onRequestPut");
    __name(onRequestDelete3, "onRequestDelete");
  }
});

// api/account/addresses.js
function normalizePhone2(phone) {
  if (!phone) return null;
  return String(phone).trim().replace(/\s+/g, "");
}
function json13(data, status = 200) {
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
async function onRequestGet6(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) return json13({ success: false, error: "Unauthorized" }, 401);
    const result = await context.env.DB.prepare(`
      SELECT id, user_id, type, full_name, address_line, postal_code, phone, city, state, is_default, created_at, updated_at
      FROM addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, id DESC
    `).bind(user.id).all();
    return json13({ success: true, addresses: result.results || [] });
  } catch (error) {
    return json13({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPost7(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) return json13({ success: false, error: "Unauthorized" }, 401);
    const body = await context.request.json();
    const data = normalizeAddressInput2(body);
    const validationError = validateAddressInput2(data);
    if (validationError) {
      return json13({ success: false, error: validationError }, 400);
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
    return json13({ success: true, id: insertedId, address });
  } catch (error) {
    return json13({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPut4(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) return json13({ success: false, error: "Unauthorized" }, 401);
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();
    if (!id) {
      return json13({ success: false, error: "\u0622\u062F\u0631\u0633 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." }, 400);
    }
    const body = await context.request.json();
    const data = normalizeAddressInput2(body);
    const validationError = validateAddressInput2(data);
    if (validationError) {
      return json13({ success: false, error: validationError }, 400);
    }
    const existing = await context.env.DB.prepare(`
      SELECT id FROM addresses WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();
    if (!existing) {
      return json13({ success: false, error: "\u0622\u062F\u0631\u0633 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." }, 404);
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
    return json13({ success: true, address: updated });
  } catch (error) {
    return json13({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestDelete4(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) return json13({ success: false, error: "Unauthorized" }, 401);
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id") || url.pathname.split("/").pop();
    if (!id) {
      return json13({ success: false, error: "\u0622\u062F\u0631\u0633 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." }, 400);
    }
    const existing = await context.env.DB.prepare(`
      SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();
    if (!existing) {
      return json13({ success: false, error: "\u0622\u062F\u0631\u0633 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." }, 404);
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
    return json13({ success: true, message: "\u0622\u062F\u0631\u0633 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F." });
  } catch (error) {
    return json13({ success: false, error: String(error?.message || error) }, 500);
  }
}
var init_addresses = __esm({
  "api/account/addresses.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    __name(normalizePhone2, "normalizePhone");
    __name(json13, "json");
    __name(normalizeAddressInput2, "normalizeAddressInput");
    __name(validateAddressInput2, "validateAddressInput");
    __name(onRequestGet6, "onRequestGet");
    __name(onRequestPost7, "onRequestPost");
    __name(onRequestPut4, "onRequestPut");
    __name(onRequestDelete4, "onRequestDelete");
  }
});

// api/account/create-order.js
function json14(data, status = 200) {
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
async function onRequestPost8(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) {
      return json14({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json().catch(() => null);
    const validationError = validatePayload(body);
    if (validationError) {
      return json14({ success: false, error: validationError }, 400);
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
        rate_at_purchase: rateAtPurchase,
        currency_code: currencyCode
      };
    });
    const subtotalAmount = recalculatedSubtotal > 0 ? recalculatedSubtotal : submittedSubtotalAmount;
    const totalAmount = subtotalAmount + shippingAmount;
    if (submittedTotalAmount > 0 && totalAmount !== submittedTotalAmount) {
      return json14({ success: false, error: "total-mismatch" }, 400);
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
      return json14({ success: false, error: "order-create-failed" }, 500);
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
    context.waitUntil((async () => {
      try {
        let baseUrl = "";
        try {
          const urlResult = await context.env.DB.prepare(`SELECT setting_value FROM app_settings WHERE setting_key = 'site_base_url'`).first();
          if (urlResult) {
            baseUrl = urlResult.setting_value || "";
          }
        } catch (_) {
          baseUrl = "";
        }
        if (!baseUrl) {
          const requestUrl = new URL(context.request.url);
          baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
        }
        const orderData = {
          orderId,
          orderNumber,
          totalAmount,
          shippingAmount,
          walletUsedAmount,
          payableAmount,
          cashbackAmount,
          status: "pending",
          paymentStatus: "pending",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        const userData = {
          id: user.id,
          fullName: user.full_name || "",
          email: user.email || "",
          phone: user.phone || ""
        };
        console.log("\u{1F4F1} create-order: \u0634\u0631\u0648\u0639 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646\u200C\u0647\u0627 (\u067E\u0633\u200C\u0632\u0645\u06CC\u0646\u0647)");
        try {
          const userNotification = await sendUserOrderCreatedNotification(
            context.env,
            orderData,
            userData,
            normalizedItems,
            baseUrl
          );
          console.log("\u{1F4F1} create-order: userNotification:", userNotification);
        } catch (userError) {
          console.error("\u274C create-order: \u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u0628\u0647 \u06A9\u0627\u0631\u0628\u0631:", userError);
        }
        try {
          console.log("\u{1F4F1} create-order: \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u0628\u0647 \u0627\u062F\u0645\u06CC\u0646...");
          const adminNotification = await sendOrderCreatedNotification(
            context.env,
            orderData,
            userData,
            normalizedItems,
            baseUrl
          );
          console.log("\u{1F4F1} create-order: adminNotification:", adminNotification);
        } catch (adminError) {
          console.error("\u274C create-order: \u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u0628\u0647 \u0627\u062F\u0645\u06CC\u0646:", adminError);
        }
        console.log("\u{1F4F1} create-order: \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646\u200C\u0647\u0627 \u06A9\u0627\u0645\u0644 \u0634\u062F");
      } catch (notificationError) {
        console.error("\u274C create-order: \u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646:", notificationError);
      }
    })());
    return json14({
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
        rate_at_purchase: currentRate
      }
    });
  } catch (error) {
    return json14(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_create_order = __esm({
  "api/account/create-order.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    init_rate();
    init_notification();
    init_notification();
    __name(json14, "json");
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
    __name(onRequestPost8, "onRequestPost");
  }
});

// api/account/orders.js
function json15(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet7(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) {
      return json15({ success: false, error: "unauthorized" }, 401);
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
    return json15({
      success: true,
      orders: orders.results || []
    });
  } catch (error) {
    return json15(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_orders = __esm({
  "api/account/orders.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    __name(json15, "json");
    __name(onRequestGet7, "onRequestGet");
  }
});

// api/account/wallet.js
function getCookie11(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json16(data, status = 200) {
  return Response.json(data, { status });
}
async function getCurrentUser5(request, env) {
  const sessionId = getCookie11(request.headers.get("cookie") || "", "session_id");
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
async function onRequestGet8(context) {
  try {
    const user = await getCurrentUser5(context.request, context.env);
    if (!user) {
      return json16({ success: false, error: "unauthorized" }, 401);
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
    return json16({
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
    return json16(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_wallet = __esm({
  "api/account/wallet.js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(getCookie11, "getCookie");
    __name(json16, "json");
    __name(getCurrentUser5, "getCurrentUser");
    __name(normalizeStatuses2, "normalizeStatuses");
    __name(getWalletSettings, "getWalletSettings");
    __name(onRequestGet8, "onRequestGet");
  }
});

// api/admin/me.js
async function onRequestGet9(context) {
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
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    __name(onRequestGet9, "onRequestGet");
  }
});

// api/admin/notifications.js
function json17(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet10(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const url = new URL(context.request.url);
    const action = url.searchParams.get("action") || "settings";
    const channel = url.searchParams.get("channel") || "telegram";
    if (action === "sms_templates") {
      const templates = await getAllSmsTemplates(context.env);
      return json17({
        success: true,
        data: templates
      });
    }
    if (action === "sms_template") {
      const eventType = url.searchParams.get("eventType");
      if (!eventType) {
        return json17({ success: false, error: "eventType \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A." }, 400);
      }
      const template = await getSmsTemplate(context.env, eventType);
      return json17({
        success: true,
        data: template
      });
    }
    if (action === "sms_template_preview") {
      const eventType = url.searchParams.get("eventType");
      const template = await getSmsTemplate(context.env, eventType);
      if (!template) {
        return json17({ success: false, error: "Template \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." }, 404);
      }
      const sampleData = {
        customer_name: "\u06A9\u0627\u0631\u0628\u0631 \u062A\u0633\u062A",
        customer_phone: "09123456789",
        order_number: "TT-20260819-123456",
        amount: "2500000",
        payment_status: "pending",
        order_status: "pending",
        tracking_code: "TRK-12345678"
      };
      const rendered = renderSmsTemplate(template.message_template, sampleData);
      return json17({
        success: true,
        data: {
          template,
          rendered,
          sample_data: sampleData
        }
      });
    }
    if (action === "settings") {
      if (channel === "sms") {
        const settings2 = await getSmsSettings(context.env);
        return json17({
          success: true,
          channel: "sms",
          is_enabled: settings2.is_enabled,
          config: {
            admin_phone: settings2.admin_phone || "",
            gateway_url: settings2.gateway_url || "",
            polling_interval: settings2.polling_interval || 30,
            max_sms_per_minute: settings2.max_sms_per_minute || 10,
            retry_interval: settings2.retry_interval || 300,
            default_sender: settings2.default_sender || "",
            event_order_created_admin: settings2.event_order_created_admin,
            event_order_created_user: settings2.event_order_created_user,
            event_order_status_changed_user: settings2.event_order_status_changed_user,
            event_payment_success_admin: settings2.event_payment_success_admin,
            event_payment_success_user: settings2.event_payment_success_user,
            event_order_cancelled_user: settings2.event_order_cancelled_user
          },
          updated_at: settings2.updated_at
        });
      }
      const settings = await getChannelSettings(context.env, channel);
      if (!settings) {
        return json17({
          success: true,
          channel,
          is_enabled: false,
          config: getDefaultConfig(channel),
          message: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u06CC\u0627\u0641\u062A \u0646\u0634\u062F\u060C \u0627\u0632 \u0645\u0642\u0627\u062F\u06CC\u0631 \u067E\u06CC\u0634\u200C\u0641\u0631\u0636 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646\u06CC\u062F."
        });
      }
      const safeConfig = { ...settings.config };
      if (safeConfig.bot_token) {
        const token = safeConfig.bot_token;
        if (token.length > 10) {
          safeConfig.bot_token_display = token.substring(0, 6) + "..." + token.substring(token.length - 4);
        } else {
          safeConfig.bot_token_display = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
        }
      }
      return json17({
        success: true,
        channel,
        is_enabled: settings.is_enabled,
        config: safeConfig,
        has_token: !!settings.config?.bot_token,
        updated_at: settings.updated_at
      });
    }
    if (action === "logs") {
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);
      const status = url.searchParams.get("status") || null;
      const eventType = url.searchParams.get("event_type") || null;
      const channelFilter = url.searchParams.get("channel") || null;
      const result = await getNotificationLogs(context.env, {
        channel: channelFilter,
        eventType,
        status,
        limit,
        offset
      });
      return json17({
        success: true,
        ...result
      });
    }
    if (action === "stats") {
      const stats = await getNotificationStats(context.env);
      return json17({
        success: true,
        stats
      });
    }
    if (action === "sms_stats") {
      const stats = await getSmsStats(context.env);
      return json17({
        success: true,
        stats
      });
    }
    if (action === "gateway_logs") {
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);
      const direction = url.searchParams.get("direction") || null;
      const status = url.searchParams.get("status") || null;
      const result = await getGatewayLogs(context.env, {
        direction,
        status,
        limit,
        offset
      });
      return json17({
        success: true,
        ...result
      });
    }
    if (action === "sms_inbox") {
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);
      const sender = url.searchParams.get("sender") || null;
      const status = url.searchParams.get("status") || null;
      const processed = url.searchParams.get("processed") !== null ? url.searchParams.get("processed") === "true" : void 0;
      const result = await getIncomingSms(context.env, {
        sender,
        status,
        processed,
        limit,
        offset
      });
      return json17({
        success: true,
        ...result
      });
    }
    return json17({
      success: false,
      error: "action \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A."
    }, 400);
  } catch (error) {
    return json17({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
async function onRequestPost9(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json17({ success: false, error: "payload \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A." }, 400);
    }
    const action = body.action || "save_settings";
    const channel = body.channel || "telegram";
    const adminUser = adminCheck.user;
    if (action === "save_sms_template") {
      const { eventType, title, messageTemplate, isEnabled } = body;
      if (!eventType || !title || !messageTemplate) {
        return json17({
          success: false,
          error: "eventType, title \u0648 messageTemplate \u0627\u0644\u0632\u0627\u0645\u06CC \u0647\u0633\u062A\u0646\u062F."
        }, 400);
      }
      await saveSmsTemplate(context.env, {
        eventType,
        title,
        messageTemplate,
        isEnabled: isEnabled !== void 0 ? isEnabled : true
      });
      const template = await getSmsTemplate(context.env, eventType);
      return json17({
        success: true,
        message: "Template \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.",
        data: template
      });
    }
    if (action === "toggle_sms_template") {
      const { eventType, isEnabled } = body;
      if (!eventType) {
        return json17({
          success: false,
          error: "eventType \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."
        }, 400);
      }
      await toggleSmsTemplate(context.env, eventType, isEnabled);
      const template = await getSmsTemplate(context.env, eventType);
      return json17({
        success: true,
        message: `Template ${isEnabled ? "\u0641\u0639\u0627\u0644" : "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644"} \u0634\u062F.`,
        data: template
      });
    }
    if (action === "test_sms_template") {
      const { phoneNumber, eventType } = body;
      if (!phoneNumber) {
        return json17({
          success: false,
          error: "\u0634\u0645\u0627\u0631\u0647 \u062A\u0644\u0641\u0646 \u0628\u0631\u0627\u06CC \u0627\u0631\u0633\u0627\u0644 \u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0645\u0634\u062E\u0635 \u0646\u06CC\u0633\u062A."
        }, 400);
      }
      if (!eventType) {
        return json17({
          success: false,
          error: "eventType \u0628\u0631\u0627\u06CC Template \u0645\u0634\u062E\u0635 \u0646\u06CC\u0633\u062A."
        }, 400);
      }
      const testResult = await testSmsNotification(
        context.env,
        phoneNumber,
        adminUser.id,
        eventType
      );
      if (testResult.success) {
        return json17({
          success: true,
          message: "\u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC SMS \u0628\u0627 Template \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u0634\u062F.",
          log_id: testResult.log_id
        });
      } else {
        return json17({
          success: false,
          error: testResult.error || "\u0627\u0631\u0633\u0627\u0644 \u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC SMS \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F.",
          log_id: testResult.log_id
        }, 500);
      }
    }
    if (action === "save_settings") {
      if (channel === "sms") {
        const config2 = body.config || {};
        if (config2.admin_phone && !config2.admin_phone.trim()) {
          return json17({
            success: false,
            error: "\u0634\u0645\u0627\u0631\u0647 \u0627\u062F\u0645\u06CC\u0646 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A."
          }, 400);
        }
        await saveSmsSettings(context.env, {
          is_enabled: config2.is_enabled !== void 0 ? config2.is_enabled : false,
          admin_phone: config2.admin_phone || "",
          gateway_url: config2.gateway_url || "",
          polling_interval: config2.polling_interval || 30,
          max_sms_per_minute: config2.max_sms_per_minute || 10,
          retry_interval: config2.retry_interval || 300,
          default_sender: config2.default_sender || "",
          event_order_created_admin: config2.event_order_created_admin === true || config2.event_order_created_admin === 1,
          event_order_created_user: config2.event_order_created_user === true || config2.event_order_created_user === 1,
          event_order_status_changed_user: config2.event_order_status_changed_user === true || config2.event_order_status_changed_user === 1,
          event_payment_success_admin: config2.event_payment_success_admin === true || config2.event_payment_success_admin === 1,
          event_payment_success_user: config2.event_payment_success_user === true || config2.event_payment_success_user === 1,
          event_order_cancelled_user: config2.event_order_cancelled_user === true || config2.event_order_cancelled_user === 1
        }, adminUser.id);
        const updatedSettings = await getSmsSettings(context.env);
        return json17({
          success: true,
          message: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A SMS \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.",
          channel: "sms",
          settings: updatedSettings
        });
      }
      const config = body.config || {};
      if (channel === "telegram") {
        if (config.bot_token && config.bot_token.trim()) {
          if (config.bot_token.trim().length < 20) {
            return json17({
              success: false,
              error: "\u062A\u0648\u06A9\u0646 \u0631\u0628\u0627\u062A \u062A\u0644\u06AF\u0631\u0627\u0645 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A (\u062D\u062F\u0627\u0642\u0644 20 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631)."
            }, 400);
          }
        }
        if (!config.chat_id || !config.chat_id.trim()) {
          return json17({
            success: false,
            error: "\u0634\u0646\u0627\u0633\u0647 \u0686\u062A (Chat ID) \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."
          }, 400);
        }
      }
      const result = await saveChannelSettings(
        context.env,
        channel,
        config,
        adminUser.id
      );
      return json17({
        success: true,
        message: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.",
        channel,
        config: result.config
      });
    }
    if (action === "toggle") {
      const enabled = body.enabled === true;
      const result = await toggleChannel(
        context.env,
        channel,
        enabled,
        adminUser.id
      );
      return json17({
        success: true,
        message: `\u06A9\u0627\u0646\u0627\u0644 ${channel} ${enabled ? "\u0641\u0639\u0627\u0644" : "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644"} \u0634\u062F.`,
        channel,
        is_enabled: enabled
      });
    }
    if (action === "test_telegram") {
      let botToken = body.bot_token;
      let chatId = body.chat_id;
      if (!botToken || !chatId) {
        const settings = await getChannelSettings(context.env, "telegram");
        if (settings && settings.config) {
          botToken = botToken || settings.config.bot_token;
          chatId = chatId || settings.config.chat_id;
        }
      }
      if (!botToken || !chatId) {
        return json17({
          success: false,
          error: "\u062A\u0648\u06A9\u0646 \u0631\u0628\u0627\u062A \u0648 \u0634\u0646\u0627\u0633\u0647 \u0686\u062A \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A \u06CC\u0627 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F."
        }, 400);
      }
      const testResult = await testTelegramNotification(
        context.env,
        botToken,
        chatId,
        adminUser.id
      );
      if (testResult.success) {
        return json17({
          success: true,
          message: "\u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u0634\u062F.",
          log_id: testResult.log_id
        });
      } else {
        return json17({
          success: false,
          error: testResult.error || "\u0627\u0631\u0633\u0627\u0644 \u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F.",
          log_id: testResult.log_id
        }, 500);
      }
    }
    if (action === "test_sms") {
      const phoneNumber = body.phone_number || body.phone;
      let testPhone = phoneNumber;
      if (!testPhone) {
        const settings = await getSmsSettings(context.env);
        testPhone = settings.admin_phone;
      }
      if (!testPhone) {
        return json17({
          success: false,
          error: "\u0634\u0645\u0627\u0631\u0647 \u062A\u0644\u0641\u0646 \u0628\u0631\u0627\u06CC \u0627\u0631\u0633\u0627\u0644 \u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0645\u0634\u062E\u0635 \u0646\u06CC\u0633\u062A."
        }, 400);
      }
      const testResult = await testSmsNotification(
        context.env,
        testPhone,
        adminUser.id,
        "order_created"
      );
      if (testResult.success) {
        return json17({
          success: true,
          message: "\u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC SMS \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647 \u0635\u0641 \u0627\u0631\u0633\u0627\u0644 \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.",
          log_id: testResult.log_id
        });
      } else {
        return json17({
          success: false,
          error: testResult.error || "\u0627\u0631\u0633\u0627\u0644 \u067E\u06CC\u0627\u0645 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC SMS \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F.",
          log_id: testResult.log_id
        }, 500);
      }
    }
    if (action === "resend") {
      const logId = body.log_id;
      if (!logId) {
        return json17({
          success: false,
          error: "\u0634\u0646\u0627\u0633\u0647 \u0644\u0627\u06AF \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."
        }, 400);
      }
      const logResult = await context.env.DB.prepare(`
          SELECT 
            id,
            event_type,
            channel,
            recipient,
            subject,
            content,
            order_id
          FROM notification_logs
          WHERE id = ?
        `).bind(logId).first();
      if (!logResult) {
        return json17({
          success: false,
          error: "\u0644\u0627\u06AF \u06CC\u0627\u0641\u062A \u0646\u0634\u062F."
        }, 404);
      }
      if (logResult.channel === "telegram") {
        const settings = await getChannelSettings(context.env, "telegram");
        if (!settings || !settings.is_enabled) {
          return json17({
            success: false,
            error: "\u06A9\u0627\u0646\u0627\u0644 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0641\u0639\u0627\u0644 \u0646\u06CC\u0633\u062A."
          }, 400);
        }
        const config = settings.config || {};
        const botToken = config.bot_token;
        const chatId = config.chat_id;
        if (!botToken || !chatId) {
          return json17({
            success: false,
            error: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u062A\u0644\u06AF\u0631\u0627\u0645 \u06A9\u0627\u0645\u0644 \u0646\u06CC\u0633\u062A."
          }, 400);
        }
        const sendResult = await sendTelegramMessage2(botToken, chatId, logResult.content);
        if (sendResult.success) {
          await updateLogStatus2(context.env, logId, "sent");
          return json17({
            success: true,
            message: "\u067E\u06CC\u0627\u0645 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u0645\u062C\u062F\u062F \u0634\u062F.",
            log_id: logId
          });
        } else {
          await updateLogStatus2(context.env, logId, "failed", sendResult.error);
          return json17({
            success: false,
            error: sendResult.error || "\u0627\u0631\u0633\u0627\u0644 \u0645\u062C\u062F\u062F \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F.",
            log_id: logId
          }, 500);
        }
      }
      return json17({
        success: false,
        error: `\u0627\u0631\u0633\u0627\u0644 \u0645\u062C\u062F\u062F \u0628\u0631\u0627\u06CC \u06A9\u0627\u0646\u0627\u0644 ${logResult.channel} \u0641\u0639\u0644\u0627\u064B \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.`
      }, 400);
    }
    return json17({
      success: false,
      error: "action \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A."
    }, 400);
  } catch (error) {
    return json17({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
function getDefaultConfig(channel) {
  const defaults = {
    telegram: {
      bot_token: "",
      chat_id: ""
    },
    email: {
      provider: "smtp",
      host: "",
      port: 587,
      secure: false,
      username: "",
      password: "",
      from_email: "",
      from_name: "",
      recipients: []
    },
    sms: {
      provider: "",
      sender: "",
      recipients: []
    }
  };
  return defaults[channel] || {};
}
async function sendTelegramMessage2(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: String(chatId),
    text: String(text),
    parse_mode: "HTML",
    disable_web_page_preview: true
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.description || "\u0627\u0631\u0633\u0627\u0644 \u067E\u06CC\u0627\u0645 \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F.");
    }
    return {
      success: true,
      message_id: data.result?.message_id
    };
  } catch (error) {
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}
async function updateLogStatus2(env, logId, status, errorMessage = null) {
  await env.DB.prepare(`
      UPDATE notification_logs
      SET 
        status = ?,
        error_message = COALESCE(?, error_message),
        sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END
      WHERE id = ?
    `).bind(status, errorMessage, status, logId).run();
}
var init_notifications = __esm({
  "api/admin/notifications.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    init_notification();
    init_sms();
    __name(json17, "json");
    __name(onRequestGet10, "onRequestGet");
    __name(onRequestPost9, "onRequestPost");
    __name(getDefaultConfig, "getDefaultConfig");
    __name(sendTelegramMessage2, "sendTelegramMessage");
    __name(updateLogStatus2, "updateLogStatus");
  }
});

// api/admin/orders.js
function getCookie12(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json18(data, status = 200) {
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
  const sessionId = getCookie12(cookieString, "session_id");
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
async function onRequestGet11(context) {
  try {
    const user = await getCurrentUser6(context);
    if (!user || !isAdmin2(user)) {
      return json18({ success: false, error: "unauthorized" }, 401);
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
        shipping_address: address
      };
    });
    return json18({ success: true, orders });
  } catch (error) {
    return json18({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPost10(context) {
  try {
    const user = await getCurrentUser6(context);
    if (!user || !isAdmin2(user)) {
      return json18({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json().catch(() => null);
    const orderNumber = normalizeText3(body?.order_number);
    const nextStatus = normalizeText3(body?.status).toLowerCase();
    const nextPaymentStatus = normalizeText3(body?.payment_status).toLowerCase();
    if (!orderNumber) {
      return json18({ success: false, error: "order_number_required" }, 400);
    }
    if (nextStatus && !ALLOWED_ORDER_STATUSES.includes(nextStatus)) {
      return json18({
        success: false,
        error: "invalid_order_status",
        allowed: ALLOWED_ORDER_STATUSES
      }, 400);
    }
    if (nextPaymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(nextPaymentStatus)) {
      return json18({
        success: false,
        error: "invalid_payment_status",
        allowed: ALLOWED_PAYMENT_STATUSES
      }, 400);
    }
    const currentOrder = await getOrderByNumber2(context.env.DB, orderNumber);
    if (!currentOrder) {
      return json18({ success: false, error: "order_not_found" }, 404);
    }
    const oldStatus = String(currentOrder.status || "pending").toLowerCase();
    const oldPaymentStatus = String(currentOrder.payment_status || "pending").toLowerCase();
    const finalStatus = nextStatus || oldStatus;
    const finalPaymentStatus = nextPaymentStatus || oldPaymentStatus;
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
    } else if (["pending", "order_confirmed", "processing", "ready_to_ship", "courier_delivery", "bus_shipping", "shipped", "delivered", "cancelled", "returned", "processing_failed"].includes(finalStatus) && String(updatedOrder.cashback_status || "").toLowerCase() === "completed") {
      cashbackResult = await reverseCashbackIfNeeded2(context.env.DB, updatedOrder, user.id);
    }
    const finalOrder = await getOrderByNumber2(context.env.DB, orderNumber);
    const items = await getOrderItems2(context.env.DB, finalOrder.id);
    const payableAmount = Math.max(
      0,
      normalizeNumber3(finalOrder.total_amount) - normalizeNumber3(finalOrder.wallet_used_amount)
    );
    try {
      if (finalStatus !== oldStatus) {
        const orderData = {
          orderId: finalOrder.id,
          orderNumber: finalOrder.order_number,
          totalAmount: normalizeNumber3(finalOrder.total_amount),
          shippingAmount: normalizeNumber3(finalOrder.shipping_amount),
          walletUsedAmount: normalizeNumber3(finalOrder.wallet_used_amount),
          payableAmount,
          cashbackAmount: normalizeNumber3(finalOrder.cashback_amount),
          status: finalStatus,
          paymentStatus: finalPaymentStatus,
          createdAt: finalOrder.created_at || (/* @__PURE__ */ new Date()).toISOString()
        };
        const userData = {
          fullName: finalOrder.full_name || "",
          email: finalOrder.email || "",
          phone: finalOrder.phone || ""
        };
        if (finalStatus === "cancelled") {
          let refundAmount = 0;
          if (finalPaymentStatus === "paid" || finalPaymentStatus === "completed") {
            refundAmount = payableAmount;
          }
          const { sendOrderCancelledNotification: sendOrderCancelledNotification2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
          await sendOrderCancelledNotification2(
            context.env,
            orderData,
            userData,
            refundAmount
          );
        } else {
          const { sendOrderStatusChangedNotification: sendOrderStatusChangedNotification2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
          await sendOrderStatusChangedNotification2(
            context.env,
            orderData,
            userData,
            oldStatus,
            finalStatus
          );
        }
      }
      if (finalPaymentStatus !== oldPaymentStatus) {
        const orderData = {
          orderId: finalOrder.id,
          orderNumber: finalOrder.order_number,
          totalAmount: normalizeNumber3(finalOrder.total_amount),
          shippingAmount: normalizeNumber3(finalOrder.shipping_amount),
          walletUsedAmount: normalizeNumber3(finalOrder.wallet_used_amount),
          payableAmount,
          cashbackAmount: normalizeNumber3(finalOrder.cashback_amount),
          status: finalStatus,
          paymentStatus: finalPaymentStatus,
          createdAt: finalOrder.created_at || (/* @__PURE__ */ new Date()).toISOString()
        };
        const userData = {
          fullName: finalOrder.full_name || "",
          email: finalOrder.email || "",
          phone: finalOrder.phone || ""
        };
        if (finalPaymentStatus === "paid" || finalPaymentStatus === "completed") {
          const { sendPaymentSuccessNotification: sendPaymentSuccessNotification2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
          await sendPaymentSuccessNotification2(
            context.env,
            orderData,
            userData,
            ""
          );
        }
        if (!(oldPaymentStatus === "pending" && (finalPaymentStatus === "paid" || finalPaymentStatus === "completed"))) {
          const { sendPaymentStatusChangedNotification: sendPaymentStatusChangedNotification2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
          await sendPaymentStatusChangedNotification2(
            context.env,
            orderData,
            userData,
            oldPaymentStatus,
            finalPaymentStatus
          );
        }
      }
      if (cashbackResult && cashbackResult.applied && cashbackResult.amount > 0) {
        const orderData = {
          orderId: finalOrder.id,
          orderNumber: finalOrder.order_number,
          totalAmount: normalizeNumber3(finalOrder.total_amount),
          status: finalStatus,
          createdAt: finalOrder.created_at || (/* @__PURE__ */ new Date()).toISOString()
        };
        const userData = {
          fullName: finalOrder.full_name || "",
          email: finalOrder.email || "",
          phone: finalOrder.phone || ""
        };
        const userBalance = await context.env.DB.prepare(`SELECT COALESCE(wallet_balance, 0) AS wallet_balance FROM users WHERE id = ?`).bind(finalOrder.user_id).first();
        const newBalance = userBalance?.wallet_balance || 0;
        const { sendCashbackAppliedNotification: sendCashbackAppliedNotification2 } = await Promise.resolve().then(() => (init_notification(), notification_exports));
        await sendCashbackAppliedNotification2(
          context.env,
          orderData,
          userData,
          cashbackResult.amount,
          newBalance
        );
      }
    } catch (notificationError) {
      console.error("\u274C \u062E\u0637\u0627 \u062F\u0631 \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646 \u0633\u0641\u0627\u0631\u0634:", notificationError);
    }
    return json18({
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
    return json18({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestDelete5(context) {
  try {
    const user = await getCurrentUser6(context);
    if (!user || !isAdmin2(user)) {
      return json18({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json().catch(() => null);
    const orderNumber = normalizeText3(body?.order_number);
    if (!orderNumber) {
      return json18({ success: false, error: "order_number_required" }, 400);
    }
    const order = await getOrderByNumber2(context.env.DB, orderNumber);
    if (!order) {
      return json18({ success: false, error: "order_not_found" }, 404);
    }
    await context.env.DB.batch([
      context.env.DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(order.id),
      context.env.DB.prepare(`DELETE FROM orders WHERE id = ?`).bind(order.id)
    ]);
    return json18({ success: true, message: "order_deleted" });
  } catch (error) {
    return json18({ success: false, error: String(error?.message || error) }, 500);
  }
}
var ALLOWED_ORDER_STATUSES, ALLOWED_PAYMENT_STATUSES;
var init_orders2 = __esm({
  "api/admin/orders.js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(getCookie12, "getCookie");
    __name(json18, "json");
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
    ALLOWED_ORDER_STATUSES = [
      "pending",
      "order_confirmed",
      "processing",
      "ready_to_ship",
      "courier_delivery",
      "bus_shipping",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
      "returned",
      "processing_failed"
    ];
    ALLOWED_PAYMENT_STATUSES = [
      "pending",
      "payment_review",
      "paid",
      "completed",
      "failed"
    ];
    __name(onRequestGet11, "onRequestGet");
    __name(onRequestPost10, "onRequestPost");
    __name(onRequestDelete5, "onRequestDelete");
  }
});

// api/admin/products.js
function json19(data, status = 200) {
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
function formatNumber3(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
function productFromRow2(row, imagesByProductId, currentRate = null) {
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
      const rate = currentRate || 196e3;
      displayPrice = Number(row.base_price) * rate;
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
    display_price_formatted: displayPrice !== null ? `${formatNumber3(displayPrice)} \u062A\u0648\u0645\u0627\u0646` : "\u062A\u0645\u0627\u0633 \u0628\u06AF\u06CC\u0631\u06CC\u062F"
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
async function onRequestGet12(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
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
    return json19({
      success: true,
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      categories: (categoriesResult.results || []).map((row) => row.category).filter(Boolean),
      products: rows.map((row) => productFromRow2(row, imagesByProductId, currentRate))
    });
  } catch (error) {
    return json19(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
async function onRequestPost11(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json19({ success: false, error: "invalid_request_body" }, 400);
    }
    const input = getProductInput(body);
    if (!input.name) {
      return json19(
        {
          success: false,
          error: "\u0646\u0627\u0645 \u0645\u062D\u0635\u0648\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."
        },
        400
      );
    }
    if (!input.slug) {
      return json19(
        {
          success: false,
          error: "slug \u0645\u062D\u0635\u0648\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A. slug \u0628\u0627\u06CC\u062F \u0641\u0642\u0637 \u0634\u0627\u0645\u0644 \u062D\u0631\u0648\u0641 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC\u060C \u0639\u062F\u062F \u0648 \u062E\u0637 \u062A\u06CC\u0631\u0647 \u0628\u0627\u0634\u062F."
        },
        400
      );
    }
    if (input.priceType === "rate_based") {
      if (!input.basePrice || input.basePrice <= 0) {
        return json19(
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
      return json19(
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
      return json19(
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
    return json19(
      {
        success: true,
        message: "\u0645\u062D\u0635\u0648\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u06CC\u062C\u0627\u062F \u0634\u062F.",
        product
      },
      201
    );
  } catch (error) {
    return json19(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
async function onRequestPut5(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json19({ success: false, error: "invalid_request_body" }, 400);
    }
    const productId = toPositiveId(body.id ?? body.product_id ?? body.productId);
    if (!productId) {
      return json19(
        {
          success: false,
          error: "\u0634\u0646\u0627\u0633\u0647 \u0645\u062D\u0635\u0648\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A."
        },
        400
      );
    }
    const currentProduct = await getProductRow(context.env.DB, productId);
    if (!currentProduct) {
      return json19(
        {
          success: false,
          error: "\u0645\u062D\u0635\u0648\u0644 \u0645\u0648\u0631\u062F\u0646\u0638\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F."
        },
        404
      );
    }
    const input = getProductInput(body);
    if (!input.name) {
      return json19(
        {
          success: false,
          error: "\u0646\u0627\u0645 \u0645\u062D\u0635\u0648\u0644 \u0627\u0644\u0632\u0627\u0645\u06CC \u0627\u0633\u062A."
        },
        400
      );
    }
    if (!input.slug) {
      return json19(
        {
          success: false,
          error: "slug \u0645\u062D\u0635\u0648\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A. slug \u0628\u0627\u06CC\u062F \u0641\u0642\u0637 \u0634\u0627\u0645\u0644 \u062D\u0631\u0648\u0641 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC\u060C \u0639\u062F\u062F \u0648 \u062E\u0637 \u062A\u06CC\u0631\u0647 \u0628\u0627\u0634\u062F."
        },
        400
      );
    }
    if (input.priceType === "rate_based") {
      if (!input.basePrice || input.basePrice <= 0) {
        return json19(
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
      return json19(
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
    return json19({
      success: true,
      message: "\u0627\u0637\u0644\u0627\u0639\u0627\u062A \u0645\u062D\u0635\u0648\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.",
      product
    });
  } catch (error) {
    return json19(
      {
        success: false,
        error: String(error?.message || error)
      },
      500
    );
  }
}
async function onRequestDelete6(context) {
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
      return json19(
        {
          success: false,
          error: "\u0634\u0646\u0627\u0633\u0647 \u0645\u062D\u0635\u0648\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A."
        },
        400
      );
    }
    const product = await getProductRow(context.env.DB, productId);
    if (!product) {
      return json19(
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
    return json19({
      success: true,
      message: "\u0645\u062D\u0635\u0648\u0644 \u0648 \u06AF\u0627\u0644\u0631\u06CC \u062A\u0635\u0627\u0648\u06CC\u0631 \u0622\u0646 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F.",
      deleted_product: {
        id: Number(product.id),
        name: product.name,
        slug: product.slug
      }
    });
  } catch (error) {
    return json19(
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
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    init_rate();
    __name(json19, "json");
    __name(cleanText2, "cleanText");
    __name(cleanSlug2, "cleanSlug");
    __name(toInteger2, "toInteger");
    __name(toPositiveId, "toPositiveId");
    __name(toOptionalPrice2, "toOptionalPrice");
    __name(toBooleanInteger2, "toBooleanInteger");
    __name(normalizeStatus2, "normalizeStatus");
    __name(normalizeImageUrl2, "normalizeImageUrl");
    __name(normalizeImages2, "normalizeImages");
    __name(formatNumber3, "formatNumber");
    __name(productFromRow2, "productFromRow");
    __name(getProductImages, "getProductImages");
    __name(getProductRow, "getProductRow");
    __name(getProductPayload, "getProductPayload");
    __name(getProductInput, "getProductInput");
    __name(replaceProductImages, "replaceProductImages");
    __name(onRequestGet12, "onRequestGet");
    __name(onRequestPost11, "onRequestPost");
    __name(onRequestPut5, "onRequestPut");
    __name(onRequestDelete6, "onRequestDelete");
  }
});

// api/admin/settings.js
function json20(data, status = 200) {
  return Response.json(data, { status });
}
function normalizeText4(value) {
  return String(value ?? "").trim();
}
async function onRequestGet13(context) {
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
    return json20({
      success: true,
      settings
    });
  } catch (error) {
    return json20({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
async function onRequestPost12(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json20({ success: false, error: "invalid_payload" }, 400);
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
    return json20({
      success: true,
      message: "settings_saved",
      settings
    });
  } catch (error) {
    return json20({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_settings = __esm({
  "api/admin/settings.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    __name(json20, "json");
    __name(normalizeText4, "normalizeText");
    __name(onRequestGet13, "onRequestGet");
    __name(onRequestPost12, "onRequestPost");
  }
});

// api/admin/shipping.js
function getCookie13(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}
function json21(data, status = 200) {
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
  const sessionId = getCookie13(cookieString, "session_id");
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
async function onRequestGet14(context) {
  try {
    const user = await getCurrentUser7(context);
    if (!user || !isAdmin3(user)) {
      return json21({ success: false, error: "unauthorized" }, 401);
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
      return json21({ success: true, methods });
    }
    if (action === "costs") {
      const province = normalizeText5(url.searchParams.get("province"));
      const city = normalizeText5(url.searchParams.get("city"));
      if (!province || !city) {
        return json21({ success: false, error: "province_and_city_required" }, 400);
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
      return json21({ success: true, costs });
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
      return json21({ success: true, thresholds: enriched });
    }
    return json21({ success: false, error: "invalid_action" }, 400);
  } catch (error) {
    return json21({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPost13(context) {
  try {
    const user = await getCurrentUser7(context);
    if (!user || !isAdmin3(user)) {
      return json21({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json().catch(() => null);
    if (!body) {
      return json21({ success: false, error: "invalid_payload" }, 400);
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
        return json21({ success: false, error: "name_and_slug_required" }, 400);
      }
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE slug = ?
      `).bind(slug).first();
      if (existing) {
        return json21({ success: false, error: "slug_already_exists" }, 400);
      }
      const result = await context.env.DB.prepare(`
        INSERT INTO shipping_methods (name, slug, description, delivery_time, default_cost, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(name, slug, description, delivery_time, default_cost, is_active, sort_order).run();
      const newId = result.meta?.last_row_id || null;
      return json21({
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
        return json21({ success: false, error: "id_name_slug_required" }, 400);
      }
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE id = ?
      `).bind(id).first();
      if (!existing) {
        return json21({ success: false, error: "method_not_found" }, 404);
      }
      const duplicate = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE slug = ? AND id != ?
      `).bind(slug, id).first();
      if (duplicate) {
        return json21({ success: false, error: "slug_already_exists" }, 400);
      }
      await context.env.DB.prepare(`
        UPDATE shipping_methods
        SET name = ?, slug = ?, description = ?, delivery_time = ?, default_cost = ?, is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(name, slug, description, delivery_time, default_cost, is_active, sort_order, id).run();
      return json21({
        success: true,
        message: "\u0631\u0648\u0634 \u062D\u0645\u0644\u200C\u0648\u0646\u0642\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F."
      });
    }
    if (action === "delete_method") {
      const id = normalizeNumber4(body.id);
      if (!id) {
        return json21({ success: false, error: "id_required" }, 400);
      }
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE id = ?
      `).bind(id).first();
      if (!existing) {
        return json21({ success: false, error: "method_not_found" }, 404);
      }
      await context.env.DB.prepare(`
        DELETE FROM shipping_methods WHERE id = ?
      `).bind(id).run();
      return json21({
        success: true,
        message: "\u0631\u0648\u0634 \u062D\u0645\u0644\u200C\u0648\u0646\u0642\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F."
      });
    }
    if (action === "delete_cost") {
      const cost_id = normalizeNumber4(body.cost_id);
      if (!cost_id) {
        return json21({ success: false, error: "cost_id_required" }, 400);
      }
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_costs WHERE id = ?
      `).bind(cost_id).first();
      if (!existing) {
        return json21({ success: false, error: "cost_not_found" }, 404);
      }
      await context.env.DB.prepare(`
        DELETE FROM shipping_costs WHERE id = ?
      `).bind(cost_id).run();
      return json21({
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
        return json21({ success: false, error: "province_city_method_required" }, 400);
      }
      const method = await context.env.DB.prepare(`
        SELECT id, default_cost FROM shipping_methods WHERE id = ?
      `).bind(shipping_method_id).first();
      if (!method) {
        return json21({ success: false, error: "method_not_found" }, 404);
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
      return json21({
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
        return json21({ success: false, error: "province_and_city_required" }, 400);
      }
      const defaultMethod = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE slug = 'freight' AND is_active = 1 LIMIT 1
      `).first();
      if (!defaultMethod) {
        return json21({ success: false, error: "default_method_not_found" }, 404);
      }
      const existing = await context.env.DB.prepare(`
        SELECT id FROM shipping_costs 
        WHERE province = ? AND city = ?
        LIMIT 1
      `).bind(province, city).first();
      if (existing) {
        return json21({ success: false, error: "city_already_exists" }, 400);
      }
      const result = await context.env.DB.prepare(`
        INSERT INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, extra_cost, delivery_time, is_active)
        VALUES (?, ?, ?, 'extra', 0, 0, '', 1)
      `).bind(province, city, defaultMethod.id).run();
      return json21({
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
        return json21({ success: false, error: "province_and_city_required" }, 400);
      }
      await context.env.DB.prepare(`
        DELETE FROM shipping_costs 
        WHERE province = ? AND city = ?
      `).bind(province, city).run();
      return json21({
        success: true,
        message: "\u0634\u0647\u0631 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062D\u0630\u0641 \u0634\u062F."
      });
    }
    if (action === "save_free_threshold") {
      const shipping_method_id = normalizeNumber4(body.shipping_method_id);
      const min_order_amount = normalizeNumber4(body.min_order_amount);
      const is_active = body.is_active === true || body.is_active === "true" ? 1 : 0;
      if (!shipping_method_id || !min_order_amount) {
        return json21({ success: false, error: "method_and_amount_required" }, 400);
      }
      const method = await context.env.DB.prepare(`
        SELECT id FROM shipping_methods WHERE id = ?
      `).bind(shipping_method_id).first();
      if (!method) {
        return json21({ success: false, error: "method_not_found" }, 404);
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
      return json21({
        success: true,
        message: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u0631\u0633\u0627\u0644 \u0631\u0627\u06CC\u06AF\u0627\u0646 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F."
      });
    }
    return json21({ success: false, error: "invalid_action" }, 400);
  } catch (error) {
    return json21({ success: false, error: String(error?.message || error) }, 500);
  }
}
var init_shipping = __esm({
  "api/admin/shipping.js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(getCookie13, "getCookie");
    __name(json21, "json");
    __name(normalizeText5, "normalizeText");
    __name(normalizeNumber4, "normalizeNumber");
    __name(getCurrentUser7, "getCurrentUser");
    __name(isAdmin3, "isAdmin");
    __name(onRequestGet14, "onRequestGet");
    __name(onRequestPost13, "onRequestPost");
  }
});

// api/admin/stats.js
async function onRequestGet15(context) {
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
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    __name(onRequestGet15, "onRequestGet");
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
async function onRequestGet16(context) {
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
async function onRequestPost14(context) {
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
async function onRequestDelete7(context) {
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
    init_functionsRoutes_0_42576649940160716();
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
    __name(onRequestGet16, "onRequestGet");
    __name(onRequestPost14, "onRequestPost");
    __name(onRequestDelete7, "onRequestDelete");
  }
});

// api/admin/wallet.js
function json22(data, status = 200) {
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
async function onRequestGet17(context) {
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
        return json22({ success: false, error: "user_not_found" }, 404);
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
      return json22({
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
    return json22({
      success: true,
      settings: buildSettingsPayload(cashbackPercent, cashbackStatuses),
      transactions: (latest?.results || []).map(formatTransactionRow)
    });
  } catch (error) {
    return json22({ success: false, error: String(error?.message || error) }, 500);
  }
}
async function onRequestPost15(context) {
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
      return json22({
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
      return json22({ success: false, error: "user_id_and_amount_required" }, 400);
    }
    if (!type) {
      return json22({ success: false, error: "invalid_type" }, 400);
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
      return json22({ success: false, error: "user_not_found" }, 404);
    }
    const balanceBefore = toMoney(user.wallet_balance);
    const signedAmount = getSignedAmountByType(type, amount);
    const balanceAfter = balanceBefore + signedAmount;
    if (balanceAfter < 0) {
      return json22({ success: false, error: "insufficient_wallet_balance" }, 400);
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
    return json22({
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
    return json22({ success: false, error: String(error?.message || error) }, 500);
  }
}
var init_wallet2 = __esm({
  "api/admin/wallet.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    __name(json22, "json");
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
    __name(onRequestGet17, "onRequestGet");
    __name(onRequestPost15, "onRequestPost");
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
async function onRequestPost16(context) {
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
    init_functionsRoutes_0_42576649940160716();
    init_password();
    __name(normalizeEmail2, "normalizeEmail");
    __name(verifyPasswordCompatible, "verifyPasswordCompatible");
    __name(onRequestPost16, "onRequestPost");
  }
});

// api/auth/logout.js
function getCookie14(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  if (!target) return null;
  return target.slice(key.length + 1);
}
async function onRequestPost17(context) {
  try {
    const cookieString = context.request.headers.get("Cookie") || "";
    const sessionId = getCookie14(cookieString, "session_id");
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
    init_functionsRoutes_0_42576649940160716();
    __name(getCookie14, "getCookie");
    __name(onRequestPost17, "onRequestPost");
  }
});

// api/auth/me.js
function getCookie15(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  if (!target) return null;
  return target.slice(key.length + 1);
}
async function onRequestGet18(context) {
  try {
    const cookieString = context.request.headers.get("Cookie") || "";
    const sessionId = getCookie15(cookieString, "session_id");
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
    init_functionsRoutes_0_42576649940160716();
    __name(getCookie15, "getCookie");
    __name(onRequestGet18, "onRequestGet");
  }
});

// api/auth/profile.js
function json23(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet19(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) {
      return json23({ success: false, error: "unauthorized" }, 401);
    }
    return json23({
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
    return json23(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
async function onRequestPost18(context) {
  try {
    const user = await getCurrentUser2(context);
    if (!user) {
      return json23({ success: false, error: "unauthorized" }, 401);
    }
    const body = await context.request.json();
    const full_name = String(body.full_name ?? body.name ?? "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const password = String(body.password || "");
    const password_confirm = String(body.password_confirm || "");
    if (!full_name || !email) {
      return json23(
        { success: false, error: "full_name and email required" },
        400
      );
    }
    const existingUser = await context.env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?").bind(email, user.id).first();
    if (existingUser) {
      return json23(
        { success: false, error: "email already exists" },
        409
      );
    }
    if (password) {
      if (password.length < 8) {
        return json23(
          { success: false, error: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u062C\u062F\u06CC\u062F \u0628\u0627\u06CC\u062F \u062D\u062F\u0627\u0642\u0644 \u06F8 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0628\u0627\u0634\u062F." },
          400
        );
      }
      if (password !== password_confirm) {
        return json23(
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
    return json23({
      success: true,
      message: "\u067E\u0631\u0648\u0641\u0627\u06CC\u0644 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.",
      user: updatedUser
    });
  } catch (error) {
    return json23(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}
var init_profile = __esm({
  "api/auth/profile.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    init_password();
    __name(json23, "json");
    __name(onRequestGet19, "onRequestGet");
    __name(onRequestPost18, "onRequestPost");
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
async function onRequestPost19(context) {
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
    init_functionsRoutes_0_42576649940160716();
    init_password();
    __name(normalizePhone4, "normalizePhone");
    __name(isPublicRegistrationEnabled, "isPublicRegistrationEnabled");
    __name(onRequestPost19, "onRequestPost");
  }
});

// api/rate/current.js
function json24(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60"
    }
  });
}
function formatNumber4(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
async function onRequestGet20(context) {
  try {
    const url = new URL(context.request.url);
    const currencyCode = url.searchParams.get("currency") || "USD";
    const rate = await getCurrentRateWithPrevious(context.env, currencyCode);
    if (!rate) {
      return json24({
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
    return json24({
      success: true,
      rate: {
        id: rate.id,
        currency_code: rate.currency_code,
        currency_name: rate.currency_name,
        rate: rate.rate,
        rate_formatted: `${formatNumber4(rate.rate)} \u062A\u0648\u0645\u0627\u0646`,
        source_type: rate.source_type,
        source_label: rate.source_type === "api" ? "API" : "\u062F\u0633\u062A\u06CC",
        is_active: rate.is_active === 1,
        previous_rate: rate.previous_rate,
        previous_rate_formatted: rate.previous_rate ? `${formatNumber4(rate.previous_rate)} \u062A\u0648\u0645\u0627\u0646` : null,
        change_percent: changePercent,
        change_percent_formatted: changePercent !== null ? `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%` : null,
        updated_by_user_id: rate.updated_by_user_id,
        updated_by: changedBy,
        updated_at: rate.updated_at,
        created_at: rate.created_at
      }
    });
  } catch (error) {
    return json24({
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
    init_functionsRoutes_0_42576649940160716();
    init_rate();
    init_admin();
    __name(json24, "json");
    __name(formatNumber4, "formatNumber");
    __name(onRequestGet20, "onRequestGet");
    __name(onRequestOptions, "onRequestOptions");
  }
});

// api/rate/history.js
function json25(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60"
    }
  });
}
function formatNumber5(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
function formatDate2(value) {
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
async function onRequestGet21(context) {
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
      rate_formatted: `${formatNumber5(item.rate)} \u062A\u0648\u0645\u0627\u0646`,
      source_type: item.source_type,
      source_label: item.source_type === "api" ? "API" : "\u062F\u0633\u062A\u06CC",
      changed_by: item.changed_by || "\u0633\u06CC\u0633\u062A\u0645",
      created_at: item.created_at,
      created_at_formatted: formatDate2(item.created_at)
    }));
    let currentRate = null;
    try {
      const { getCurrentRate: getCurrentRate2 } = await Promise.resolve().then(() => (init_rate(), rate_exports));
      currentRate = await getCurrentRate2(context.env, currencyCode);
    } catch (_) {
    }
    return json25({
      success: true,
      currency_code: currencyCode,
      total: formattedHistory.length,
      current_rate: currentRate ? {
        rate: currentRate.rate,
        rate_formatted: `${formatNumber5(currentRate.rate)} \u062A\u0648\u0645\u0627\u0646`,
        updated_at: currentRate.updated_at,
        updated_at_formatted: formatDate2(currentRate.updated_at)
      } : null,
      history: formattedHistory
    });
  } catch (error) {
    return json25({
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
    init_functionsRoutes_0_42576649940160716();
    init_rate();
    __name(json25, "json");
    __name(formatNumber5, "formatNumber");
    __name(formatDate2, "formatDate");
    __name(onRequestGet21, "onRequestGet");
    __name(onRequestOptions2, "onRequestOptions");
  }
});

// api/rate/update.js
function json26(data, status = 200) {
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
function formatNumber6(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
async function onRequestPost20(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json26({
        success: false,
        error: "\u0628\u062F\u0646\u0647 \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A."
      }, 400);
    }
    const currencyCode = String(body.currency || body.currency_code || "USD").trim().toUpperCase();
    const newRate = normalizeNumber5(body.rate || body.new_rate);
    const sourceType = String(body.source_type || "manual").trim().toLowerCase();
    if (!currencyCode) {
      return json26({
        success: false,
        error: "\u06A9\u062F \u0627\u0631\u0632 \u0648\u0627\u0631\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A."
      }, 400);
    }
    if (newRate <= 0) {
      return json26({
        success: false,
        error: "\u0646\u0631\u062E \u0648\u0627\u0631\u062F \u0634\u062F\u0647 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u06CC\u06A9 \u0639\u062F\u062F \u0645\u062B\u0628\u062A \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F."
      }, 400);
    }
    if (!["manual", "api"].includes(sourceType)) {
      return json26({
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
      return json26({
        success: false,
        error: result.message || "\u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0646\u0631\u062E \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F."
      }, 500);
    }
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "rate_updated",
      target_type: "rate",
      target_id: currencyCode,
      description: `\u0646\u0631\u062E ${currencyCode} \u0627\u0632 ${formatNumber6(previousRate?.rate || 0)} \u0628\u0647 ${formatNumber6(newRate)} \u062A\u0648\u0645\u0627\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u06CC\u0627\u0641\u062A. (\u0645\u0646\u0628\u0639: ${sourceType})`
    });
    let recalculateResult = null;
    if (result.changed) {
      try {
        recalculateResult = await recalculateAllProductPrices(context.env, currencyCode);
      } catch (recalcError) {
        console.error("Error recalculating prices:", recalcError);
      }
    }
    return json26({
      success: true,
      message: result.message,
      rate: {
        currency_code: result.rate?.currency_code || currencyCode,
        currency_name: result.rate?.currency_name || null,
        rate: result.rate?.rate || newRate,
        rate_formatted: `${formatNumber6(result.rate?.rate || newRate)} \u062A\u0648\u0645\u0627\u0646`,
        previous_rate: result.previous_rate || null,
        previous_rate_formatted: result.previous_rate ? `${formatNumber6(result.previous_rate)} \u062A\u0648\u0645\u0627\u0646` : null,
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
    return json26({
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
    init_functionsRoutes_0_42576649940160716();
    init_rate();
    init_admin();
    __name(json26, "json");
    __name(normalizeNumber5, "normalizeNumber");
    __name(formatNumber6, "formatNumber");
    __name(onRequestPost20, "onRequestPost");
    __name(onRequestOptions3, "onRequestOptions");
  }
});

// api/rate/update-prices.js
function json27(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
async function onRequestPost21(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    const url = new URL(context.request.url);
    const currencyCode = url.searchParams.get("currency") || "USD";
    const rate = await getCurrentRate(context.env, currencyCode);
    if (!rate) {
      return json27({
        success: false,
        error: `\u0646\u0631\u062E \u0627\u0631\u0632 ${currencyCode} \u06CC\u0627\u0641\u062A \u0646\u0634\u062F. \u0644\u0637\u0641\u0627\u064B \u0627\u0628\u062A\u062F\u0627 \u0646\u0631\u062E \u0631\u0627 \u062A\u0646\u0638\u06CC\u0645 \u06A9\u0646\u06CC\u062F.`
      }, 404);
    }
    const result = await recalculateAllProductPrices(context.env, currencyCode);
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "prices_recalculated",
      target_type: "rate",
      target_id: currencyCode,
      description: `\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0642\u06CC\u0645\u062A \u0645\u062D\u0635\u0648\u0644\u0627\u062A \u0628\u0627 \u0646\u0631\u062E ${rate.rate} \u062A\u0648\u0645\u0627\u0646 - ${result.updated_count || 0} \u0645\u062D\u0635\u0648\u0644 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.`
    });
    return json27({
      success: true,
      message: result.message || "\u0642\u06CC\u0645\u062A \u0645\u062D\u0635\u0648\u0644\u0627\u062A \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.",
      updated_count: result.updated_count || 0,
      rate: rate.rate,
      rate_formatted: new Intl.NumberFormat("fa-IR").format(rate.rate)
    });
  } catch (error) {
    return json27({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_update_prices = __esm({
  "api/rate/update-prices.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_admin();
    init_rate();
    __name(json27, "json");
    __name(onRequestPost21, "onRequestPost");
  }
});

// api/shipping/calculate.js
function json28(data, status = 200) {
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
async function onRequestPost22(context) {
  try {
    const body = await context.request.json().catch(() => null);
    if (!body) {
      return json28({ success: false, error: "invalid_payload" }, 400);
    }
    const province = normalizeText8(body.province);
    const city = normalizeText8(body.city);
    const subtotal = normalizeNumber6(body.subtotal);
    if (!province || !city) {
      return json28({ success: false, error: "province_and_city_required" }, 400);
    }
    const result = await getShippingCost(context.env.DB, province, city, subtotal);
    if (!result.success) {
      return json28({ success: false, error: result.message }, 404);
    }
    return json28({
      success: true,
      data: result.shipping
    });
  } catch (error) {
    return json28({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_calculate = __esm({
  "api/shipping/calculate.js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(json28, "json");
    __name(normalizeText8, "normalizeText");
    __name(normalizeNumber6, "normalizeNumber");
    __name(getShippingCost, "getShippingCost");
    __name(onRequestPost22, "onRequestPost");
  }
});

// api/shipping/methods.js
function json29(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet22(context) {
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
    return json29({
      success: true,
      methods
    });
  } catch (error) {
    return json29({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_methods = __esm({
  "api/shipping/methods.js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(json29, "json");
    __name(onRequestGet22, "onRequestGet");
  }
});

// api/shipping/provinces.js
function json30(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet23(context) {
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
      return json30({
        success: true,
        provinces: fallbackData,
        provinceList: Object.keys(fallbackData)
      });
    }
    return json30({
      success: true,
      provinces,
      provinceList: Object.keys(provinces)
    });
  } catch (error) {
    return json30({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_provinces = __esm({
  "api/shipping/provinces.js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(json30, "json");
    __name(onRequestGet23, "onRequestGet");
  }
});

// api/telegram/webhook.js
function hashToken2(token) {
  const encoder2 = new TextEncoder();
  const data = encoder2.encode(token);
  return crypto.subtle.digest("SHA-256", data).then((hash) => {
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}
async function getUserInfo(env, userId) {
  return env.DB.prepare(`SELECT id, full_name, email, phone FROM users WHERE id = ?`).bind(userId).first();
}
async function getLastOrder(env, userId) {
  const order = await env.DB.prepare(`
      SELECT
        o.id,
        o.order_number,
        o.status,
        o.payment_status,
        o.subtotal_amount,
        o.shipping_amount,
        o.total_amount,
        o.wallet_used_amount,
        o.payable_amount,
        o.cashback_amount,
        o.cashback_status,
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
      ORDER BY o.created_at DESC
      LIMIT 1
    `).bind(userId).first();
  if (!order) return null;
  const itemsResult = await env.DB.prepare(`
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
    `).bind(order.id).all();
  const items = Array.isArray(itemsResult?.results) ? itemsResult.results.map((item) => ({
    id: Number(item.id || 0),
    product_id: item.product_id == null ? null : Number(item.product_id || 0),
    product_name: item.product_name || "",
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    total_price: Number(item.total_price || 0)
  })) : [];
  return { order, items };
}
function buildOrderDetailsMessage(order, items) {
  let message = `\u{1F4CB} <b>\u062C\u0632\u06CC\u06CC\u0627\u062A \u0622\u062E\u0631\u06CC\u0646 \u0633\u0641\u0627\u0631\u0634</b>

`;
  message += `\u{1F194} <b>\u0634\u0645\u0627\u0631\u0647 \u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  #${order.order_number || "-"}

`;
  message += `\u{1F4C5} <b>\u062A\u0627\u0631\u06CC\u062E \u062B\u0628\u062A:</b>
`;
  message += `  ${formatDate(order.created_at)}

`;
  message += `\u{1F4E6} <b>\u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634:</b>
`;
  message += `  ${getStatusText(order.status, "order")}

`;
  message += `\u{1F4B3} <b>\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u062F\u0627\u062E\u062A:</b>
`;
  message += `  ${getStatusText(order.payment_status, "payment")}

`;
  if (items && items.length > 0) {
    message += `\u{1F6CD}\uFE0F <b>\u0645\u062D\u0635\u0648\u0644\u0627\u062A:</b>
`;
    for (const item of items) {
      const total = Number(item.total_price || 0);
      const qty = Number(item.quantity || 0);
      message += `  \u2022 ${item.product_name || "\u0645\u062D\u0635\u0648\u0644"} \xD7 ${qty} - ${formatNumber(total)} \u062A\u0648\u0645\u0627\u0646
`;
    }
    message += `
`;
  }
  message += `\u{1F4B0} <b>\u062E\u0644\u0627\u0635\u0647 \u0645\u0628\u0627\u0644\u063A:</b>
`;
  message += `  \u062C\u0645\u0639 \u0645\u062D\u0635\u0648\u0644\u0627\u062A: ${formatNumber(order.subtotal_amount || 0)} \u062A\u0648\u0645\u0627\u0646
`;
  if (order.shipping_amount > 0) {
    message += `  \u0647\u0632\u06CC\u0646\u0647 \u0627\u0631\u0633\u0627\u0644: ${formatNumber(order.shipping_amount)} \u062A\u0648\u0645\u0627\u0646
`;
  }
  if (order.wallet_used_amount > 0) {
    message += `  \u0628\u0631\u062F\u0627\u0634\u062A \u0627\u0632 \u06A9\u06CC\u0641 \u067E\u0648\u0644: -${formatNumber(order.wallet_used_amount)} \u062A\u0648\u0645\u0627\u0646
`;
  }
  message += `  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
`;
  message += `  <b>\u0645\u0628\u0644\u063A \u0642\u0627\u0628\u0644 \u067E\u0631\u062F\u0627\u062E\u062A: ${formatNumber(order.payable_amount || order.total_amount)} \u062A\u0648\u0645\u0627\u0646</b>
`;
  if (order.cashback_amount > 0) {
    message += `
  \u{1F381} <b>\u06A9\u0634\u200C\u0628\u06A9 \u0627\u06CC\u0646 \u0633\u0641\u0627\u0631\u0634: ${formatNumber(order.cashback_amount)} \u062A\u0648\u0645\u0627\u0646</b>`;
  }
  if (order.shipping_address_line) {
    message += `

\u{1F4CD} <b>\u0622\u062F\u0631\u0633 \u0627\u0631\u0633\u0627\u0644:</b>
`;
    message += `  ${order.shipping_address_line || ""}
`;
    if (order.shipping_city || order.shipping_state) {
      message += `  ${[order.shipping_city, order.shipping_state].filter(Boolean).join(" - ")}
`;
    }
    if (order.shipping_postal_code) {
      message += `  \u06A9\u062F \u067E\u0633\u062A\u06CC: ${order.shipping_postal_code}
`;
    }
    if (order.shipping_phone) {
      message += `  \u{1F4F1} ${order.shipping_phone}
`;
    }
  }
  return message;
}
async function sendWelcomeMessage(env, chatId, botToken, userInfo) {
  const message = `\u2705 <b>\u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u0634\u062F!</b>

\u{1F464} <b>\u06A9\u0627\u0631\u0628\u0631:</b>
  ${userInfo.full_name || "-"}

\u{1F514} <b>\u0627\u0639\u0644\u0627\u0646\u200C\u0647\u0627\u06CC \u0641\u0639\u0627\u0644:</b>
  \u2022 \u062B\u0628\u062A \u0633\u0641\u0627\u0631\u0634
  \u2022 \u067E\u0631\u062F\u0627\u062E\u062A \u0645\u0648\u0641\u0642
  \u2022 \u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634
  \u2022 \u0627\u0631\u0633\u0627\u0644 \u0633\u0641\u0627\u0631\u0634
  \u2022 \u062A\u06A9\u0645\u06CC\u0644 \u0633\u0641\u0627\u0631\u0634

\u{1F4CC} <b>\u062F\u0633\u062A\u0648\u0631\u0627\u062A \u0645\u0641\u06CC\u062F:</b>
  /status - \u0645\u0634\u0627\u0647\u062F\u0647 \u0622\u062E\u0631\u06CC\u0646 \u0633\u0641\u0627\u0631\u0634
  /help - \u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u0631\u0628\u0627\u062A

\u{1F4CC} <b>\u0646\u06A9\u062A\u0647:</b>
  \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u06CC\u062F \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u0639\u0644\u0627\u0646\u200C\u0647\u0627 \u0631\u0627 \u0627\u0632 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062E\u0648\u062F \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0646\u06CC\u062F.
  \u0628\u0631\u0627\u06CC \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0633\u0641\u0627\u0631\u0634\u200C\u0647\u0627 \u0627\u0632 \u062F\u06A9\u0645\u0647 \u067E\u06CC\u06AF\u06CC\u0631\u06CC \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646\u06CC\u062F.`;
  return sendTelegramMessage(botToken, chatId, message);
}
async function sendErrorMessage(env, chatId, botToken, errorText) {
  const message = `\u274C <b>\u062E\u0637\u0627</b>

${errorText}

\u{1F4CC} <b>\u0646\u06A9\u062A\u0647:</b>
  \u0644\u0637\u0641\u0627\u064B \u0645\u062C\u062F\u062F\u0627\u064B \u0627\u0632 \u0637\u0631\u06CC\u0642 \u0633\u0627\u06CC\u062A \u0627\u0642\u062F\u0627\u0645 \u06A9\u0646\u06CC\u062F.`;
  return sendTelegramMessage(botToken, chatId, message);
}
async function handleStatusCommand(env, chatId, botToken) {
  const connection = await env.DB.prepare(`SELECT user_id FROM user_telegram_connections WHERE chat_id = ? AND is_active = 1`).bind(chatId).first();
  if (!connection) {
    await sendErrorMessage(
      env,
      chatId,
      botToken,
      "\u0634\u0645\u0627 \u0628\u0647 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062E\u0648\u062F \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A\u06CC\u062F.\n\u0644\u0637\u0641\u0627\u064B \u0627\u0632 \u0637\u0631\u06CC\u0642 \u0633\u0627\u06CC\u062A \u0627\u0642\u062F\u0627\u0645 \u0628\u0647 \u0627\u062A\u0635\u0627\u0644 \u06A9\u0646\u06CC\u062F."
    );
    return { success: false, error: "\u06A9\u0627\u0631\u0628\u0631 \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A." };
  }
  const userId = connection.user_id;
  const data = await getLastOrder(env, userId);
  if (!data || !data.order) {
    await sendErrorMessage(
      env,
      chatId,
      botToken,
      "\u0634\u0645\u0627 \u0647\u0646\u0648\u0632 \u0647\u06CC\u0686 \u0633\u0641\u0627\u0631\u0634\u06CC \u062B\u0628\u062A \u0646\u06A9\u0631\u062F\u0647\u200C\u0627\u06CC\u062F."
    );
    return { success: false, error: "\u0633\u0641\u0627\u0631\u0634\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F." };
  }
  const message = buildOrderDetailsMessage(data.order, data.items);
  const result = await sendTelegramMessage(botToken, chatId, message);
  return { success: result.success };
}
async function handleHelpCommand(env, chatId, botToken) {
  const message = `\u{1F916} <b>\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u0631\u0628\u0627\u062A \u062A\u06A9 \u062A\u062C\u0627\u0631\u062A</b>

\u{1F4CC} <b>\u062F\u0633\u062A\u0648\u0631\u0627\u062A \u0645\u0648\u062C\u0648\u062F:</b>

  /start - \u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC
  /status - \u0645\u0634\u0627\u0647\u062F\u0647 \u0622\u062E\u0631\u06CC\u0646 \u0633\u0641\u0627\u0631\u0634 \u0628\u0627 \u062C\u0632\u06CC\u06CC\u0627\u062A \u06A9\u0627\u0645\u0644
  /help - \u0646\u0645\u0627\u06CC\u0634 \u0627\u06CC\u0646 \u0631\u0627\u0647\u0646\u0645\u0627

\u{1F514} <b>\u0627\u0639\u0644\u0627\u0646\u200C\u0647\u0627\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631:</b>
  \u2022 \u062B\u0628\u062A \u0633\u0641\u0627\u0631\u0634 \u062C\u062F\u06CC\u062F
  \u2022 \u067E\u0631\u062F\u0627\u062E\u062A \u0645\u0648\u0641\u0642
  \u2022 \u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0633\u0641\u0627\u0631\u0634
  \u2022 \u0627\u0631\u0633\u0627\u0644 \u0633\u0641\u0627\u0631\u0634
  \u2022 \u062A\u06A9\u0645\u06CC\u0644 \u0633\u0641\u0627\u0631\u0634

\u{1F4CC} <b>\u0646\u06A9\u062A\u0647:</b>
  \u0628\u0631\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u0639\u0644\u0627\u0646\u200C\u0647\u0627 \u0628\u0647 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062E\u0648\u062F \u062F\u0631 \u0633\u0627\u06CC\u062A \u0645\u0631\u0627\u062C\u0639\u0647 \u06A9\u0646\u06CC\u062F.`;
  return sendTelegramMessage(botToken, chatId, message);
}
async function handleStartCommand(env, chatId, botToken, text, from) {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) {
    await sendErrorMessage(
      env,
      chatId,
      botToken,
      "\u0644\u06CC\u0646\u06A9 \u0627\u062A\u0635\u0627\u0644 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u0627\u0632 \u0637\u0631\u06CC\u0642 \u0633\u0627\u06CC\u062A \u0627\u0642\u062F\u0627\u0645 \u0628\u0647 \u0627\u062A\u0635\u0627\u0644 \u06A9\u0646\u06CC\u062F."
    );
    return { success: false, error: "\u062A\u0648\u06A9\u0646 \u0627\u0631\u0627\u0626\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." };
  }
  const rawToken = parts[1];
  const tokenHash = await hashToken2(rawToken);
  const tokenRecord = await findTelegramTokenByHash(env, tokenHash);
  if (!tokenRecord) {
    await sendErrorMessage(
      env,
      chatId,
      botToken,
      "\u0644\u06CC\u0646\u06A9 \u0627\u062A\u0635\u0627\u0644 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062C\u062F\u06CC\u062F\u06CC \u0627\u0632 \u0633\u0627\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u06A9\u0646\u06CC\u062F."
    );
    return { success: false, error: "\u062A\u0648\u06A9\u0646 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." };
  }
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(tokenRecord.expires_at);
  if (now > expiresAt) {
    await sendErrorMessage(
      env,
      chatId,
      botToken,
      "\u0644\u06CC\u0646\u06A9 \u0627\u062A\u0635\u0627\u0644 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062C\u062F\u06CC\u062F\u06CC \u0627\u0632 \u0633\u0627\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u06A9\u0646\u06CC\u062F."
    );
    return { success: false, error: "\u062A\u0648\u06A9\u0646 \u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A." };
  }
  if (tokenRecord.is_used === 1) {
    await sendErrorMessage(
      env,
      chatId,
      botToken,
      "\u0627\u06CC\u0646 \u0644\u06CC\u0646\u06A9 \u0642\u0628\u0644\u0627\u064B \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A. \u0644\u0637\u0641\u0627\u064B \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062C\u062F\u06CC\u062F\u06CC \u0627\u0632 \u0633\u0627\u06CC\u062A \u0627\u0631\u0633\u0627\u0644 \u06A9\u0646\u06CC\u062F."
    );
    return { success: false, error: "\u062A\u0648\u06A9\u0646 \u0642\u0628\u0644\u0627\u064B \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A." };
  }
  const userId = tokenRecord.user_id;
  const userInfo = await getUserInfo(env, userId);
  if (!userInfo) {
    await sendErrorMessage(
      env,
      chatId,
      botToken,
      "\u06A9\u0627\u0631\u0628\u0631 \u0645\u0648\u0631\u062F \u0646\u0638\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F."
    );
    return { success: false, error: "\u06A9\u0627\u0631\u0628\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." };
  }
  const existingConnection = await env.DB.prepare(`SELECT user_id FROM user_telegram_connections WHERE chat_id = ? AND is_active = 1`).bind(chatId).first();
  if (existingConnection && existingConnection.user_id !== userId) {
    await sendErrorMessage(
      env,
      chatId,
      botToken,
      "\u0627\u06CC\u0646 \u062D\u0633\u0627\u0628 \u062A\u0644\u06AF\u0631\u0627\u0645 \u0642\u0628\u0644\u0627\u064B \u0628\u0647 \u06A9\u0627\u0631\u0628\u0631 \u062F\u06CC\u06AF\u0631\u06CC \u0645\u062A\u0635\u0644 \u0634\u062F\u0647 \u0627\u0633\u062A."
    );
    return { success: false, error: "chat_id \u0642\u0628\u0644\u0627\u064B \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A." };
  }
  const fromInfo = {
    id: from.id,
    username: from.username,
    first_name: from.first_name,
    last_name: from.last_name
  };
  await saveTelegramConnection(env, userId, chatId, fromInfo);
  await markTelegramTokenAsUsed(env, tokenRecord.id);
  const existingPrefs = await getUserNotificationPreferences2(env, userId);
  if (!existingPrefs) {
    await updateUserNotificationPreferences(env, userId, {
      order_created: 1,
      payment_success: 1,
      payment_failed: 1,
      order_status_changed: 1,
      order_preparing: 1,
      order_shipped: 1,
      tracking_code_added: 1,
      order_completed: 1,
      order_cancelled: 1,
      announcements: 0,
      promotions: 0,
      marketing: 0
    });
  }
  await sendWelcomeMessage(env, chatId, botToken, userInfo);
  return { success: true, userId };
}
async function onRequestPost23(context) {
  try {
    const { env, request } = context;
    const secretToken = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && secretToken !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    const message = body.message;
    if (!message) {
      return new Response("OK", { status: 200 });
    }
    const chat = message.chat;
    const chatId = chat.id;
    const text = message.text || "";
    const from = message.from || {};
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN \u062A\u0646\u0638\u06CC\u0645 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
      return new Response("Bot token not configured", { status: 500 });
    }
    if (text.startsWith("/start")) {
      await handleStartCommand(env, chatId, botToken, text, from);
      return new Response("OK", { status: 200 });
    }
    if (text.startsWith("/status")) {
      await handleStatusCommand(env, chatId, botToken);
      return new Response("OK", { status: 200 });
    }
    if (text.startsWith("/help")) {
      await handleHelpCommand(env, chatId, botToken);
      return new Response("OK", { status: 200 });
    }
    const unknownMessage = `\u{1F916} <b>\u0633\u0644\u0627\u0645!</b>

\u0645\u0646 \u0631\u0628\u0627\u062A \u0627\u0637\u0644\u0627\u0639\u200C\u0631\u0633\u0627\u0646\u06CC \u062A\u06A9 \u062A\u062C\u0627\u0631\u062A \u0647\u0633\u062A\u0645.

\u{1F4CC} <b>\u062F\u0633\u062A\u0648\u0631\u0627\u062A \u0645\u0648\u062C\u0648\u062F:</b>
  /status - \u0645\u0634\u0627\u0647\u062F\u0647 \u0622\u062E\u0631\u06CC\u0646 \u0633\u0641\u0627\u0631\u0634
  /help - \u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u0631\u0628\u0627\u062A

\u{1F4CC} <b>\u0646\u06A9\u062A\u0647:</b>
  \u0627\u06CC\u0646 \u0631\u0628\u0627\u062A \u0628\u0631\u0627\u06CC \u0627\u0631\u0633\u0627\u0644 \u0627\u0639\u0644\u0627\u0646\u200C\u0647\u0627\u06CC \u0633\u0641\u0627\u0631\u0634 \u0648 \u067E\u0631\u062F\u0627\u062E\u062A \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.
  \u0628\u0631\u0627\u06CC \u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u062D\u0633\u0627\u0628 \u06A9\u0627\u0631\u0628\u0631\u06CC \u062E\u0648\u062F\u060C \u0644\u0637\u0641\u0627\u064B \u0627\u0632 \u0633\u0627\u06CC\u062A \u0627\u0642\u062F\u0627\u0645 \u06A9\u0646\u06CC\u062F.`;
    await sendTelegramMessage(botToken, chatId, unknownMessage);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
var init_webhook = __esm({
  "api/telegram/webhook.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_db();
    init_telegram();
    init_notification();
    __name(hashToken2, "hashToken");
    __name(getUserInfo, "getUserInfo");
    __name(getLastOrder, "getLastOrder");
    __name(buildOrderDetailsMessage, "buildOrderDetailsMessage");
    __name(sendWelcomeMessage, "sendWelcomeMessage");
    __name(sendErrorMessage, "sendErrorMessage");
    __name(handleStatusCommand, "handleStatusCommand");
    __name(handleHelpCommand, "handleHelpCommand");
    __name(handleStartCommand, "handleStartCommand");
    __name(onRequestPost23, "onRequestPost");
  }
});

// api/catalog.js
function json31(data, status = 200) {
  return Response.json(data, { status });
}
async function onRequestGet24(context) {
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
      return json31({
        success: true,
        provinces: fallbackData,
        provinceList: Object.keys(fallbackData)
      });
    }
    return json31({
      success: true,
      provinces,
      provinceList: Object.keys(provinces)
    });
  } catch (error) {
    return json31({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}
var init_catalog = __esm({
  "api/catalog.js"() {
    init_functionsRoutes_0_42576649940160716();
    __name(json31, "json");
    __name(onRequestGet24, "onRequestGet");
  }
});

// api/products.js
function json32(data, status = 200, headers = {}) {
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
function formatNumber7(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}
function buildPriceLabel(product, displayPrice) {
  if (product.price_type === "rate_based" && displayPrice !== null && displayPrice > 0) {
    return `${formatNumber7(displayPrice)} \u062A\u0648\u0645\u0627\u0646`;
  }
  const price = Number(product.price);
  const hasValidPrice = Number.isFinite(price) && price > 0;
  if (toBoolean(product.show_price) && hasValidPrice) {
    return `${formatNumber7(price)} \u062A\u0648\u0645\u0627\u0646`;
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
async function onRequestGet25(context) {
  try {
    const db = context.env?.DB;
    if (!db) {
      return json32({ success: false, error: "D1 database binding DB is not configured." }, 500);
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
      return json32({ success: true, total: 0, products: [], rate: currentRate });
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
    return json32({ success: true, total: products.length, products, rate: currentRate });
  } catch (error) {
    return json32({ success: false, error: String(error?.message || error) }, 500, { "Cache-Control": "no-store" });
  }
}
var init_products2 = __esm({
  "api/products.js"() {
    init_functionsRoutes_0_42576649940160716();
    init_rate();
    __name(json32, "json");
    __name(cleanText3, "cleanText");
    __name(toBoolean, "toBoolean");
    __name(normalizeImagePath, "normalizeImagePath");
    __name(normalizePageUrl, "normalizePageUrl");
    __name(formatNumber7, "formatNumber");
    __name(buildPriceLabel, "buildPriceLabel");
    __name(buildStockLabel, "buildStockLabel");
    __name(productFromRow3, "productFromRow");
    __name(onRequestOptions4, "onRequestOptions");
    __name(onRequestGet25, "onRequestGet");
  }
});

// api/test-db.js
async function onRequestGet26(context) {
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
    init_functionsRoutes_0_42576649940160716();
    __name(onRequestGet26, "onRequestGet");
  }
});

// ../.wrangler/tmp/pages-czlwTC/functionsRoutes-0.42576649940160716.mjs
var routes;
var init_functionsRoutes_0_42576649940160716 = __esm({
  "../.wrangler/tmp/pages-czlwTC/functionsRoutes-0.42576649940160716.mjs"() {
    init_default();
    init_connect();
    init_disconnect();
    init_preferences();
    init_preferences();
    init_status();
    init_track_order();
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
    init_notifications();
    init_notifications();
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
    init_update_prices();
    init_calculate();
    init_methods();
    init_provinces();
    init_webhook();
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
        routePath: "/api/account/telegram/connect",
        mountPath: "/api/account/telegram",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost2]
      },
      {
        routePath: "/api/account/telegram/disconnect",
        mountPath: "/api/account/telegram",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost3]
      },
      {
        routePath: "/api/account/telegram/preferences",
        mountPath: "/api/account/telegram",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet]
      },
      {
        routePath: "/api/account/telegram/preferences",
        mountPath: "/api/account/telegram",
        method: "PUT",
        middlewares: [],
        modules: [onRequestPut]
      },
      {
        routePath: "/api/account/telegram/status",
        mountPath: "/api/account/telegram",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet2]
      },
      {
        routePath: "/api/account/telegram/track-order",
        mountPath: "/api/account/telegram",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost4]
      },
      {
        routePath: "/api/admin/users/password",
        mountPath: "/api/admin/users",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost5]
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
        modules: [onRequestPut2]
      },
      {
        routePath: "/api/account/orders/:order",
        mountPath: "/api/account/orders",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet3]
      },
      {
        routePath: "/api/admin/orders/:order",
        mountPath: "/api/admin/orders",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete2]
      },
      {
        routePath: "/api/admin/orders/:order",
        mountPath: "/api/admin/orders",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet4]
      },
      {
        routePath: "/api/admin/orders/:order",
        mountPath: "/api/admin/orders",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost6]
      },
      {
        routePath: "/api/admin/products/:id",
        mountPath: "/api/admin/products",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete3]
      },
      {
        routePath: "/api/admin/products/:id",
        mountPath: "/api/admin/products",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet5]
      },
      {
        routePath: "/api/admin/products/:id",
        mountPath: "/api/admin/products",
        method: "PUT",
        middlewares: [],
        modules: [onRequestPut3]
      },
      {
        routePath: "/api/account/addresses",
        mountPath: "/api/account",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete4]
      },
      {
        routePath: "/api/account/addresses",
        mountPath: "/api/account",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet6]
      },
      {
        routePath: "/api/account/addresses",
        mountPath: "/api/account",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost7]
      },
      {
        routePath: "/api/account/addresses",
        mountPath: "/api/account",
        method: "PUT",
        middlewares: [],
        modules: [onRequestPut4]
      },
      {
        routePath: "/api/account/create-order",
        mountPath: "/api/account",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost8]
      },
      {
        routePath: "/api/account/orders",
        mountPath: "/api/account",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet7]
      },
      {
        routePath: "/api/account/wallet",
        mountPath: "/api/account",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet8]
      },
      {
        routePath: "/api/admin/me",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet9]
      },
      {
        routePath: "/api/admin/notifications",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet10]
      },
      {
        routePath: "/api/admin/notifications",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost9]
      },
      {
        routePath: "/api/admin/orders",
        mountPath: "/api/admin",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete5]
      },
      {
        routePath: "/api/admin/orders",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet11]
      },
      {
        routePath: "/api/admin/orders",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost10]
      },
      {
        routePath: "/api/admin/products",
        mountPath: "/api/admin",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete6]
      },
      {
        routePath: "/api/admin/products",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet12]
      },
      {
        routePath: "/api/admin/products",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost11]
      },
      {
        routePath: "/api/admin/products",
        mountPath: "/api/admin",
        method: "PUT",
        middlewares: [],
        modules: [onRequestPut5]
      },
      {
        routePath: "/api/admin/settings",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet13]
      },
      {
        routePath: "/api/admin/settings",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost12]
      },
      {
        routePath: "/api/admin/shipping",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet14]
      },
      {
        routePath: "/api/admin/shipping",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost13]
      },
      {
        routePath: "/api/admin/stats",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet15]
      },
      {
        routePath: "/api/admin/users",
        mountPath: "/api/admin",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete7]
      },
      {
        routePath: "/api/admin/users",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet16]
      },
      {
        routePath: "/api/admin/users",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost14]
      },
      {
        routePath: "/api/admin/wallet",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet17]
      },
      {
        routePath: "/api/admin/wallet",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost15]
      },
      {
        routePath: "/api/auth/login",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost16]
      },
      {
        routePath: "/api/auth/logout",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost17]
      },
      {
        routePath: "/api/auth/me",
        mountPath: "/api/auth",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet18]
      },
      {
        routePath: "/api/auth/profile",
        mountPath: "/api/auth",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet19]
      },
      {
        routePath: "/api/auth/profile",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost18]
      },
      {
        routePath: "/api/auth/register",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost19]
      },
      {
        routePath: "/api/rate/current",
        mountPath: "/api/rate",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet20]
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
        modules: [onRequestGet21]
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
        modules: [onRequestPost20]
      },
      {
        routePath: "/api/rate/update-prices",
        mountPath: "/api/rate",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost21]
      },
      {
        routePath: "/api/shipping/calculate",
        mountPath: "/api/shipping",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost22]
      },
      {
        routePath: "/api/shipping/methods",
        mountPath: "/api/shipping",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet22]
      },
      {
        routePath: "/api/shipping/provinces",
        mountPath: "/api/shipping",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet23]
      },
      {
        routePath: "/api/telegram/webhook",
        mountPath: "/api/telegram",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost23]
      },
      {
        routePath: "/api/catalog",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet24]
      },
      {
        routePath: "/api/products",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet25]
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
        modules: [onRequestGet26]
      }
    ];
  }
});

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/pages-template-worker.ts
init_functionsRoutes_0_42576649940160716();

// ../../../AppData/Roaming/npm/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
init_functionsRoutes_0_42576649940160716();
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
