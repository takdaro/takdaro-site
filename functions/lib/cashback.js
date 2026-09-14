export async function getCashbackSettings(db) {
  const defaults = {
    cashback_enabled: true,
    cashback_percent: 0,
    cashback_statuses: ["completed"],
    cashback_min_order_amount: 0,
    cashback_max_per_order: 0,
    cashback_eligibility_mode: "all",
    cashback_selected_user_ids: [],
    cashback_expiry_months: 6
  };

  try {
    const rows = await db.prepare(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'cashback_%'`).all();
    const map = {};
    for (const row of rows?.results || []) map[String(row.setting_key || "")] = row.setting_value;

    let statuses = String(map.cashback_statuses || "completed").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!statuses.length) statuses = ["completed"];

    const selected = String(map.cashback_selected_user_ids || "").split(",").map((v) => Number(v.trim())).filter((v) => Number.isInteger(v) && v > 0);
    const enabled = !["0", "false", "off", "no"].includes(String(map.cashback_enabled ?? "1").trim().toLowerCase());
    const mode = ["all", "vip", "selected"].includes(String(map.cashback_eligibility_mode || "all").toLowerCase()) ? String(map.cashback_eligibility_mode || "all").toLowerCase() : "all";

    return {
      cashback_enabled: enabled,
      cashback_percent: Math.min(100, Math.max(0, Number(map.cashback_percent || 0) || 0)),
      cashback_statuses: [...new Set(statuses)],
      cashback_min_order_amount: Math.max(0, Math.round(Number(map.cashback_min_order_amount || 0) || 0)),
      cashback_max_per_order: Math.max(0, Math.round(Number(map.cashback_max_per_order || 0) || 0)),
      cashback_eligibility_mode: mode,
      cashback_selected_user_ids: [...new Set(selected)],
      cashback_expiry_months: Math.min(12, Math.max(0, Math.round(Number(map.cashback_expiry_months || 6) || 0)))
    };
  } catch (_) {
    return defaults;
  }
}

export function isCashbackEligible(settings, user) {
  if (!settings?.cashback_enabled || !user?.id) return false;
  if (settings.cashback_eligibility_mode === "all") return true;
  if (settings.cashback_eligibility_mode === "vip") return String(user.role || "").toLowerCase() === "vip";
  return (settings.cashback_selected_user_ids || []).includes(Number(user.id));
}

export function calculateCashback(settings, user, orderTotal, payableAmount) {
  const total = Math.max(0, Math.round(Number(orderTotal || 0) || 0));
  const base = Math.max(0, Math.round(Number(payableAmount || 0) || 0));
  if (!isCashbackEligible(settings, user)) return 0;
  if (total < Number(settings?.cashback_min_order_amount || 0)) return 0;
  if (base <= 0 || Number(settings?.cashback_percent || 0) <= 0) return 0;
  let amount = Math.round(base * Number(settings.cashback_percent) / 100);
  const cap = Math.max(0, Math.round(Number(settings?.cashback_max_per_order || 0) || 0));
  if (cap > 0) amount = Math.min(amount, cap);
  return Math.max(0, amount);
}
