const persianScheduleCalendar = new Intl.DateTimeFormat('en-US', {
  calendar: 'persian', numberingSystem: 'latn', timeZone: 'UTC',
  year: 'numeric', month: 'numeric', day: 'numeric',
});

function scheduleDigits(value) {
  return typeof value === 'string' ? value.trim()
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))) : '';
}

function scheduleCalendarKey(epochDay) {
  const parts = Object.fromEntries(persianScheduleCalendar.formatToParts(new Date(epochDay * 86400000))
    .filter(part => ['year', 'month', 'day'].includes(part.type)).map(part => [part.type, Number(part.value)]));
  return parts.year * 10000 + parts.month * 100 + parts.day;
}

function isRealPersianScheduleDate(year, month, day) {
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > (month <= 6 ? 31 : 30)) return false;
  const target = year * 10000 + month * 100 + day;
  // Use the runtime's Persian calendar, including leap years, rather than a second calendar algorithm.
  let lower = Math.floor(Date.UTC(year + 621, 0, 1) / 86400000);
  let upper = Math.floor(Date.UTC(year + 623, 0, 1) / 86400000);
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (scheduleCalendarKey(middle) < target) lower = middle + 1;
    else upper = middle;
  }
  return scheduleCalendarKey(lower) === target;
}

export function validateDeliverySchedule(body = {}) {
  const date = scheduleDigits(body.delivery_date).replace(/-/g, '/');
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(date);
  if (!match) return { ok: false, error: 'تاریخ شمسی را با قالب سال/ماه/روز وارد کنید.' };
  const [year, month, day] = match.slice(1).map(Number);
  if (!isRealPersianScheduleDate(year, month, day)) {
    return { ok: false, error: 'تاریخ شمسی واردشده معتبر نیست. روز، ماه و سال را بررسی کنید.' };
  }
  const timeFrom = scheduleDigits(body.delivery_time_from);
  const timeTo = scheduleDigits(body.delivery_time_to);
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(timeFrom) || !timePattern.test(timeTo)) {
    return { ok: false, error: 'ساعت شروع و پایان را درست وارد کنید.' };
  }
  if (timeTo <= timeFrom) return { ok: false, error: 'ساعت پایان باید بعد از ساعت شروع در همان روز باشد.' };
  return { ok: true, deliveryDate: `${match[1]}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`, timeFrom, timeTo };
}
