-- users.wallet_balance
ALTER TABLE users ADD COLUMN wallet_balance INTEGER NOT NULL DEFAULT 0;

-- orders wallet/cashback fields
ALTER TABLE orders ADD COLUMN wallet_used_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN wallet_applied INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN cashback_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN cashback_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN cashback_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE orders ADD COLUMN cashback_created_txn_id INTEGER;
ALTER TABLE orders ADD COLUMN cashback_created_at TEXT;

-- wallet_transactions: create if missing with the superset structure used by both account/admin APIs
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
  updated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id
ON wallet_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_id
ON wallet_transactions(order_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_number
ON wallet_transactions(order_number);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference
ON wallet_transactions(reference_type, reference_id);

-- app_settings in the shape admin/wallet.js uses
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
VALUES ('cashback_percent', '0');

INSERT OR IGNORE INTO app_settings (setting_key, setting_value)
VALUES ('cashback_statuses', 'completed,processing');