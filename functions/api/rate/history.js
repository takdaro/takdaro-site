import { getRateHistory } from "../../lib/rate";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=60"
    }
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatDate(value) {
  if (!value) return "-";
  try {
    const normalized = String(value).trim().replace(" ", "T");
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  } catch (_) {
    return String(value);
  }
}

// ============================================
// GET - دریافت تاریخچه تغییرات نرخ ارز
// ============================================
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const currencyCode = url.searchParams.get("currency") || "USD";
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit")) || 50)
    );
    
    // دریافت تاریخچه
    const history = await getRateHistory(context.env, currencyCode, limit);
    
    // فرمت کردن تاریخچه برای نمایش
    const formattedHistory = history.map((item) => ({
      id: item.id,
      rate: item.rate,
      rate_formatted: `${formatNumber(item.rate)} تومان`,
      source_type: item.source_type,
      source_label: item.source_type === 'api' ? 'API' : 'دستی',
      changed_by: item.changed_by || 'سیستم',
      created_at: item.created_at,
      created_at_formatted: formatDate(item.created_at)
    }));
    
    // دریافت نرخ فعلی برای مقایسه
    let currentRate = null;
    try {
      const { getCurrentRate } = await import("../../lib/rate");
      currentRate = await getCurrentRate(context.env, currencyCode);
    } catch (_) {
      // اگر خطایی رخ داد، ادامه بده
    }
    
    return json({
      success: true,
      currency_code: currencyCode,
      total: formattedHistory.length,
      current_rate: currentRate ? {
        rate: currentRate.rate,
        rate_formatted: `${formatNumber(currentRate.rate)} تومان`,
        updated_at: currentRate.updated_at,
        updated_at_formatted: formatDate(currentRate.updated_at)
      } : null,
      history: formattedHistory
    });
    
  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}

// ============================================
// OPTIONS - CORS
// ============================================
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}