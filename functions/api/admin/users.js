const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(process.cwd(), "data", "site.db");

function getDb() {
  return new Database(DB_PATH);
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "")
    .trim()
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/\D/g, "");
}

function sanitizeText(value) {
  return String(value || "").trim();
}

function isAllowedRole(role) {
  return ["user", "admin", "super_admin"].includes(String(role || "").trim());
}

function canManageTargetRole(currentRole, targetRole) {
  const actor = String(currentRole || "").trim();
  const target = String(targetRole || "").trim();

  if (actor === "super_admin") return true;
  if (actor === "admin") {
    return target === "user" || target === "admin";
  }
  return false;
}

function canEditUser(actor, targetUser, requestedRole) {
  if (!actor || !targetUser) return false;

  const actorRole = String(actor.role || "").trim();
  const targetRole = String(targetUser.role || "").trim();
  const nextRole = String(requestedRole || targetRole).trim();

  if (actorRole === "super_admin") return true;

  if (actorRole === "admin") {
    if (targetRole === "super_admin") return false;
    if (nextRole === "super_admin") return false;
    return true;
  }

  return false;
}

function ensureTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      wallet_balance INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      order_number TEXT,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'pending',
      total_amount INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  try {
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const columnNames = columns.map((c) => c.name);

    if (!columnNames.includes("wallet_balance")) {
      db.exec(`ALTER TABLE users ADD COLUMN wallet_balance INTEGER NOT NULL DEFAULT 0`);
    }
    if (!columnNames.includes("created_at")) {
      db.exec(`ALTER TABLE users ADD COLUMN created_at TEXT`);
      db.exec(`UPDATE users SET created_at = datetime('now', 'localtime') WHERE created_at IS NULL OR created_at = ''`);
    }
    if (!columnNames.includes("updated_at")) {
      db.exec(`ALTER TABLE users ADD COLUMN updated_at TEXT`);
      db.exec(`UPDATE users SET updated_at = datetime('now', 'localtime') WHERE updated_at IS NULL OR updated_at = ''`);
    }
  } catch (error) {
  }
}

function getSessionUser(req, db) {
  const possibleUser =
    req.user ||
    req.session?.user ||
    req.auth?.user ||
    null;

  if (possibleUser && possibleUser.id) {
    const dbUser = db
      .prepare("SELECT id, full_name, email, phone, role FROM users WHERE id = ? LIMIT 1")
      .get(possibleUser.id);
    if (dbUser) return dbUser;
  }

  const directUserId =
    req.session?.user_id ||
    req.session?.userId ||
    req.user_id ||
    null;

  if (directUserId) {
    const dbUser = db
      .prepare("SELECT id, full_name, email, phone, role FROM users WHERE id = ? LIMIT 1")
      .get(directUserId);
    if (dbUser) return dbUser;
  }

  return null;
}

function requireAdmin(req, res, db) {
  const user = getSessionUser(req, db);

  if (!user) {
    sendJson(res, 401, {
      success: false,
      error: "برای دسترسی به این بخش باید وارد حساب مدیر شوی."
    });
    return null;
  }

  if (!["admin", "super_admin"].includes(String(user.role || "").trim())) {
    sendJson(res, 403, {
      success: false,
      error: "دسترسی به این بخش فقط برای مدیران مجاز است."
    });
    return null;
  }

  return user;
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return {};
    }
  }

  return {};
}

