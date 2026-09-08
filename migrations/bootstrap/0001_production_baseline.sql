-- TAKDARO BOOTSTRAP MIGRATION 0001
-- Creates the verified 2026-09-08 Production-equivalent schema on a NEW, EMPTY D1 database.
-- This nested migration is intentionally excluded from the existing Production migration runner.
-- Never execute it against takdaro-users-prod or any database that already contains application tables.

PRAGMA foreign_keys = ON;

-- table: addresses
CREATE TABLE addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('billing', 'shipping')),
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

-- table: admin_activity_logs
CREATE TABLE admin_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      description TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

-- table: admin_mobile_devices
CREATE TABLE admin_mobile_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id INTEGER NOT NULL,

  device_id TEXT NOT NULL UNIQUE,
  push_token TEXT NOT NULL UNIQUE,

  platform TEXT NOT NULL DEFAULT 'android',
  device_name TEXT,
  app_version TEXT,

  is_active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- table: admin_mobile_notification_logs
CREATE TABLE admin_mobile_notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  device_id INTEGER,
  user_id INTEGER,

  event_type TEXT NOT NULL,

  title TEXT,
  body TEXT,

  data TEXT,

  status TEXT NOT NULL DEFAULT 'pending',

  error_message TEXT,

  order_id INTEGER,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,

  FOREIGN KEY (device_id)
    REFERENCES admin_mobile_devices(id)
    ON DELETE SET NULL,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE SET NULL
);

-- table: admin_mobile_sessions
CREATE TABLE admin_mobile_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, last_used_at TEXT, revoked_at TEXT, device_name TEXT, device_id TEXT, user_agent TEXT, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);

-- table: app_settings
CREATE TABLE app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

-- table: notification_logs
CREATE TABLE notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT,
  subject TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  order_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT, user_id INTEGER, is_user_notification INTEGER DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- table: notification_settings
CREATE TABLE notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL UNIQUE,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  config TEXT,
  updated_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- table: order_items
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, product_id INTEGER, updated_at TEXT, rate_at_purchase INTEGER, currency_code TEXT DEFAULT 'USD',
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- table: orders
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  shipping_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, billing_address_id INTEGER, shipping_address_id INTEGER, address_id INTEGER, subtotal_amount INTEGER NOT NULL DEFAULT 0, wallet_used_amount INTEGER NOT NULL DEFAULT 0, cashback_amount INTEGER NOT NULL DEFAULT 0, cashback_status TEXT NOT NULL DEFAULT 'none', notes TEXT, payable_amount INTEGER DEFAULT 0, shipping_method TEXT, shipping_method_id INTEGER, wallet_applied INTEGER NOT NULL DEFAULT 0, cashback_percent INTEGER NOT NULL DEFAULT 0, cashback_created_txn_id INTEGER, cashback_created_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- table: product_images
CREATE TABLE product_images (
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

-- table: products
CREATE TABLE products (
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
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, price_type TEXT DEFAULT 'fixed', base_price INTEGER, profit_type TEXT DEFAULT 'none', profit_value INTEGER, fixed_fee INTEGER, rounding_type TEXT DEFAULT 'none', rounding_method TEXT DEFAULT 'nearest', calculated_price INTEGER, price_calculated_at TEXT,
  CHECK (show_price IN (0, 1)),
  CHECK (in_stock IN (0, 1)),
  CHECK (status IN ('published', 'draft', 'private'))
);

-- table: push_subscriptions
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id INTEGER NOT NULL,

  endpoint TEXT NOT NULL UNIQUE,

  p256dh TEXT NOT NULL,

  auth TEXT NOT NULL,

  user_agent TEXT,

  is_active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  last_used_at TEXT,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- table: rate_history
CREATE TABLE rate_history (id INTEGER PRIMARY KEY AUTOINCREMENT, rate_id INTEGER NOT NULL, rate INTEGER NOT NULL, source_type TEXT NOT NULL, changed_by_user_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

-- table: rates
CREATE TABLE rates (id INTEGER PRIMARY KEY AUTOINCREMENT, currency_code TEXT NOT NULL UNIQUE, currency_name TEXT NOT NULL, rate INTEGER NOT NULL, source_type TEXT NOT NULL DEFAULT 'manual', is_active INTEGER NOT NULL DEFAULT 1, updated_by_user_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

-- table: sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- table: shipping_costs
CREATE TABLE shipping_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  shipping_method_id INTEGER NOT NULL,
  cost_type TEXT NOT NULL DEFAULT 'fixed',
  cost_amount INTEGER NOT NULL DEFAULT 0,
  delivery_time TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, extra_cost INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON DELETE CASCADE,
  UNIQUE(province, city, shipping_method_id)
);

-- table: shipping_free_thresholds
CREATE TABLE shipping_free_thresholds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipping_method_id INTEGER NOT NULL,
  min_order_amount INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON DELETE CASCADE
);

-- table: shipping_methods
CREATE TABLE shipping_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  delivery_time TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, default_cost INTEGER NOT NULL DEFAULT 0);

