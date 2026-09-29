ALTER TABLE products ADD COLUMN purchase_min_quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN purchase_max_quantity INTEGER;

CREATE INDEX IF NOT EXISTS idx_products_purchase_limits
ON products(purchase_min_quantity, purchase_max_quantity);
