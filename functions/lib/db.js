function normalizeEmail(email) {
  if (!email) return null;
  return String(email).trim().toLowerCase();
}

function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).trim().replace(/[^\d+]/g, "");
}

function normalizeIdentity(identity) {
  const value = String(identity || "").trim();
  if (!value) return "";
  return value.includes("@") ? normalizeEmail(value) : normalizePhone(value);
}

function getDb(env) {
  const db = env?.DB || env?.db;
  if (!db) {
    throw new Error("D1 binding not found. Expected env.DB");
  }
  return db;
}

export async function findUserById(env, userId) {
  const db = getDb(env);
  return db
    .prepare(`SELECT id, full_name, phone, email, password_hash, created_at
              FROM users
              WHERE id = ?`)
    .bind(userId)
    .first();
}

export async function findUserByIdentity(env, identity) {
  const db = getDb(env);
  const normalized = normalizeIdentity(identity);
  if (!normalized) return null;

  if (normalized.includes("@")) {
    return db
      .prepare(`SELECT id, full_name, phone, email, password_hash, created_at
                FROM users
                WHERE email = ?`)
      .bind(normalized)
      .first();
  }

  return db
    .prepare(`SELECT id, full_name, phone, email, password_hash, created_at
              FROM users
              WHERE phone = ?`)
    .bind(normalized)
    .first();
}

export async function createUser(env, { fullName, phone, email, passwordHash }) {
  const db = getDb(env);
  const normalizedFullName = String(fullName || "").trim();
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedFullName || !normalizedPhone || !normalizedEmail || !passwordHash) {
    throw new Error("fullName, phone, email and passwordHash are required");
  }

  const result = await db
    .prepare(`INSERT INTO users (full_name, phone, email, password_hash)
              VALUES (?, ?, ?, ?)`)
    .bind(
      normalizedFullName,
      normalizedPhone,
      normalizedEmail,
      passwordHash
    )
    .run();

  return findUserById(env, result.meta?.last_row_id);
}

export async function createSession(env, { sessionId, userId }) {
  const db = getDb(env);

  if (!sessionId || !userId) {
    throw new Error("sessionId and userId are required");
  }

  await db
    .prepare(`INSERT INTO sessions (id, user_id, created_at)
              VALUES (?, ?, CURRENT_TIMESTAMP)`)
    .bind(sessionId, userId)
    .run();

  return db
    .prepare(`SELECT id, user_id, created_at
              FROM sessions
              WHERE id = ?`)
    .bind(sessionId)
    .first();
}

export async function findSessionById(env, sessionId) {
  const db = getDb(env);
  return db
    .prepare(`SELECT id, user_id, created_at
              FROM sessions
              WHERE id = ?`)
    .bind(sessionId)
    .first();
}

export async function getSessionUser(env, sessionId) {
  const db = getDb(env);
  return db
    .prepare(`SELECT
                s.id AS session_id,
                s.user_id,
                u.id,
                u.full_name,
                u.phone,
                u.email,
                u.created_at
              FROM sessions s
              INNER JOIN users u ON u.id = s.user_id
              WHERE s.id = ?`)
    .bind(sessionId)
    .first();
}

export async function deleteSessionById(env, sessionId) {
  const db = getDb(env);
  return db
    .prepare(`DELETE FROM sessions WHERE id = ?`)
    .bind(sessionId)
    .run();
}

// ============================================
// توابع جدید مدیریت Telegram
// ============================================

/**
 * ذخیره توکن اتصال تلگرام
 * @param {Object} env - محیط Cloudflare
 * @param {number} userId - شناسه کاربر
 * @param {string} tokenHash - هش توکن
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function createTelegramToken(env, userId, tokenHash) {
  const db = getDb(env);

  const result = await db
    .prepare(`
      INSERT INTO telegram_tokens (user_id, token_hash, created_at, expires_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, datetime('now', '+10 minutes'))
    `)
    .bind(userId, tokenHash)
    .run();

  return {
    success: true,
    id: result.meta?.last_row_id
  };
}

/**
 * پیدا کردن توکن با هش
 * @param {Object} env - محیط Cloudflare
 * @param {string} tokenHash - هش توکن
 * @returns {Promise<Object|null>} - اطلاعات توکن یا null
 */
export async function findTelegramTokenByHash(env, tokenHash) {
  const db = getDb(env);

  return db
    .prepare(`
      SELECT id, user_id, token_hash, is_used, created_at, expires_at
      FROM telegram_tokens
      WHERE token_hash = ?
      LIMIT 1
    `)
    .bind(tokenHash)
    .first();
}

/**
 * علامت‌گذاری توکن به عنوان استفاده‌شده
 * @param {Object} env - محیط Cloudflare
 * @param {number} tokenId - شناسه توکن
 * @returns {Promise<boolean>} - نتیجه عملیات
 */
export async function markTelegramTokenAsUsed(env, tokenId) {
  const db = getDb(env);

  await db
    .prepare(`
      UPDATE telegram_tokens
      SET is_used = 1
      WHERE id = ?
    `)
    .bind(tokenId)
    .run();

  return true;
}

