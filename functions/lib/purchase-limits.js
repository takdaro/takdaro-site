export function readPurchaseLimits(body, current = {}) {
  const field = (snake, camel, fallback) => Object.hasOwn(body, snake) ? body[snake] : Object.hasOwn(body, camel) ? body[camel] : fallback;
  const parse = value => {
    if (typeof value !== 'string' && typeof value !== 'number') return NaN;
    const text = String(value).trim().replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const number = /^\d+$/.test(text) ? Number(text) : NaN;
    return Number.isSafeInteger(number) && number > 0 ? number : NaN;
  };
  const rawMin = field('purchase_min_quantity', 'purchaseMinQuantity', current.purchase_min_quantity ?? 1);
  const rawMax = field('purchase_max_quantity', 'purchaseMaxQuantity', current.purchase_max_quantity ?? null);
  const min = rawMin === '' || rawMin === null ? 1 : parse(rawMin);
  const max = rawMax === '' || rawMax === null ? null : parse(rawMax);
  const error = !Number.isFinite(min) || (max !== null && (!Number.isFinite(max) || max < min))
    ? 'حداقل و حداکثر خرید باید عدد صحیح مثبت باشند و حداکثر نباید کمتر از حداقل باشد.' : null;
  return { min, max, error };
}
