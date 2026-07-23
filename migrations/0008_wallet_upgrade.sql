PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'shipping',
  full_name TEXT NOT NULL,
  address_line TEXT NOT NULL,
  postal_code TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_type ON user_addresses(type);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON user_addresses(user_id, is_default);

INSERT INTO user_addresses (
  user_id,
  type,
  full_name,
  address_line,
  postal_code,
  phone,
  city,
  state,
  is_default,
  created_at,
  updated_at
)
SELECT
  user_id,
  COALESCE(type, 'shipping'),
  full_name,
  address_line,
  postal_code,
  phone,
  city,
  state,
  CASE WHEN is_default IS NULL THEN 0 ELSE is_default END,
  COALESCE(created_at, CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM addresses
WHERE NOT EXISTS (
  SELECT 1 FROM user_addresses
);

ALTER TABLE orders ADD COLUMN address_id INTEGER;
ALTER TABLE orders ADD COLUMN subtotal_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN wallet_used_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN cashback_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN cashback_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE orders ADD COLUMN notes TEXT;

UPDATE orders
SET subtotal_amount = total_amount - COALESCE(shipping_amount, 0) + COALESCE(discount_amount, 0)
WHERE subtotal_amount = 0 OR subtotal_amount IS NULL;

UPDATE orders
SET address_id = (
  SELECT ua.id
  FROM user_addresses ua
  JOIN addresses a ON a.user_id = ua.user_id
  WHERE a.id = orders.shipping_address_id
    AND ua.address_line = a.address_line
  ORDER BY ua.id ASC
  LIMIT 1
)
WHERE address_id IS NULL
  AND shipping_address_id IS NOT NULL;

ALTER TABLE order_items ADD COLUMN product_id INTEGER;
ALTER TABLE order_items ADD COLUMN updated_at TEXT;

UPDATE order_items
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE wallet_transactions ADD COLUMN description TEXT;
ALTER TABLE wallet_transactions ADD COLUMN order_id INTEGER;
ALTER TABLE wallet_transactions ADD COLUMN order_number TEXT;
ALTER TABLE wallet_transactions ADD COLUMN updated_at TEXT;

UPDATE wallet_transactions
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_id ON wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);