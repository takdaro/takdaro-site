CREATE TABLE IF NOT EXISTS telegram_support_sessions (
  customer_chat_id TEXT PRIMARY KEY,
  is_open INTEGER NOT NULL DEFAULT 1,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);
