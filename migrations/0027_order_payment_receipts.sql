ALTER TABLE orders ADD COLUMN receipt_file_id TEXT;
ALTER TABLE orders ADD COLUMN receipt_uploaded_at TEXT;
ALTER TABLE orders ADD COLUMN receipt_status TEXT NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_orders_receipt_uploaded_at
  ON orders(receipt_uploaded_at);
