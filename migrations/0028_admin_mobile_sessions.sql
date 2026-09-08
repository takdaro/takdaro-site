-- ============================================
-- 0028_admin_mobile_sessions.sql
-- Session مستقل برای اپ مدیریت Android
-- ============================================

CREATE TABLE IF NOT EXISTS admin_mobile_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id INTEGER NOT NULL,

  token_hash TEXT NOT NULL UNIQUE,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  expires_at TEXT NOT NULL,

  last_used_at TEXT,

  revoked_at TEXT,

  device_name TEXT,

  device_id TEXT,

  user_agent TEXT,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- ============================================
-- Indexها
-- ============================================

CREATE INDEX IF NOT EXISTS idx_admin_mobile_sessions_user_id
ON admin_mobile_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_admin_mobile_sessions_token_hash
ON admin_mobile_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_admin_mobile_sessions_expires_at
ON admin_mobile_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_mobile_sessions_revoked_at
ON admin_mobile_sessions(revoked_at);