function listUsers(req, res, db) {
  const search = sanitizeText(req.query?.search);
  const role = sanitizeText(req.query?.role);

  const where = [];
  const params = {};

  if (search) {
    where.push(`
      (
        u.full_name LIKE @search OR
        u.email LIKE @search OR
        u.phone LIKE @search OR
        CAST(u.id AS TEXT) LIKE @search
      )
    `);
    params.search = `%${search}%`;
  }

  if (role) {
    where.push(`u.role = @role`);
    params.role = role;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = db.prepare(`
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.phone,
      u.role,
      COALESCE(u.wallet_balance, 0) AS wallet_balance,
      COALESCE(COUNT(o.id), 0) AS orders_count,
      u.created_at
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id
    ${whereSql}
    GROUP BY u.id
    ORDER BY u.id DESC
  `).all(params);

  sendJson(res, 200, {
    success: true,
    users: rows
  });
}

function createUser(req, res, db, adminUser, body) {
  const full_name = sanitizeText(body.full_name);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const role = sanitizeText(body.role || "user");
  const password = String(body.password || "");
  const password_confirm = String(body.password_confirm || "");

  if (!full_name || !email || !role || !password || !password_confirm) {
    sendJson(res, 400, {
      success: false,
      error: "همه فیلدهای ضروری را کامل کن."
    });
    return;
  }

  if (!isAllowedRole(role)) {
    sendJson(res, 400, {
      success: false,
      error: "نقش انتخاب‌شده معتبر نیست."
    });
    return;
  }

  if (!canManageTargetRole(adminUser.role, role)) {
    sendJson(res, 403, {
      success: false,
      error: "اجازه ایجاد کاربر با این نقش را نداری."
    });
    return;
  }

  if (password.length < 8) {
    sendJson(res, 400, {
      success: false,
      error: "رمز عبور باید حداقل 8 کاراکتر باشد."
    });
    return;
  }

  if (password !== password_confirm) {
    sendJson(res, 400, {
      success: false,
      error: "رمز عبور و تکرار آن یکسان نیست."
    });
    return;
  }

  const emailExists = db
    .prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1")
    .get(email);

  if (emailExists) {
    sendJson(res, 409, {
      success: false,
      error: "این ایمیل قبلاً ثبت شده است."
    });
    return;
  }

  const password_hash = bcrypt.hashSync(password, 10);

  const insert = db.prepare(`
    INSERT INTO users (
      full_name,
      email,
      phone,
      password_hash,
      role,
      wallet_balance,
      created_at,
      updated_at
    ) VALUES (
      @full_name,
      @email,
      @phone,
      @password_hash,
      @role,
      0,
      datetime('now', 'localtime'),
      datetime('now', 'localtime')
    )
  `);

  const result = insert.run({
    full_name,
    email,
    phone,
    password_hash,
    role
  });

  const createdUser = db.prepare(`
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.phone,
      u.role,
      COALESCE(u.wallet_balance, 0) AS wallet_balance,
      0 AS orders_count,
      u.created_at
    FROM users u
    WHERE u.id = ?
    LIMIT 1
  `).get(result.lastInsertRowid);

  sendJson(res, 200, {
    success: true,
    message: "کاربر جدید با موفقیت ایجاد شد.",
    user: createdUser
  });
}

function updateUser(req, res, db, adminUser, body) {
  const user_id = Number(body.user_id || 0);
  const full_name = sanitizeText(body.full_name);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const role = sanitizeText(body.role);

  if (!user_id || !full_name || !email || !role) {
    sendJson(res, 400, {
      success: false,
      error: "اطلاعات کاربر کامل نیست."
    });
    return;
  }

  if (!isAllowedRole(role)) {
    sendJson(res, 400, {
      success: false,
      error: "نقش انتخاب‌شده معتبر نیست."
    });
    return;
  }

  const currentUser = db
    .prepare("SELECT id, full_name, email, phone, role, wallet_balance, created_at FROM users WHERE id = ? LIMIT 1")
    .get(user_id);

  if (!currentUser) {
    sendJson(res, 404, {
      success: false,
      error: "کاربر موردنظر پیدا نشد."
    });
    return;
  }

  if (!canEditUser(adminUser, currentUser, role)) {
    sendJson(res, 403, {
      success: false,
      error: "اجازه ویرایش این کاربر را نداری."
    });
    return;
  }

  const duplicateEmail = db
    .prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ? LIMIT 1")
    .get(email, user_id);

  if (duplicateEmail) {
    sendJson(res, 409, {
      success: false,
      error: "این ایمیل قبلاً برای کاربر دیگری ثبت شده است."
    });
    return;
  }

  db.prepare(`
    UPDATE users
    SET
      full_name = @full_name,
      email = @email,
      phone = @phone,
      role = @role,
      updated_at = datetime('now', 'localtime')
    WHERE id = @user_id
  `).run({
    user_id,
    full_name,
    email,
    phone,
    role
  });

  const updatedUser = db.prepare(`
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.phone,
      u.role,
      COALESCE(u.wallet_balance, 0) AS wallet_balance,
      COALESCE((
        SELECT COUNT(*)
        FROM orders o
        WHERE o.user_id = u.id
      ), 0) AS orders_count,
      u.created_at
    FROM users u
    WHERE u.id = ?
    LIMIT 1
  `).get(user_id);

  sendJson(res, 200, {
    success: true,
    message: "اطلاعات کاربر با موفقیت ذخیره شد.",
    user: updatedUser
  });
}

module.exports = async function handler(req, res) {
  let db;

  try {
    if (!fs.existsSync(path.dirname(DB_PATH))) {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    }

    db = getDb();
    ensureTables(db);

    const adminUser = requireAdmin(req, res, db);
    if (!adminUser) return;

    if (req.method === "GET") {
      listUsers(req, res, db);
      return;
    }

    if (req.method === "POST") {
      const body = parseBody(req);

      const hasUserId = Number(body.user_id || 0) > 0;

      if (hasUserId) {
        updateUser(req, res, db, adminUser, body);
        return;
      }

      createUser(req, res, db, adminUser, body);
      return;
    }

    sendJson(res, 405, {
      success: false,
      error: "متد درخواست پشتیبانی نمی‌شود."
    });
  } catch (error) {
    sendJson(res, 500, {
      success: false,
      error: "خطای داخلی سرور رخ داد."
    });
  } finally {
    if (db) {
      try {
        db.close();
      } catch (error) {
      }
    }
  }
};