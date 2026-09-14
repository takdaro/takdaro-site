PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_enabled', '1');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_min_order_amount', '0');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_max_per_order', '0');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_eligibility_mode', 'all');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_selected_user_ids', '');
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES ('cashback_expiry_months', '6');

ALTER TABLE wallet_transactions ADD COLUMN remaining_amount INTEGER;
ALTER TABLE wallet_transactions ADD COLUMN expires_at TEXT;
ALTER TABLE wallet_transactions ADD COLUMN expired_at TEXT;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_cashback_expiry
ON wallet_transactions(user_id, type, status, expires_at);

CREATE TRIGGER IF NOT EXISTS trg_wallet_cashback_expiry_init
AFTER INSERT ON wallet_transactions
WHEN NEW.type = 'cashback' AND NEW.status = 'completed'
BEGIN
  UPDATE wallet_transactions
  SET remaining_amount = ABS(COALESCE(NEW.amount, 0)),
      expires_at = CASE
        WHEN CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_expiry_months'), '0') AS INTEGER) > 0
        THEN DATETIME(CURRENT_TIMESTAMP, '+' || CAST(COALESCE((SELECT setting_value FROM app_settings WHERE setting_key = 'cashback_expiry_months'), '0') AS INTEGER) || ' months')
        ELSE NULL
      END,
      expired_at = NULL
  WHERE id = NEW.id;
END;