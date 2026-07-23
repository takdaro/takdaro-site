PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS wallet_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cashback_percent INTEGER NOT NULL DEFAULT 0,
  cashback_statuses TEXT NOT NULL DEFAULT 'completed',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO wallet_settings (
  id,
  cashback_percent,
  cashback_statuses,
  updated_at
) VALUES (
  1,
  0,
  'completed',
  CURRENT_TIMESTAMP
);