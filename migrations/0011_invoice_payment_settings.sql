-- Invoice Settings table
CREATE TABLE IF NOT EXISTS invoice_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  thank_you_message TEXT DEFAULT 'از خرید شما سپاسگزاریم!',
  logo_url TEXT DEFAULT '/assets/images/logo.png',
  show_payment_info BOOLEAN DEFAULT 1,
  show_whatsapp_button BOOLEAN DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payment Information table
CREATE TABLE IF NOT EXISTS payment_info (
  id INTEGER PRIMARY CHECK (id = 1),
  account_holder_name TEXT,
  bank_name TEXT,
  card_number TEXT,
  shaba_number TEXT,
  payment_deadline_hours INTEGER DEFAULT 24,
  payment_description TEXT,
  whatsapp_number TEXT DEFAULT '+989214147070',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize default values
INSERT OR IGNORE INTO invoice_settings (id, thank_you_message, logo_url) 
VALUES (1, 'از خرید شما سپاسگزاریم!', '/assets/images/logo.png');

INSERT OR IGNORE INTO payment_info (id, payment_deadline_hours, whatsapp_number) 
VALUES (1, 24, '+989214147070');