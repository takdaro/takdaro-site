PRAGMA foreign_keys = ON;

-- Phase 1: cashback controls + separate cashback ledger.
-- Existing wallet balances are intentionally preserved as permanent balance.

INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
VALUES ('cashback_enabled', '1');

INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
VALUES ('cashback_min_order_amount', '0');

INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
VALUES ('cashback_max_per_order', '0');

INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
VALUES ('cashback_eligibility_mode', 'all');

INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
VALUES ('cashback_expiry_months', '6');

INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
VALUES ('cashback_expiry_mode', 'rolling');

CREATE TABLE IF NOT EXISTS wallet_balances (
  user_id INTEGER PRIMARY KEY,
  permanent_balance INTEGER NOT NULL DEFAULT 0,
  cashback_balance INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Preserve every existing wallet balance by classifying it as permanent.
INSERT OR IGNORE INTO wallet_balances (
  user_id,
  permanent_balance,
  cashback_balance,
  updated_at
)
SELECT
  id,
  COALESCE(wallet_balance, 0),
  0,
  CURRENT_TIMESTAMP
FROM users;

CREATE TABLE IF NOT EXISTS cashback_eligible_users (
  user_id INTEGER PRIMARY KEY,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cashback_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  order_number TEXT,
  original_amount INTEGER NOT NULL,
  remaining_amount INTEGER NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cashback_lots_user_status_expiry
ON cashback_lots(user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_cashback_lots_order_id
ON cashback_lots(order_id);

CREATE TABLE IF NOT EXISTS wallet_consumptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_transaction_id INTEGER,
  user_id INTEGER NOT NULL,
  source_bucket TEXT NOT NULL,
  cashback_lot_id INTEGER,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_transaction_id) REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (cashback_lot_id) REFERENCES cashback_lots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_consumptions_txn
ON wallet_consumptions(wallet_transaction_id);

CREATE INDEX IF NOT EXISTS idx_wallet_consumptions_user
ON wallet_consumptions(user_id);