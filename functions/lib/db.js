const nowIso = () => new Date().toISOString();

function normalizeEmail(email) {
  if (!email) return null;
  return String(email).trim().toLowerCase();
}

function normalizeMobile(mobile) {
  if (!mobile) return null;
  return String(mobile).trim().replace(/[^\d+]/g, '');
}

function normalizeIdentity(identity) {
  const value = String(identity || '').trim();
  if (!value) return '';
  return value.includes('@') ? normalizeEmail(value) : normalizeMobile(value);
}

function getDb(env) {
  const db = env?.DB || env?.db;
  if (!db) {
    throw new Error('D1 binding not found. Expected env.DB');
  }
  return db;
}

export async function findUserById(env, userId) {
  const db = getDb(env);
  return db
    .prepare(`SELECT id, full_name, mobile, email, password_hash, created_at, updated_at
              FROM users
              WHERE id = ?`)
    .bind(userId)
    .first();
}

export async function findUserByIdentity(env, identity) {
  const db = getDb(env);
  const normalized = normalizeIdentity(identity);
  if (!normalized) return null;

  if (normalized.includes('@')) {
    return db
      .prepare(`SELECT id, full_name, mobile, email, password_hash, created_at, updated_at
                FROM users
                WHERE email = ?`)
      .bind(normalized)
      .first();
  }

  return db
    .prepare(`SELECT id, full_name, mobile, email, password_hash, created_at, updated_at
              FROM users
              WHERE mobile = ?`)
    .bind(normalized)
    .first();
}

export async function createUser(env, { fullName, mobile, email, passwordHash }) {
  const db = getDb(env);
  const normalizedMobile = normalizeMobile(mobile);
  const normalizedEmail = normalizeEmail(email);
  const timestamp = nowIso();

  const result = await db
    .prepare(`INSERT INTO users (full_name, mobile, email, password_hash, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(
      String(fullName || '').trim(),
      normalizedMobile,
      normalizedEmail,
      passwordHash,
      timestamp,
      timestamp
    )
    .run();

  return findUserById(env, result.meta.last_row_id);
}

export async function createSession(env, { userId, tokenHash, expiresAt }) {
  const db = getDb(env);
  const timestamp = nowIso();

  const result = await db
    .prepare(`INSERT INTO sessions (user_id, token_hash, created_at, expires_at)
              VALUES (?, ?, ?, ?)`)
    .bind(userId, tokenHash, timestamp, expiresAt)
    .run();

  return db
    .prepare(`SELECT id, user_id, token_hash, created_at, expires_at
              FROM sessions
              WHERE id = ?`)
    .bind(result.meta.last_row_id)
    .first();
}

export async function findSessionByTokenHash(env, tokenHash) {
  const db = getDb(env);
  return db
    .prepare(`SELECT id, user_id, token_hash, created_at, expires_at
              FROM sessions
              WHERE token_hash = ?`)
    .bind(tokenHash)
    .first();
}

export async function getSessionUser(env, tokenHash) {
  const db = getDb(env);
  return db
    .prepare(`SELECT
                s.id AS session_id,
                s.user_id,
                s.expires_at,
                u.id,
                u.full_name,
                u.mobile,
                u.email,
                u.created_at,
                u.updated_at
              FROM sessions s
              INNER JOIN users u ON u.id = s.user_id
              WHERE s.token_hash = ?`)
    .bind(tokenHash)
    .first();
}

export async function deleteSessionByTokenHash(env, tokenHash) {
  const db = getDb(env);
  return db
    .prepare(`DELETE FROM sessions WHERE token_hash = ?`)
    .bind(tokenHash)
    .run();
}

export async function deleteExpiredSessions(env) {
  const db = getDb(env);
  return db
    .prepare(`DELETE FROM sessions WHERE expires_at <= ?`)
    .bind(nowIso())
    .run();
}

export {
  getDb,
  normalizeEmail,
  normalizeMobile,
  normalizeIdentity,
};
