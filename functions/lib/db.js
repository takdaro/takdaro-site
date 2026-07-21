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

export {
  getDb,
  normalizeEmail,
  normalizePhone,
  normalizeIdentity,
};