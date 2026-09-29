CREATE TABLE IF NOT EXISTS chat_users (id INTEGER PRIMARY KEY AUTOINCREMENT, site_user_id INTEGER UNIQUE, phone_hash TEXT, email TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (site_user_id) REFERENCES users(id) ON DELETE SET NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_users_phone_hash ON chat_users(phone_hash) WHERE phone_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_users_email ON chat_users(email);
CREATE TABLE IF NOT EXISTS chat_identity_tokens (token_hash TEXT PRIMARY KEY, site_user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (site_user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS idx_chat_identity_tokens_expiry ON chat_identity_tokens(expires_at);
