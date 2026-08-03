import { getCurrentRateWithPrevious } from "../../lib/rate";
import { getCurrentUser } from "../../lib/admin";

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

// ============================================
// GET - دریافت نرخ فعلی ارز
// ============================================
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const currencyCode = url.searchParams.get("currency") || "USD";
    
    // دریافت نرخ فعلی با نرخ قبلی
    const rate = await getCurrentRateWithPrevious(context.env, currencyCode);
    
    if (!rate) {
      return json({
        success: false,
        error: `نرخ ارز ${currencyCode} یافت نشد.`
      }, 404);
    }
    
    // محاسبه درصد تغییر
    let changePercent = null;
    if (rate.previous_rate && rate.previous_rate !== rate.rate) {
      changePercent = ((rate.rate - rate.previous_rate) / rate.previous_rate) * 100;
    }
    
    // دریافت اطلاعات کاربر تغییردهنده (در صورت وجود)
    let changedBy = null;
    if (rate.updated_by_user_id) {
      const user = await context.env.DB
        .prepare(`SELECT full_name FROM users WHERE id = ?`)
        .bind(rate.updated_by_user_id)
        .first();
      changedBy = user?.full_name || null;
    }
    
    return json({
      success: true,
      rate: {
        id: rate.id,
        currency_code: rate.currency_code,
        currency_name: rate.currency_name,
        rate: rate.rate,
        rate_formatted: `${formatNumber(rate.rate)} تومان`,
        source_type: rate.source_type,
        source_label: rate.source_type === 'api' ? 'API' : 'دستی',
        is_active: rate.is_active === 1,
        previous_rate: rate.previous_rate,
        previous_rate_formatted: rate.previous_rate ? `${formatNumber(rate.previous_rate)} تومان` : null,
        change_percent: changePercent,
        change_percent_formatted: changePercent !== null ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%` : null,
        updated_by_user_id: rate.updated_by_user_id,
        updated_by: changedBy,
        updated_at: rate.updated_at,
        created_at: rate.created_at
      }
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