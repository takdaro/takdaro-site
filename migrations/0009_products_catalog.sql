PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  price INTEGER,
  price_label TEXT NOT NULL DEFAULT 'تماس بگیرید',
  show_price INTEGER NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  in_stock INTEGER NOT NULL DEFAULT 1,
  stock_label TEXT NOT NULL DEFAULT 'موجود',
  short_description TEXT,
  description TEXT,
  primary_image TEXT,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (show_price IN (0, 1)),
  CHECK (in_stock IN (0, 1)),
  CHECK (status IN ('published', 'draft', 'private'))
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CHECK (is_primary IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_products_slug
ON products(slug);

CREATE INDEX IF NOT EXISTS idx_products_status
ON products(status);

CREATE INDEX IF NOT EXISTS idx_products_category
ON products(category);

CREATE INDEX IF NOT EXISTS idx_products_updated_at
ON products(updated_at);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
ON product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_sort_order
ON product_images(product_id, is_primary DESC, sort_order ASC);