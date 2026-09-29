import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Stub the database and delivery transport: no real emails are sent.
let config = { admin_email: 'manager@example.com', templates: {} };
let enabled = 1;
const sent = [];
const logs = [];
const DB = { prepare(sql) {
  let values;
  return {
    bind(...args) { values = args; return this; },
    async first() { return { id: 1, is_enabled: enabled, config: JSON.stringify(config) }; },
    async run() {
      if (sql.includes('SET config')) config = JSON.parse(values[0]);
      else if (sql.includes('notification_logs')) logs.push(values);
      return { meta: { last_row_id: 1 } };
    }
  };
} };
const source = fs.readFileSync(new URL('../functions/lib/email.js', import.meta.url), 'utf8')
  .replace(/import .* from .*;\r?\n/g, '')
  .replace(/export async function/g, 'async function')
  .replace(/export function/g, 'function')
  .replace(/export \{[\s\S]*?\};/g, '');
const context = vm.createContext({ console, getDb: env => env.DB, getStatusLabel: value => value,
  fetch: async (_url, request) => { sent.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ id: 'mock' }) }; }
});
vm.runInContext(source, context);
const env = { DB, RESEND_API_KEY: 'mock' };
const user = { id: 12, fullName: 'علی رضایی', email: 'customer@example.com' };
const order = { orderId: 3, orderNumber: 'TEST-3', totalAmount: 1000 };
const sendUser = () => context.sendUserEmailNotification(env, user.id, 'order_created', order, user);
const sendAdmin = () => context.sendAdminEmailNotification(env, 'order_created', order, user);

await sendUser(); await sendAdmin();
assert.equal(sent.length, 2);
assert.match(sent[0].html, /سلام <span>علی رضایی عزیز<\/span>/);
assert.match(sent[0].html, /فاکتور شما با موفقیت ثبت شد/);
assert.match(sent[0].html, /قیمت تک محصول/);
assert.match(sent[0].html, /قیمت جمع محصول/);
assert.match(sent[0].html, /جمع محصولات/);
assert.match(sent[0].html, /https:\/\/chat\.takdaro\.com/);
assert.match(sent[0].html, /پیگیری سفارش/);
assert.match(sent[0].html, /prefers-color-scheme: dark/);
assert.match(sent[1].html, /سلام <span>مدیر عزیز<\/span>/);
assert.notEqual(sent[0].subject, sent[1].subject);
assert.equal(sent[0].to[0], user.email);
assert.equal(sent[1].to[0], config.admin_email);
assert.equal(logs[0].at(-1), 1);
assert.equal(logs[1].at(-1), 0);

await context.toggleEmailTemplate(env, 'order_created:admin', false, 1);
sent.length = 0;
await sendUser(); await sendAdmin();
assert.equal(sent.length, 1);
assert.equal(sent[0].to[0], user.email);
await context.toggleEmailTemplate(env, 'order_created:user', false, 1);
await context.toggleEmailTemplate(env, 'order_created:admin', true, 1);
sent.length = 0;
await sendUser(); await sendAdmin();
assert.equal(sent.length, 1);
assert.equal(sent[0].to[0], config.admin_email);

await context.saveEmailTemplate(env, { eventType: 'order_created:admin', title: 'Custom', subject: 'Custom subject', body: 'Custom body', isEnabled: true }, 1);
assert.equal((await context.getEmailTemplate(env, 'order_created:admin')).body, 'Custom body');
await context.saveEmailSettings(env, { sender_name: 'Updated' }, 1);
assert.equal((await context.getEmailTemplate(env, 'order_created:admin')).body, 'Custom body');
assert.equal((await context.getEmailTemplate(env, 'order_created:user')).is_enabled, false);

config.templates.payment_failed = { title: 'Legacy', subject: 'Legacy', body: 'Legacy customer body', is_enabled: false };
assert.match((await context.getEmailTemplate(env, 'payment_failed:user')).body, /قیمت تک محصول/);
assert.equal((await context.getEmailTemplate(env, 'payment_failed:admin')).is_enabled, false);
await context.seedDefaultEmailTemplates(env, 1);
assert.equal((await context.getEmailTemplate(env, 'order_created:admin')).body, 'Custom body');
assert.equal((await context.getAllEmailTemplates(env)).length, 20);

for (const entry of (await context.getAllEmailTemplates(env)).filter(t => t.audience === 'admin')) {
  const event = entry.base_event;
  await context.toggleEmailTemplate(env, event + ':user', true, 1);
  await context.toggleEmailTemplate(env, event + ':admin', false, 1);
  sent.length = 0;
  for (const isUserNotification of [true, false]) {
    await context.sendEmailWithTemplate(env, { eventType: event, recipient: 'test@example.com', data: {}, isUserNotification });
  }
  assert.equal(sent.length, 1, event + ': admin disabled independently');
  await context.toggleEmailTemplate(env, event + ':user', false, 1);
  await context.toggleEmailTemplate(env, event + ':admin', true, 1);
  sent.length = 0;
  for (const isUserNotification of [true, false]) {
    await context.sendEmailWithTemplate(env, { eventType: event, recipient: 'test@example.com', data: {}, isUserNotification });
  }
  assert.equal(sent.length, 1, event + ': user disabled independently');
}

await context.toggleEmailTemplate(env, 'wallet_credit:user', false, 1);
sent.length = 0;
await context.sendWalletEmailNotification(env, user.id, 'wallet_credit', user, { amount: 100 });
assert.equal(sent.length, 1);
assert.equal(sent[0].to[0], config.admin_email);
enabled = 0;
sent.length = 0;
await sendUser(); await sendAdmin();
assert.equal(sent.length, 0);

const container = { innerHTML: '' };
const window = { esc: value => String(value), api: async () => ({ ok: true, data: { success: true, data: await context.getAllEmailTemplates(env) } }) };
vm.runInNewContext(fs.readFileSync(new URL('../admin/assets/js/notifications.js', import.meta.url), 'utf8'), {
  window, console, document: { documentElement: { dataset: {} }, addEventListener() {}, getElementById: () => container }
});
await window.loadEmailTemplates();
assert.equal((container.innerHTML.match(/data-toggle-email-template=/g) || []).length, 20);
assert.match(container.innerHTML, /ثبت سفارش — مدیریت/);
assert.match(container.innerHTML, /ثبت سفارش — کاربر/);
assert.match(container.innerHTML, /data-toggle-email-template="order_created:admin"/);
assert.match(container.innerHTML, /data-toggle-email-template="order_created:user"/);
console.log('PASS: independent delivery, switches, rendering, persistence, legacy settings, wallet, channel off, and admin UI');