/**
 * ذخیره اتصال تلگرام کاربر
 * @param {Object} env - محیط Cloudflare
 * @param {number} userId - شناسه کاربر
 * @param {string} chatId - شناسه چت تلگرام
 * @param {Object} userInfo - اطلاعات کاربر تلگرام
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function saveTelegramConnection(env, userId, chatId, userInfo = {}) {
  const db = getDb(env);

  // بررسی اینکه chat_id قبلاً به کاربر دیگری متصل نشده باشد
  const existing = await db
    .prepare(`
      SELECT id, user_id, is_active
      FROM user_telegram_connections
      WHERE chat_id = ? AND is_active = 1
    `)
    .bind(chatId)
    .first();

  if (existing && existing.user_id !== userId) {
    throw new Error('این حساب تلگرام قبلاً به کاربر دیگری متصل شده است.');
  }

  // غیرفعال کردن اتصال قبلی کاربر (اگر وجود دارد)
  await db
    .prepare(`
      UPDATE user_telegram_connections
      SET is_active = 0, disconnected_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND is_active = 1
    `)
    .bind(userId)
    .run();

  // ایجاد اتصال جدید
  const result = await db
    .prepare(`
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
    `)
    .bind(
      userId,
      chatId,
      userInfo.id || null,
      userInfo.username || null,
      userInfo.first_name || null,
      userInfo.last_name || null
    )
    .run();

  return {
    success: true,
    id: result.meta?.last_row_id
  };
}

/**
 * پیدا کردن اتصال تلگرام با user_id
 * @param {Object} env - محیط Cloudflare
 * @param {number} userId - شناسه کاربر
 * @returns {Promise<Object|null>} - اطلاعات اتصال یا null
 */
export async function findTelegramConnectionByUserId(env, userId) {
  const db = getDb(env);

  return db
    .prepare(`
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
    `)
    .bind(userId)
    .first();
}

/**
 * پیدا کردن اتصال تلگرام با chat_id
 * @param {Object} env - محیط Cloudflare
 * @param {string} chatId - شناسه چت تلگرام
 * @returns {Promise<Object|null>} - اطلاعات اتصال یا null
 */
export async function findTelegramConnectionByChatId(env, chatId) {
  const db = getDb(env);

  return db
    .prepare(`
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
      WHERE chat_id = ? AND is_active = 1
      LIMIT 1
    `)
    .bind(chatId)
    .first();
}

/**
 * پیدا کردن کاربر با chat_id
 * @param {Object} env - محیط Cloudflare
 * @param {string} chatId - شناسه چت تلگرام
 * @returns {Promise<Object|null>} - اطلاعات کاربر یا null
 */
export async function findUserByTelegramChatId(env, chatId) {
  const db = getDb(env);

  const connection = await db
    .prepare(`
      SELECT user_id
      FROM user_telegram_connections
      WHERE chat_id = ? AND is_active = 1
      LIMIT 1
    `)
    .bind(chatId)
    .first();

  if (!connection) return null;

  return findUserById(env, connection.user_id);
}

/**
 * قطع اتصال تلگرام کاربر
 * @param {Object} env - محیط Cloudflare
 * @param {number} userId - شناسه کاربر
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function disconnectTelegram(env, userId) {
  const db = getDb(env);

  await db
    .prepare(`
      UPDATE user_telegram_connections
      SET is_active = 0, disconnected_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND is_active = 1
    `)
    .bind(userId)
    .run();

  return { success: true };
}

/**
 * به‌روزرسانی last_used_at
 * @param {Object} env - محیط Cloudflare
 * @param {number} userId - شناسه کاربر
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function updateTelegramLastUsed(env, userId) {
  const db = getDb(env);

  await db
    .prepare(`
      UPDATE user_telegram_connections
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND is_active = 1
    `)
    .bind(userId)
    .run();

  return { success: true };
}

/**
 * دریافت تنظیمات اعلان کاربر
 * @param {Object} env - محیط Cloudflare
 * @param {number} userId - شناسه کاربر
 * @returns {Promise<Object|null>} - تنظیمات یا null
 */
export async function getUserNotificationPreferences(env, userId) {
  const db = getDb(env);

  const result = await db
    .prepare(`
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
    `)
    .bind(userId)
    .first();

  if (!result) return null;

  // تبدیل به boolean
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

/**
 * ذخیره یا به‌روزرسانی تنظیمات اعلان کاربر
 * @param {Object} env - محیط Cloudflare
 * @param {number} userId - شناسه کاربر
 * @param {Object} preferences - تنظیمات جدید
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function saveUserNotificationPreferences(env, userId, preferences) {
  const db = getDb(env);

  // فیلدهای مجاز
  const fields = [
    'order_created',
    'payment_success',
    'payment_failed',
    'order_status_changed',
    'order_preparing',
    'order_shipped',
    'tracking_code_added',
    'order_completed',
    'order_cancelled',
    'announcements',
    'promotions',
    'marketing'
  ];

  // فیلدهایی که باید به‌روزرسانی شوند
  const updates = [];
  const values = [];

  for (const field of fields) {
    if (preferences[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(preferences[field] ? 1 : 0);
    }
  }

  if (updates.length === 0) {
    throw new Error('هیچ تنظیماتی برای به‌روزرسانی وجود ندارد.');
  }

  // بررسی وجود رکورد
  const existing = await db
    .prepare(`SELECT id FROM user_notification_preferences WHERE user_id = ?`)
    .bind(userId)
    .first();

  if (existing) {
    // به‌روزرسانی
    values.push(userId);
    const query = `
      UPDATE user_notification_preferences
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;
    await db.prepare(query).bind(...values).run();
  } else {
    // ایجاد جدید - ابتدا تمام فیلدها را با مقدار پیش‌فرض تنظیم می‌کنیم
    const insertFields = ['user_id', ...fields];
    const placeholders = insertFields.map(() => '?').join(', ');
    const insertValues = [userId];
    
    for (const field of fields) {
      const val = preferences[field] !== undefined ? preferences[field] : 1;
      insertValues.push(val ? 1 : 0);
    }

    const query = `
      INSERT INTO user_notification_preferences (${insertFields.join(', ')})
      VALUES (${placeholders})
    `;
    await db.prepare(query).bind(...insertValues).run();
  }

  return { success: true };
}

export {
  getDb,
  normalizeEmail,
  normalizePhone,
  normalizeIdentity,
};