-- table: sms_gateway_logs
CREATE TABLE sms_gateway_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, direction TEXT NOT NULL, message_id TEXT, gateway_action TEXT NOT NULL, request_payload TEXT, response_payload TEXT, status TEXT NOT NULL, error_message TEXT, duration_ms INTEGER, gateway_ip TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

-- table: sms_inbox
CREATE TABLE sms_inbox (id INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT UNIQUE NOT NULL, sender TEXT NOT NULL, recipient TEXT NOT NULL, message TEXT NOT NULL, received_at TEXT NOT NULL, processed BOOLEAN DEFAULT 0, processed_at TEXT, processed_by TEXT, status TEXT DEFAULT 'received', reference_id TEXT, reference_type TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

-- table: sms_outbox
CREATE TABLE sms_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT UNIQUE NOT NULL, recipient TEXT NOT NULL, message TEXT NOT NULL, sender TEXT DEFAULT '', priority INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', retry_count INTEGER DEFAULT 0, max_retry INTEGER DEFAULT 3, event_type TEXT, reference_id TEXT, reference_type TEXT, error_message TEXT, sent_at TEXT, created_by_user_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

-- table: sms_settings
CREATE TABLE sms_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, is_enabled BOOLEAN DEFAULT 0, admin_phone TEXT, gateway_url TEXT DEFAULT 'https://your-domain.com/api/sms', polling_interval INTEGER DEFAULT 30, max_sms_per_minute INTEGER DEFAULT 10, retry_interval INTEGER DEFAULT 300, default_sender TEXT, event_order_created_admin BOOLEAN DEFAULT 1, event_order_created_user BOOLEAN DEFAULT 0, event_order_status_changed_user BOOLEAN DEFAULT 0, event_payment_success_admin BOOLEAN DEFAULT 1, event_payment_success_user BOOLEAN DEFAULT 0, event_order_cancelled_user BOOLEAN DEFAULT 0, extra_config TEXT, updated_by_user_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, event_payment_review_user INTEGER DEFAULT 1);

-- table: sms_templates
CREATE TABLE sms_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL UNIQUE, title TEXT NOT NULL, message_template TEXT NOT NULL, is_enabled BOOLEAN DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

