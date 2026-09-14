function intValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function percentValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
}

function boolValue(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "on", "yes"].includes(String(value).trim().toLowerCase());
}

function userIds(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(source.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

export async function getCashbackSettings(db) {
  const rows = await db.prepare(`
    SELECT setting_key, setting_value
    FROM app_settings
    WHERE setting_key IN (
      'cashback_enabled',
      'cashback_percent',
      'cashback_statuses',
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
    cashback_percent: percentValue(map.cashback_percent),
    cashback_statuses: String(map.cashback_statuses || "completed")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
    cashback_min_order_amount: intValue(map.cashback_min_order_amount),
    cashback_max_per_order: intValue(map.cashback_max_per_order),
    cashback_eligibility_mode: ["all", "vip", "selected"].includes(mode) ? mode : "all",
    cashback_selected_user_ids: userIds(map.cashback_selected_user_ids),
    cashback_expiry_months: Math.min(12, intValue(map.cashback_expiry_months, 6))
  };
}

export async function saveCashbackSettings(db, body = {}) {
  const current = await getCashbackSettings(db);
  const enabledInput = firstDefined(body.cashback_enabled, body.cashbackEnabled);
  const percentInput = firstDefined(body.cashback_percent, body.cashbackPercent);
  const statusesInput = firstDefined(body.cashback_statuses, body.cashbackStatuses);
  const minInput = firstDefined(body.cashback_min_order_amount, body.cashbackMinOrderAmount);
  const maxInput = firstDefined(body.cashback_max_per_order, body.cashbackMaxPerOrder, body.cashback_max_amount, body.cashbackMaxAmount);
  const modeInput = firstDefined(body.cashback_eligibility_mode, body.cashbackEligibilityMode);
  const selectedInput = firstDefined(body.cashback_selected_user_ids, body.cashbackSelectedUserIds, body.cashback_eligible_user_ids, body.cashbackEligibleUserIds);
  const expiryInput = firstDefined(body.cashback_expiry_months, body.cashbackExpiryMonths);

  const modeRaw = modeInput === undefined ? current.cashback_eligibility_mode : String(modeInput || "all").trim().toLowerCase();
  const mode = ["all", "vip", "selected"].includes(modeRaw) ? modeRaw : "all";
  const values = {
    cashback_enabled: enabledInput === undefined ? current.cashback_enabled : boolValue(enabledInput, false),
    cashback_percent: percentInput === undefined ? current.cashback_percent : percentValue(percentInput),
    cashback_statuses: statusesInput === undefined
      ? current.cashback_statuses
      : (Array.isArray(statusesInput) ? statusesInput : String(statusesInput || "").split(","))
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean),
    cashback_min_order_amount: minInput === undefined ? current.cashback_min_order_amount : intValue(minInput),
    cashback_max_per_order: maxInput === undefined ? current.cashback_max_per_order : intValue(maxInput),
    cashback_eligibility_mode: mode,
    cashback_selected_user_ids: selectedInput === undefined ? current.cashback_selected_user_ids : userIds(selectedInput),
    cashback_expiry_months: expiryInput === undefined ? current.cashback_expiry_months : Math.min(12, intValue(expiryInput))
  };

  const entries = [
    ["cashback_enabled", values.cashback_enabled ? "1" : "0"],
    ["cashback_percent", values.cashback_percent],
    ["cashback_statuses", values.cashback_statuses.length ? values.cashback_statuses.join(",") : "completed"],
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
