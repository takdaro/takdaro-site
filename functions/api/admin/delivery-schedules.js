import { requireAdmin } from "../../lib/admin";

const json = (data, status = 200) => Response.json(data, { status });
const text = (v) => String(v ?? "").trim();
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : fallback;

export async function onRequestGet(context) {
  const check = await requireAdmin(context); if (!check.ok) return check.response;
  const rows = await context.env.DB.prepare(`SELECT ds.*, sm.name AS shipping_method_name FROM delivery_schedules ds LEFT JOIN shipping_methods sm ON sm.id=ds.shipping_method_id ORDER BY ds.specific_date IS NULL, ds.weekday, ds.start_time, ds.id`).all();
  const holidays = await context.env.DB.prepare("SELECT * FROM delivery_holidays ORDER BY holiday_date").all();
  const settings = await context.env.DB.prepare("SELECT setting_key, setting_value FROM delivery_settings").all();
  return json({ success: true, schedules: rows.results || [], holidays: holidays.results || [], settings: Object.fromEntries((settings.results || []).map(x => [x.setting_key, x.setting_value])) });
}

export async function onRequestPost(context) {
  const check = await requireAdmin(context); if (!check.ok) return check.response;
  const body = await context.request.json().catch(() => null); if (!body) return json({ success:false, error:"invalid_payload" },400);
  const action = body.action || "create";
  if (action === "toggle") { await context.env.DB.prepare("UPDATE delivery_schedules SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(body.is_active ? 1 : 0, num(body.id)).run(); return json({success:true}); }
  if (action === "delete") { await context.env.DB.prepare("DELETE FROM delivery_schedules WHERE id=?").bind(num(body.id)).run(); return json({success:true}); }
  if (action === "holiday") { const d=text(body.holiday_date); if(!d)return json({success:false,error:"date_required"},400); await context.env.DB.prepare("INSERT OR REPLACE INTO delivery_holidays (holiday_date,title) VALUES (?,?)").bind(d,text(body.title)).run(); return json({success:true}); }
  if (action === "holiday_delete") { await context.env.DB.prepare("DELETE FROM delivery_holidays WHERE id=?").bind(num(body.id)).run(); return json({success:true}); }
  if (action === "save_weekdays") { const days = Array.isArray(body.weekdays) ? body.weekdays.map(x => num(x)).filter(x => x >= 0 && x <= 6) : []; await context.env.DB.prepare("INSERT OR REPLACE INTO delivery_settings (setting_key,setting_value,updated_at) VALUES ('blocked_weekdays',?,CURRENT_TIMESTAMP)").bind(JSON.stringify(days)).run(); return json({success:true}); }
  if (action === "save_defaults") { const values={ minimum_days: String(num(body.minimum_days)), horizon_days: String(Math.max(1,num(body.horizon_days,14))), same_day_cutoff: /^([01]\d|2[0-3]):[0-5]\d$/.test(text(body.same_day_cutoff))?text(body.same_day_cutoff):"14:00" }; for (const [key,value] of Object.entries(values)) await context.env.DB.prepare("INSERT OR REPLACE INTO delivery_settings (setting_key,setting_value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP)").bind(key,value).run(); return json({success:true}); }
  if (action === "save_weekly_slots") { const rows = Array.isArray(body.rows) ? body.rows : []; for (const row of rows) { const weekday=num(row.weekday); const title=text(row.title)||"زمان ارسال"; const found = await context.env.DB.prepare("SELECT id FROM delivery_schedules WHERE weekday=? AND specific_date IS NULL AND title=? LIMIT 1").bind(weekday,title).first(); if (found) await context.env.DB.prepare("UPDATE delivery_schedules SET start_time=?,end_time=?,capacity=?,cutoff_minutes=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(text(row.start_time),text(row.end_time),num(row.capacity),num(row.cutoff_hours)*60,row.active?1:0,found.id).run(); else if(row.active && text(row.start_time) && text(row.end_time)) await context.env.DB.prepare("INSERT INTO delivery_schedules (title,weekday,start_time,end_time,capacity,cutoff_minutes,is_active) VALUES (?,?,?,?,?,?,1)").bind(title,weekday,text(row.start_time),text(row.end_time),num(row.capacity),num(row.cutoff_hours)*60).run(); } return json({success:true}); }
  const values=[text(body.title)||"بازه ارسال", body.shipping_method_id ? num(body.shipping_method_id) : null, text(body.province)||null, text(body.city)||null, body.weekday === "" || body.weekday == null ? null : num(body.weekday), text(body.specific_date)||null, text(body.start_time), text(body.end_time), num(body.capacity), num(body.cutoff_minutes), body.is_active===false?0:1];
  if(!values[5] && values[4]===null) return json({success:false,error:"weekday_or_date_required"},400);
  if(!values[6]||!values[7]) return json({success:false,error:"time_required"},400);
  if(action === "update") { await context.env.DB.prepare(`UPDATE delivery_schedules SET title=?,shipping_method_id=?,province=?,city=?,weekday=?,specific_date=?,start_time=?,end_time=?,capacity=?,cutoff_minutes=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...values,num(body.id)).run(); }
  else await context.env.DB.prepare(`INSERT INTO delivery_schedules (title,shipping_method_id,province,city,weekday,specific_date,start_time,end_time,capacity,cutoff_minutes,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(...values).run();
  return json({ success:true });
}
