import { getDb } from "./db";

// ============================================
// توابع کمکی نرخ ارز
// ============================================

/**
 * دریافت نرخ فعلی یک ارز
 * @param {Object} env - محیط Cloudflare
 * @param {string} currencyCode - کد ارز (پیش‌فرض: 'USD')
 * @returns {Promise<Object|null>} - اطلاعات نرخ یا null
 */
export async function getCurrentRate(env, currencyCode = 'USD') {
  const db = getDb(env);
  
  const result = await db
    .prepare(`
      SELECT 
        id,
        currency_code,
        currency_name,
        rate,
        source_type,
        is_active,
        updated_by_user_id,
        created_at,
        updated_at
      FROM rates
      WHERE currency_code = ? AND is_active = 1
      LIMIT 1
    `)
    .bind(currencyCode)
    .first();
  
  return result || null;
}

/**
 * دریافت نرخ فعلی به همراه نرخ قبلی (برای نمایش تغییرات)
 * @param {Object} env - محیط Cloudflare
 * @param {string} currencyCode - کد ارز (پیش‌فرض: 'USD')
 * @returns {Promise<Object|null>} - اطلاعات نرخ با نرخ قبلی
 */
export async function getCurrentRateWithPrevious(env, currencyCode = 'USD') {
  const db = getDb(env);
  
  // دریافت نرخ فعلی
  const current = await getCurrentRate(env, currencyCode);
  if (!current) return null;
  
  // دریافت نرخ قبلی از تاریخچه
  const history = await db
    .prepare(`
      SELECT rate
      FROM rate_history
      WHERE rate_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .bind(current.id)
    .first();
  
  return {
    ...current,
    previous_rate: history?.rate || current.rate
  };
}

/**
 * دریافت تاریخچه تغییرات یک ارز
 * @param {Object} env - محیط Cloudflare
 * @param {string} currencyCode - کد ارز (پیش‌فرض: 'USD')
 * @param {number} limit - تعداد رکوردها (پیش‌فرض: 50)
 * @returns {Promise<Array>} - لیست تاریخچه
 */
export async function getRateHistory(env, currencyCode = 'USD', limit = 50) {
  const db = getDb(env);
  
  // ابتدا rate_id را پیدا می‌کنیم
  const rate = await db
    .prepare(`SELECT id FROM rates WHERE currency_code = ?`)
    .bind(currencyCode)
    .first();
  
  if (!rate) return [];
  
  const result = await db
    .prepare(`
      SELECT 
        rh.id,
        rh.rate,
        rh.source_type,
        rh.created_at,
        u.full_name as changed_by
      FROM rate_history rh
      LEFT JOIN users u ON u.id = rh.changed_by_user_id
      WHERE rh.rate_id = ?
      ORDER BY rh.created_at DESC
      LIMIT ?
    `)
    .bind(rate.id, limit)
    .all();
  
  return Array.isArray(result?.results) ? result.results : [];
}

/**
 * به‌روزرسانی نرخ ارز و ثبت در تاریخچه
 * @param {Object} env - محیط Cloudflare
 * @param {string} currencyCode - کد ارز
 * @param {number} newRate - نرخ جدید به تومان
 * @param {string} sourceType - منبع تغییر ('manual' | 'api')
 * @param {number|null} userId - شناسه کاربر تغییردهنده (اختیاری)
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function updateRate(env, currencyCode, newRate, sourceType = 'manual', userId = null) {
  const db = getDb(env);
  
  // اعتبارسنجی
  const rateValue = Number(newRate);
  if (!Number.isFinite(rateValue) || rateValue <= 0) {
    throw new Error('نرخ وارد شده معتبر نیست.');
  }
  
  // دریافت نرخ فعلی
  const current = await getCurrentRate(env, currencyCode);
  
  if (!current) {
    throw new Error(`ارز ${currencyCode} یافت نشد.`);
  }
  
  // اگر نرخ تغییری نکرده، نیازی به به‌روزرسانی نیست
  if (current.rate === rateValue) {
    return {
      success: true,
      message: 'نرخ تغییری نکرده است.',
      rate: current,
      changed: false
    };
  }
  
  // ثبت نرخ قبلی در تاریخچه
  await db
    .prepare(`
      INSERT INTO rate_history (
        rate_id,
        rate,
        source_type,
        changed_by_user_id,
        created_at
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    .bind(
      current.id,
      current.rate,
      current.source_type,
      userId
    )
    .run();
  
  // به‌روزرسانی نرخ فعلی
  await db
    .prepare(`
      UPDATE rates
      SET 
        rate = ?,
        source_type = ?,
        updated_by_user_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(
      rateValue,
      sourceType,
      userId,
      current.id
    )
    .run();
  
  // دریافت نرخ به‌روز شده
  const updated = await getCurrentRate(env, currencyCode);
  
  return {
    success: true,
    message: `نرخ ${currencyCode} با موفقیت به‌روزرسانی شد.`,
    rate: updated,
    previous_rate: current.rate,
    changed: true
  };
}

/**
 * محاسبه قیمت نهایی محصول بر اساس نرخ ارز
 * @param {Object} product - اطلاعات محصول از دیتابیس
 * @param {number} rate - نرخ فعلی ارز
 * @param {Object} options - گزینه‌های اضافی
 * @returns {number} - قیمت محاسبه‌شده
 */
export function calculateProductPrice(product, rate, options = {}) {
  // اگر محصول وابسته به نرخ نیست، قیمت ثابت را برگردان
  if (product.price_type !== 'rate_based') {
    return Number(product.price || 0);
  }
  
  // قیمت پایه باید وجود داشته باشد
  const basePrice = Number(product.base_price || 0);
  if (basePrice <= 0) {
    return 0;
  }
  
  // محاسبه قیمت پایه بر اساس نرخ
  let finalPrice = basePrice * rate;
  
  // اعمال سود
  const profitType = product.profit_type || 'none';
  const profitValue = Number(product.profit_value || 0);
  
  if (profitType === 'percentage' && profitValue > 0) {
    finalPrice += (finalPrice * profitValue / 100);
  } else if (profitType === 'fixed' && profitValue > 0) {
    finalPrice += profitValue;
  }
  
  // اعمال هزینه ثابت
  const fixedFee = Number(product.fixed_fee || 0);
  if (fixedFee > 0) {
    finalPrice += fixedFee;
  }
  
  // گرد کردن
  const roundingType = product.rounding_type || 'none';
  const roundingMethod = product.rounding_method || 'nearest';
  
  if (roundingType !== 'none') {
    const roundTo = parseInt(roundingType, 10);
    if (roundTo > 0) {
      if (roundingMethod === 'up') {
        finalPrice = Math.ceil(finalPrice / roundTo) * roundTo;
      } else if (roundingMethod === 'down') {
        finalPrice = Math.floor(finalPrice / roundTo) * roundTo;
      } else {
        // nearest
        finalPrice = Math.round(finalPrice / roundTo) * roundTo;
      }
    }
  }
  
  // اطمینان از عدد صحیح
  return Math.max(0, Math.round(finalPrice));
}

/**
 * محاسبه و ذخیره قیمت‌های همه محصولات وابسته به نرخ
 * @param {Object} env - محیط Cloudflare
 * @param {string} currencyCode - کد ارز (پیش‌فرض: 'USD')
 * @returns {Promise<Object>} - نتیجه عملیات
 */
export async function recalculateAllProductPrices(env, currencyCode = 'USD') {
  const db = getDb(env);
  
  // دریافت نرخ فعلی
  const rate = await getCurrentRate(env, currencyCode);
  if (!rate) {
    throw new Error(`نرخ ارز ${currencyCode} یافت نشد.`);
  }
  
  // دریافت همه محصولات وابسته به نرخ
  const productsResult = await db
    .prepare(`
      SELECT 
        id,
        name,
        slug,
        price_type,
        base_price,
        profit_type,
        profit_value,
        fixed_fee,
        rounding_type,
        rounding_method
      FROM products
      WHERE price_type = 'rate_based'
        AND base_price IS NOT NULL
        AND base_price > 0
    `)
    .all();
  
  const products = Array.isArray(productsResult?.results) ? productsResult.results : [];
  
  if (products.length === 0) {
    return {
      success: true,
      message: 'هیچ محصول وابسته به نرخ ارزی وجود ندارد.',
      updated_count: 0,
      rate: rate.rate
    };
  }
  
  // محاسبه و به‌روزرسانی هر محصول
  const updates = products.map((product) => {
    const calculatedPrice = calculateProductPrice(product, rate.rate);
    
    return db
      .prepare(`
        UPDATE products
        SET 
          calculated_price = ?,
          price_calculated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(calculatedPrice, product.id);
  });
  
  // اجرای همه به‌روزرسانی‌ها
  await db.batch(updates);
  
  return {
    success: true,
    message: `قیمت ${products.length} محصول با نرخ ${rate.rate} تومان به‌روزرسانی شد.`,
    updated_count: products.length,
    rate: rate.rate
  };
}

/**
 * دریافت قیمت محاسبه‌شده یک محصول خاص
 * @param {Object} env - محیط Cloudflare
 * @param {number} productId - شناسه محصول
 * @param {string} currencyCode - کد ارز (پیش‌فرض: 'USD')
 * @returns {Promise<number>} - قیمت محاسبه‌شده
 */
export async function getCalculatedProductPrice(env, productId, currencyCode = 'USD') {
  const db = getDb(env);
  
  // دریافت اطلاعات محصول
  const product = await db
    .prepare(`
      SELECT 
        id,
        name,
        slug,
        price,
        price_type,
        base_price,
        profit_type,
        profit_value,
        fixed_fee,
        rounding_type,
        rounding_method,
        calculated_price,
        price_calculated_at
      FROM products
      WHERE id = ?
    `)
    .bind(productId)
    .first();
  
  if (!product) {
    throw new Error('محصول یافت نشد.');
  }
  
  // اگر محصول ثابت است، قیمت معمولی را برگردان
  if (product.price_type !== 'rate_based') {
    return Number(product.price || 0);
  }
  
  // دریافت نرخ فعلی
  const rate = await getCurrentRate(env, currencyCode);
  if (!rate) {
    throw new Error(`نرخ ارز ${currencyCode} یافت نشد.`);
  }
  
  // محاسبه قیمت
  return calculateProductPrice(product, rate.rate);
}

/**
 * دریافت تنظیمات API نرخ ارز از app_settings
 * @param {Object} env - محیط Cloudflare
 * @returns {Promise<Object>} - تنظیمات API
 */
export async function getRateApiSettings(env) {
  const db = getDb(env);
  
  const result = await db
    .prepare(`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key LIKE 'rate_%'
    `)
    .all();
  
  const rows = Array.isArray(result?.results) ? result.results : [];
  const settings = {};
  
  for (const row of rows) {
    const key = String(row.setting_key || '').trim();
    const value = String(row.setting_value || '').trim();
    settings[key] = value;
  }
  
  // تنظیمات پیش‌فرض
  const defaults = {
    rate_default_currency: 'USD',
    rate_api_provider: 'tgju',
    rate_api_url: 'https://api.tgju.org/v1/market/price/price_dollar_rl',
    rate_api_key: '',
    rate_update_interval: '3600',
    rate_auto_update_enabled: 'false'
  };
  
  // ترکیب با پیش‌فرض‌ها
  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (!settings[key] || settings[key] === '') {
      settings[key] = defaultValue;
    }
  }
  
  return settings;
}

/**
 * دریافت نرخ از API خارجی (برای استفاده در آینده)
 * @param {Object} env - محیط Cloudflare
 * @param {string} provider - نام سرویس API
 * @param {string} apiUrl - آدرس API
 * @param {string} apiKey - کلید API (اختیاری)
 * @returns {Promise<number|null>} - نرخ دریافت شده یا null
 */
export async function fetchRateFromApi(env, provider = 'tgju', apiUrl = null, apiKey = null) {
  // این تابع برای مرحله بعد پیاده‌سازی می‌شود
  // در نسخه فعلی فقط دستی پشتیبانی می‌شود
  
  console.warn('دریافت خودکار از API هنوز پیاده‌سازی نشده است.');
  return null;
}