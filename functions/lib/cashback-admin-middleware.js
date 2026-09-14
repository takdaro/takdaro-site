import { getCashbackSettings, saveCashbackSettings } from "./cashback-settings.js";
import { getWalletBreakdown } from "./cashback-balance.js";

function jsonResponse(response, data) {
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function isWalletPath(pathname) {
  return pathname.endsWith("/api/admin/wallet") || pathname.endsWith("/api/v1/admin/wallet");
}

export async function handleCashbackAdminMiddleware(context) {
  const url = new URL(context.request.url);
  if (!isWalletPath(url.pathname)) return context.next();

  let requestBody = null;
  if (context.request.method === "POST") {
    requestBody = await context.request.clone().json().catch(() => null);
  }

  const response = await context.next();
  if (!response.ok) return response;

  try {
    let data = await response.clone().json();
    if (!data?.success) return response;

    if (
      context.request.method === "POST" &&
      String(requestBody?.action || "").trim().toLowerCase() === "save_settings"
    ) {
      await saveCashbackSettings(context.env.DB, requestBody || {});
    }

    const settings = await getCashbackSettings(context.env.DB);
    data.settings = { ...(data.settings || {}), ...settings };

    const userId = Number(url.searchParams.get("user_id") || url.searchParams.get("userId") || 0);
    if (context.request.method === "GET" && userId > 0 && data.user) {
      const breakdown = await getWalletBreakdown(context.env.DB, userId);
      data.user.wallet_balance = breakdown.total_balance;
      data.user.cashback_balance = breakdown.cashback_balance;
      data.user.permanent_balance = breakdown.permanent_balance;
      data.user.nearest_cashback_expiry = breakdown.nearest_cashback_expiry;
    }

    return jsonResponse(response, data);
  } catch (error) {
    console.error("cashback admin middleware failed", error);
    return response;
  }
}
