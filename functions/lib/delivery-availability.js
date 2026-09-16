const TEHRAN = "Asia/Tehran";
const IRAN_OFFSET_MINUTES = 210;

function settingMap(rows) {
  return Object.fromEntries((rows || []).map((row) => [row.setting_key, row.setting_value]));
}

function localDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone: TEHRAN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function jalaliDateFromUtc(date) {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return `${values.year}/${String(values.month).padStart(2, "0")}/${String(values.day).padStart(2, "0")}`;
}

function normalizeDate(value) {
  const digits = String(value || "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/-/g, "/");
  const match = digits.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  return match ? `${match[1]}/${String(Number(match[2])).padStart(2, "0")}/${String(Number(match[3])).padStart(2, "0")}` : "";
}

function locationMatches(schedule, province, city, shippingMethodId) {
  if (schedule.shipping_method_id != null && Number(schedule.shipping_method_id) !== Number(shippingMethodId)) return false;
  if (schedule.province && String(schedule.province).trim() !== province) return false;
  if (schedule.city && String(schedule.city).trim() !== city) return false;
  return true;
}

function slotStartIsOpen(dayTimestamp, startTime, cutoffMinutes, now) {
  const match = String(startTime || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const startUtc = dayTimestamp + (Number(match[1]) * 60 + Number(match[2]) - IRAN_OFFSET_MINUTES) * 60000;
  return startUtc - Math.max(0, Number(cutoffMinutes) || 0) * 60000 > now;
}

export async function getDeliveryAvailability(db, options = {}, now = new Date()) {
  const [scheduleResult, settingResult, holidayResult] = await Promise.all([
    db.prepare("SELECT id,title,shipping_method_id,province,city,weekday,specific_date,start_time,end_time,capacity,cutoff_minutes FROM delivery_schedules WHERE is_active=1 ORDER BY start_time,id").all(),
    db.prepare("SELECT setting_key,setting_value FROM delivery_settings WHERE setting_key IN ('minimum_days','horizon_days','same_day_cutoff','blocked_weekdays')").all(),
    db.prepare("SELECT holiday_date FROM delivery_holidays").all()
  ]);

  const settings = settingMap(settingResult.results);
  const minimumDays = Math.max(0, Math.min(60, settings.minimum_days == null ? 2 : (Number(settings.minimum_days) || 0)));
  const horizonDays = Math.max(1, Math.min(60, Number(settings.horizon_days) || 14));
  const cutoff = String(settings.same_day_cutoff || "14:00").match(/^(\d{1,2}):(\d{2})$/);
  const blockedSetting = (() => { try { return JSON.parse(settings.blocked_weekdays || "[]"); } catch (_) { return []; } })();
  const blockedWeekdays = new Set((Array.isArray(blockedSetting) ? blockedSetting : []).map(Number));
  const holidays = new Set((holidayResult.results || []).map((row) => normalizeDate(row.holiday_date)));
  const tehran = localDateParts(now);
  const today = Date.UTC(tehran.year, tehran.month - 1, tehran.day);
  const cutoffReached = !!cutoff && tehran.hour * 60 + tehran.minute >= Number(cutoff[1]) * 60 + Number(cutoff[2]);
  const eligibleDateOffsets = [];
  for (let offset = 0; offset <= horizonDays; offset++) {
    const timestamp = today + offset * 86400000;
    const weekday = new Date(timestamp).getUTCDay();
    const jalaliDate = jalaliDateFromUtc(new Date(timestamp));
    const isDeliveryDay = !blockedWeekdays.has(weekday) && !holidays.has(jalaliDate);
    if (isDeliveryDay) eligibleDateOffsets.push(offset);
  }
  // Count the order date as the first preparation day when it is an open day.
  // The same-day cutoff only disables delivery today; it must not shift the
  // configured preparation window by an extra day.
  const preparationDaysToSkip = Math.max(0, minimumDays - 1);
  const selectableDates = eligibleDateOffsets
    .slice(preparationDaysToSkip)
    .filter((offset) => !(cutoffReached && offset === 0))
    .slice(0, 7);
  const lastSelectableOffset = selectableDates.length ? selectableDates[selectableDates.length - 1] : horizonDays;
  const fromTs = today - 40 * 86400000;
  const toTs = today + lastSelectableOffset * 86400000 + 40 * 86400000;
  const schedules = (scheduleResult.results || []).filter((schedule) => locationMatches(schedule, options.province || "", options.city || "", options.shippingMethodId));
  const fromDate = jalaliDateFromUtc(new Date(fromTs));
  const toDate = jalaliDateFromUtc(new Date(toTs));
  const bookingResult = await db.prepare(`
    SELECT delivery_date, delivery_slot_id, COUNT(*) AS booked
    FROM orders
    WHERE delivery_date >= ? AND delivery_date <= ?
      AND delivery_slot_id IS NOT NULL
      AND status NOT IN ('cancelled','payment_failed','rejected','failed','refunded')
    GROUP BY delivery_date, delivery_slot_id
  `).bind(fromDate, toDate).all();
  const bookings = new Map((bookingResult.results || []).map((row) => [`${normalizeDate(row.delivery_date)}|${Number(row.delivery_slot_id)}`, Number(row.booked || 0)]));

  const days = [];
  const selectableDateSet = new Set(selectableDates);
  for (const offset of selectableDates) {
    const timestamp = today + offset * 86400000;
    const date = new Date(timestamp);
    const jalaliDate = jalaliDateFromUtc(date);
    const weekday = date.getUTCDay();
    const eligible = selectableDateSet.has(offset) && !blockedWeekdays.has(weekday) && !holidays.has(jalaliDate);
    let candidates = [];
    if (eligible) {
      const specific = schedules.filter((schedule) => normalizeDate(schedule.specific_date) === jalaliDate);
      candidates = specific.length ? specific : schedules.filter((schedule) => !schedule.specific_date && Number(schedule.weekday) === weekday);
    }
    const slots = candidates.filter((schedule) => {
      const booked = bookings.get(`${jalaliDate}|${Number(schedule.id)}`) || 0;
      const capacity = Number(schedule.capacity || 0);
      return (capacity <= 0 || booked < capacity) && slotStartIsOpen(timestamp, schedule.start_time, schedule.cutoff_minutes, now.getTime());
    }).map((schedule) => ({
      id: Number(schedule.id),
      title: String(schedule.title || "زمان ارسال"),
      start_time: String(schedule.start_time || ""),
      end_time: String(schedule.end_time || "")
    }));
    days.push({ date: jalaliDate, weekday, available: slots.length > 0, slots });
  }
  return { days, settings: { minimum_days: minimumDays, horizon_days: horizonDays } };
}

export async function validateDeliveryChoice(db, selection, now = new Date()) {
  const date = normalizeDate(selection.deliveryDate);
  const slotId = Number(selection.slotId);
  if (!date || !slotId) return { ok: false, error: "delivery_date_and_time_required" };
  const result = await getDeliveryAvailability(db, {
    province: selection.province,
    city: selection.city,
    shippingMethodId: selection.shippingMethodId
  }, now);
  const day = result.days.find((item) => item.date === date && item.available);
  if (!day) return { ok: false, error: "delivery_date_unavailable" };
  const slot = day.slots.find((item) => item.id === slotId);
  if (!slot) return { ok: false, error: "delivery_time_unavailable" };
  return { ok: true, date, slot };
}