-- table: telegram_tokens
CREATE TABLE telegram_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  is_used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT DEFAULT (datetime('now', '+10 minutes')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- table: user_addresses
CREATE TABLE user_addresses (
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

-- table: user_notification_preferences
CREATE TABLE user_notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  order_created INTEGER DEFAULT 1,
  payment_success INTEGER DEFAULT 1,
  payment_failed INTEGER DEFAULT 1,
  order_status_changed INTEGER DEFAULT 1,
  order_preparing INTEGER DEFAULT 1,
  order_shipped INTEGER DEFAULT 1,
  tracking_code_added INTEGER DEFAULT 1,
  order_completed INTEGER DEFAULT 1,
  order_cancelled INTEGER DEFAULT 1,
  announcements INTEGER DEFAULT 0,
  promotions INTEGER DEFAULT 0,
  marketing INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- table: user_telegram_connections
CREATE TABLE user_telegram_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  chat_id TEXT NOT NULL UNIQUE,
  telegram_user_id TEXT,
  telegram_username TEXT,
  first_name TEXT,
  last_name TEXT,
  is_active INTEGER DEFAULT 1,
  connected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  disconnected_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- table: users
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, phone TEXT, mobile TEXT, role TEXT DEFAULT 'user', wallet_balance INTEGER DEFAULT 0, updated_at TEXT, access_code_hash TEXT);

-- table: wallet_settings
CREATE TABLE wallet_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cashback_percent INTEGER NOT NULL DEFAULT 0,
  cashback_statuses TEXT NOT NULL DEFAULT 'completed',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- table: wallet_transactions
CREATE TABLE wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL DEFAULT 0,
      balance_after INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      reference_type TEXT,
      reference_id TEXT,
      note TEXT,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , source TEXT, description TEXT, order_id INTEGER, order_number TEXT, updated_at TEXT);

-- index: idx_addresses_type
CREATE INDEX idx_addresses_type ON addresses(type);

-- index: idx_addresses_user_id
CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- index: idx_admin_mobile_devices_active
CREATE INDEX idx_admin_mobile_devices_active
ON admin_mobile_devices(is_active);

-- index: idx_admin_mobile_devices_device_id
CREATE INDEX idx_admin_mobile_devices_device_id
ON admin_mobile_devices(device_id);

-- index: idx_admin_mobile_devices_user_id
CREATE INDEX idx_admin_mobile_devices_user_id
ON admin_mobile_devices(user_id);

-- index: idx_admin_mobile_notification_logs_created
CREATE INDEX idx_admin_mobile_notification_logs_created
ON admin_mobile_notification_logs(created_at);

-- index: idx_admin_mobile_notification_logs_event
CREATE INDEX idx_admin_mobile_notification_logs_event
ON admin_mobile_notification_logs(event_type);

-- index: idx_admin_mobile_notification_logs_order
CREATE INDEX idx_admin_mobile_notification_logs_order
ON admin_mobile_notification_logs(order_id);

-- index: idx_admin_mobile_notification_logs_status
CREATE INDEX idx_admin_mobile_notification_logs_status
ON admin_mobile_notification_logs(status);

-- index: idx_admin_mobile_sessions_expires_at
CREATE INDEX idx_admin_mobile_sessions_expires_at ON admin_mobile_sessions(expires_at);

-- index: idx_admin_mobile_sessions_revoked_at
CREATE INDEX idx_admin_mobile_sessions_revoked_at ON admin_mobile_sessions(revoked_at);

-- index: idx_admin_mobile_sessions_token_hash
CREATE INDEX idx_admin_mobile_sessions_token_hash ON admin_mobile_sessions(token_hash);

-- index: idx_admin_mobile_sessions_user_id
CREATE INDEX idx_admin_mobile_sessions_user_id ON admin_mobile_sessions(user_id);

-- index: idx_notification_logs_created_at
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);

-- index: idx_notification_logs_event_channel
CREATE INDEX idx_notification_logs_event_channel ON notification_logs(event_type, channel);

-- index: idx_notification_logs_order_id
CREATE INDEX idx_notification_logs_order_id ON notification_logs(order_id);

-- index: idx_notification_logs_status
CREATE INDEX idx_notification_logs_status ON notification_logs(status);

-- index: idx_notification_logs_user_id
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);

-- index: idx_notification_settings_channel
CREATE INDEX idx_notification_settings_channel ON notification_settings(channel);

-- index: idx_order_items_order_id
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- index: idx_order_items_product_id
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- index: idx_orders_created_at
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- index: idx_orders_order_number
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- index: idx_orders_payment_status
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- index: idx_orders_status
CREATE INDEX idx_orders_status ON orders(status);

