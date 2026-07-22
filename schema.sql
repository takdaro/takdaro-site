CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  wallet_balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'shipping',
  full_name TEXT NOT NULL,
  address_line TEXT NOT NULL,
  postal_code TEXT,
  phone TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount INTEGER NOT NULL DEFAULT 0,
  shipping_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  shipping_address_id INTEGER,
  billing_address_id INTEGER,
  cashback_amount INTEGER NOT NULL DEFAULT 0,
  cashback_percent REAL NOT NULL DEFAULT 0,
  cashback_status TEXT NOT NULL DEFAULT 'none',
  cashback_created_txn_id INTEGER,
  cashback_created_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (shipping_address_id) REFERENCES addresses(id),
  FOREIGN KEY (billing_address_id) REFERENCES addresses(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

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
  order_id INTEGER,
  order_number TEXT,
  admin_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (admin_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_cashback_status ON orders(cashback_status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_id ON wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_cashback_once_per_order
ON wallet_transactions(order_id, type)
WHERE type = 'cashback';