import { updateRate, recalculateAllProductPrices, getCurrentRate } from "../../lib/rate";
import { requireAdmin, logAdminAction } from "../../lib/admin";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}

function normalizeNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  
  const str = String(value ?? "").replace(/[^\d]/g, "");
  if (!str) return 0;
  
  const parsed = Number(str);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

// ============================================
// POST - به‌روزرسانی نرخ ارز
// ============================================
export async function onRequestPost(context) {
  try {
    // بررسی دسترسی ادمین
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }
    
    const body = await context.request.json().catch(() => null);
    
    if (!body || typeof body !== "object") {
      return json({
        success: false,
        error: "بدنه درخواست نامعتبر است."
      }, 400);
    }
    
    const currencyCode = String(body.currency || body.currency_code || "USD").trim().toUpperCase();
    const newRate = normalizeNumber(body.rate || body.new_rate);
    const sourceType = String(body.source_type || "manual").trim().toLowerCase();
    
    // اعتبارسنجی
    if (!currencyCode) {
      return json({
        success: false,
        error: "کد ارز وارد نشده است."
      }, 400);
    }
    
    if (newRate <= 0) {
      return json({
        success: false,
        error: "نرخ وارد شده معتبر نیست. لطفاً یک عدد مثبت وارد کنید."
      }, 400);
    }
    
    if (!["manual", "api"].includes(sourceType)) {
      return json({
        success: false,
        error: "منبع تغییر نامعتبر است. مقادیر مجاز: manual, api"
      }, 400);
    }
    
    // دریافت نرخ قبلی برای گزارش
    const previousRate = await getCurrentRate(context.env, currencyCode);
    
    // به‌روزرسانی نرخ
    const result = await updateRate(
      context.env,
      currencyCode,
      newRate,
      sourceType,
      adminCheck.user.id
    );
    
    if (!result.success) {
      return json({
        success: false,
        error: result.message || "به‌روزرسانی نرخ انجام نشد."
      }, 500);
    }
    
    // ثبت لاگ عملیات
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "rate_updated",
      target_type: "rate",
      target_id: currencyCode,
      description: `نرخ ${currencyCode} از ${formatNumber(previousRate?.rate || 0)} به ${formatNumber(newRate)} تومان تغییر یافت. (منبع: ${sourceType})`
    });
    
    // اگر نرخ تغییر کرده و محصولات وابسته وجود دارند، قیمت‌ها را به‌روزرسانی کن
    let recalculateResult = null;
    if (result.changed) {
      try {
        recalculateResult = await recalculateAllProductPrices(context.env, currencyCode);
      } catch (recalcError) {
        // خطای محاسبه قیمت‌ها را لاگ می‌کنیم اما عملیات اصلی را متوقف نمی‌کنیم
        console.error("Error recalculating prices:", recalcError);
      }
    }
    
    return json({
      success: true,
      message: result.message,
      rate: {
        currency_code: result.rate?.currency_code || currencyCode,
        currency_name: result.rate?.currency_name || null,
        rate: result.rate?.rate || newRate,
        rate_formatted: `${formatNumber(result.rate?.rate || newRate)} تومان`,
        previous_rate: result.previous_rate || null,
        previous_rate_formatted: result.previous_rate ? `${formatNumber(result.previous_rate)} تومان` : null,
        source_type: sourceType,
        source_label: sourceType === 'api' ? 'API' : 'دستی',
        changed: result.changed
      },
      products_updated: recalculateResult ? {
        count: recalculateResult.updated_count || 0,
        message: recalculateResult.message || "محصولات به‌روزرسانی شدند."
      } : null
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}