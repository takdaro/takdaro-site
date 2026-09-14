import { getCurrentUser } from "../../lib/admin.js";
import { getCashbackSettings } from "../../lib/cashback-settings.js";
import { expireCashbackForUser, getWalletBreakdown } from "../../lib/cashback-balance.js";

function jsonResponse(response, data) {
  const headers = new Headers(response.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function onRequest(context) {
  let user = null;

  try {
    user = await getCurrentUser(context);
    if (user?.id) {
      await expireCashbackForUser(context.env.DB, user.id);
    }
  } catch (error) {
    console.error("cashback account middleware pre-check failed", error);
  }

  const response = await context.next();
  if (!response.ok || !user?.id) return response;

  const url = new URL(context.request.url);
  const path = url.pathname;

  if (context.request.method === "GET" && path.endsWith("/api/account/wallet")) {
    try {
      const data = await response.clone().json();
      if (!data?.success) return response;

      const [settings, breakdown] = await Promise.all([
        getCashbackSettings(context.env.DB),
        getWalletBreakdown(context.env.DB, user.id)
      ]);

      data.wallet_balance = breakdown.total_balance;
      if (data.user) data.user.wallet_balance = breakdown.total_balance;
      data.cashback_balance = breakdown.cashback_balance;
      data.permanent_balance = breakdown.permanent_balance;
      data.nearest_cashback_expiry = breakdown.nearest_cashback_expiry;
      data.settings = { ...(data.settings || {}), ...settings };

      return jsonResponse(response, data);
    } catch (error) {
      console.error("cashback wallet response enrichment failed", error);
      return response;
    }
  }

  if (context.request.method === "POST" && path.endsWith("/api/account/create-order")) {
    try {
      const data = await response.clone().json();
      if (!data?.success || !data?.order?.id) return response;

      const row = await context.env.DB.prepare(`
        SELECT cashback_amount, cashback_status
        FROM orders
        WHERE id = ?
        LIMIT 1
      `).bind(data.order.id).first();

      if (row) {
        data.order.cashback_amount = Number(row.cashback_amount || 0);
        data.order.cashback_status = row.cashback_status || "none";
      }

      return jsonResponse(response, data);
    } catch (error) {
      console.error("cashback order response correction failed", error);
      return response;
    }
  }

  return response;
}
