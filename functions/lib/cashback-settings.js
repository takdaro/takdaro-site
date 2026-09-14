function intValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function boolValue(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "on", "yes"].includes(String(value).trim().toLowerCase());
}

function userIds(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(source.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

export async function getCashbackSettings(db) {
  const rows = await db.prepare(`
    SELECT setting_key, setting_value
    FROM app_settings
    WHERE setting_key IN (
      'cashback_enabled',
      'cashback_min_order_amount',
      'cashback_max_per_order',
      'cashback_eligibility_mode',
      'cashback_selected_user_ids',
      'cashback_expiry_months'
    )
  `).all();

  const map = Object.fromEntries((rows?.results || []).map((row) => [row.setting_key, row.setting_value]));
  const mode = String(map.cashback_eligibility_mode || "all").trim().toLowerCase();

  return {
    cashback_enabled: boolValue(map.cashback_enabled, true),
    cashback_min_order_amount: intValue(map.cashback_min_order_amount),
    cashback_max_per_order: intValue(map.cashback_max_per_order),
    cashback_eligibility_mode: ["all", "vip", "selected"].includes(mode) ? mode : "all",
    cashback_selected_user_ids: userIds(map.cashback_selected_user_ids),
    cashback_expiry_months: Math.min(12, intValue(map.cashback_expiry_months, 6))
  };
}

export async function saveCashbackSettings(db, body = {}) {
  const current = await getCashbackSettings(db);
  const modeRaw = body.cashback_eligibility_mode === undefined ? current.cashback_eligibility_mode : String(body.cashback_eligibility_mode || "all").trim().toLowerCase();
  const mode = ["all", "vip", "selected"].includes(modeRaw) ? modeRaw : "all";
  const values = {
    cashback_enabled: body.cashback_enabled === undefined ? current.cashback_enabled : boolValue(body.cashback_enabled, false),
    cashback_min_order_amount: body.cashback_min_order_amount === undefined ? current.cashback_min_order_amount : intValue(body.cashback_min_order_amount),
    cashback_max_per_order: body.cashback_max_per_order === undefined ? current.cashback_max_per_order : intValue(body.cashback_max_per_order),
    cashback_eligibility_mode: mode,
    cashback_selected_user_ids: body.cashback_selected_user_ids === undefined ? current.cashback_selected_user_ids : userIds(body.cashback_selected_user_ids),
    cashback_expiry_months: body.cashback_expiry_months === undefined ? current.cashback_expiry_months : Math.min(12, intValue(body.cashback_expiry_months))
  };

  const entries = [
    ["cashback_enabled", values.cashback_enabled ? "1" : "0"],
    ["cashback_min_order_amount", values.cashback_min_order_amount],
    ["cashback_max_per_order", values.cashback_max_per_order],
    ["cashback_eligibility_mode", values.cashback_eligibility_mode],
    ["cashback_selected_user_ids", values.cashback_selected_user_ids.join(",")],
    ["cashback_expiry_months", values.cashback_expiry_months]
  ];

  for (const [key, value] of entries) {
    await db.prepare(`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP
    `).bind(key, String(value)).run();
  }

  return getCashbackSettings(db);
}