-- index: idx_orders_user_id
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- index: idx_product_images_product_id
CREATE INDEX idx_product_images_product_id
ON product_images(product_id);

-- index: idx_product_images_sort_order
CREATE INDEX idx_product_images_sort_order
ON product_images(product_id, is_primary DESC, sort_order ASC);

-- index: idx_products_category
CREATE INDEX idx_products_category
ON products(category);

-- index: idx_products_slug
CREATE INDEX idx_products_slug
ON products(slug);

-- index: idx_products_status
CREATE INDEX idx_products_status
ON products(status);

-- index: idx_products_updated_at
CREATE INDEX idx_products_updated_at
ON products(updated_at);

-- index: idx_push_subscriptions_active
CREATE INDEX idx_push_subscriptions_active
ON push_subscriptions(is_active);

-- index: idx_push_subscriptions_user_id
CREATE INDEX idx_push_subscriptions_user_id
ON push_subscriptions(user_id);

-- index: idx_sessions_user_id
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- index: idx_shipping_costs_method
CREATE INDEX idx_shipping_costs_method ON shipping_costs(shipping_method_id);

-- index: idx_shipping_costs_province_city
CREATE INDEX idx_shipping_costs_province_city ON shipping_costs(province, city);

-- index: idx_shipping_methods_active
CREATE INDEX idx_shipping_methods_active ON shipping_methods(is_active);

-- index: idx_sms_templates_event_type
CREATE INDEX idx_sms_templates_event_type ON sms_templates(event_type);

-- index: idx_sms_templates_is_enabled
CREATE INDEX idx_sms_templates_is_enabled ON sms_templates(is_enabled);

-- index: idx_telegram_tokens_expires_at
CREATE INDEX idx_telegram_tokens_expires_at ON telegram_tokens(expires_at);

-- index: idx_telegram_tokens_is_used
CREATE INDEX idx_telegram_tokens_is_used ON telegram_tokens(is_used);

-- index: idx_telegram_tokens_token_hash
CREATE INDEX idx_telegram_tokens_token_hash ON telegram_tokens(token_hash);

-- index: idx_telegram_tokens_user_id
CREATE INDEX idx_telegram_tokens_user_id ON telegram_tokens(user_id);

-- index: idx_user_addresses_default
CREATE INDEX idx_user_addresses_default ON user_addresses(user_id, is_default);

-- index: idx_user_addresses_type
CREATE INDEX idx_user_addresses_type ON user_addresses(type);

-- index: idx_user_addresses_user_id
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);

-- index: idx_user_prefs_user_id
CREATE INDEX idx_user_prefs_user_id ON user_notification_preferences(user_id);

-- index: idx_user_telegram_active
CREATE INDEX idx_user_telegram_active ON user_telegram_connections(is_active);

-- index: idx_user_telegram_chat_id
CREATE INDEX idx_user_telegram_chat_id ON user_telegram_connections(chat_id);

-- index: idx_user_telegram_user_id
CREATE INDEX idx_user_telegram_user_id ON user_telegram_connections(user_id);

-- index: idx_users_email
CREATE INDEX idx_users_email ON users(email);

-- index: idx_users_phone
CREATE INDEX idx_users_phone ON users(phone);

-- index: idx_wallet_transactions_created_at
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at);

-- index: idx_wallet_transactions_order_id
CREATE INDEX idx_wallet_transactions_order_id ON wallet_transactions(order_id);

-- index: idx_wallet_transactions_order_number
CREATE INDEX idx_wallet_transactions_order_number ON wallet_transactions(order_number);

-- index: idx_wallet_transactions_reference
CREATE INDEX idx_wallet_transactions_reference ON wallet_transactions(reference_type, reference_id);

-- index: idx_wallet_transactions_status
CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);

-- index: idx_wallet_transactions_type
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(type);

-- index: idx_wallet_transactions_user_id
CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);

