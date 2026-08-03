import { requireAdmin, logAdminAction } from "../../lib/admin";
import { getCurrentRate, recalculateAllProductPrices } from "../../lib/rate";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}

// ============================================
// POST - بروزرسانی قیمت همه محصولات وابسته به نرخ
// ============================================
export async function onRequestPost(context) {
  try {
    // بررسی دسترسی ادمین
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const url = new URL(context.request.url);
    const currencyCode = url.searchParams.get("currency") || "USD";

    // دریافت نرخ فعلی
    const rate = await getCurrentRate(context.env, currencyCode);
    if (!rate) {
      return json({
        success: false,
        error: `نرخ ارز ${currencyCode} یافت نشد. لطفاً ابتدا نرخ را تنظیم کنید.`
      }, 404);
    }

    // بروزرسانی قیمت همه محصولات
    const result = await recalculateAllProductPrices(context.env, currencyCode);

    // ثبت لاگ
    await logAdminAction(context, {
      admin_user_id: adminCheck.user.id,
      action: "prices_recalculated",
      target_type: "rate",
      target_id: currencyCode,
      description: `بروزرسانی قیمت محصولات با نرخ ${rate.rate} تومان - ${result.updated_count || 0} محصول به‌روزرسانی شد.`
    });

    return json({
      success: true,
      message: result.message || "قیمت محصولات با موفقیت به‌روزرسانی شد.",
      updated_count: result.updated_count || 0,
      rate: rate.rate,
      rate_formatted: new Intl.NumberFormat("fa-IR").format(rate.rate)
    });

  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}