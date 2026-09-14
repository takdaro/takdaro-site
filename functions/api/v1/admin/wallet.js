import {
  onRequestGet as legacyGet,
  onRequestPost as legacyPost
} from "../../admin/wallet";
import { getCashbackSettings, saveCashbackSettings } from "../../../lib/cashback-settings.js";
import { getWalletBreakdown } from "../../../lib/cashback-balance.js";

function jsonResponse(response, data) {
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function onRequestGet(context) {
  const response = await legacyGet(context);
  if (!response.ok) return response;

  try {
    const data = await response.clone().json();
    if (!data?.success) return response;

    data.settings = {
      ...(data.settings || {}),
      ...(await getCashbackSettings(context.env.DB))
    };

    const url = new URL(context.request.url);
    const userId = Number(url.searchParams.get("user_id") || url.searchParams.get("userId") || 0);
    if (userId > 0 && data.user) {
      const breakdown = await getWalletBreakdown(context.env.DB, userId);
      data.user.wallet_balance = breakdown.total_balance;
      data.user.cashback_balance = breakdown.cashback_balance;
      data.user.permanent_balance = breakdown.permanent_balance;
      data.user.nearest_cashback_expiry = breakdown.nearest_cashback_expiry;
    }

    return jsonResponse(response, data);
  } catch (_) {
    return response;
  }
}

export async function onRequestPost(context) {
  const body = await context.request.clone().json().catch(() => null);
  const response = await legacyPost(context);
  if (!response.ok || !body || typeof body !== "object") return response;

  try {
    const data = await response.clone().json();
    if (!data?.success) return response;

    if (String(body.action || "").trim().toLowerCase() === "save_settings") {
      const settings = await saveCashbackSettings(context.env.DB, body);
      data.settings = { ...(data.settings || {}), ...settings };
    }

    return jsonResponse(response, data);
  } catch (_) {
    return response;
  }
}
