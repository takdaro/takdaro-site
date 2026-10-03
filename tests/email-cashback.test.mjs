import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
let cashback = { cashback_enabled: '1', cashback_percent: '5', cashback_eligibility_mode: 'all', cashback_selected_user_ids: '12' };
let role = 'customer';
const sent = [];
let templates = {};
const DB = { prepare(sql) { return {
  bind() { return this; },
  async all() { return { results: Object.entries(cashback).map(([setting_key, setting_value]) => ({setting_key, setting_value})) }; },
  async first() {
    if (sql.includes('FROM orders')) return { user_id: 12 };
    if (sql.includes('FROM users')) return { role };
    return { id: 1, is_enabled: 1, config: JSON.stringify({admin_email:'admin@example.com',templates}) };
  },
  async run() { return { meta: { last_row_id: 1 } }; }
}; } };
const ctx = vm.createContext({ console, getDb: env => env.DB, getStatusLabel: value => value,
  fetch: async (_url, request) => { sent.push(JSON.parse(request.body)); return { ok: true, json: async () => ({ id: 'mock' }) }; }
});
for (const file of ['functions/lib/cashback-settings.js', 'functions/lib/email.js']) {
  const source = fs.readFileSync(root + file, 'utf8').replace(/import .* from .*;\r?\n/g, '').replace(/export (?=(?:async )?function)/g, '').replace(/export \{[\s\S]*?\};/g, '');
  vm.runInContext(source, ctx);
}
const env = { DB, RESEND_API_KEY: 'mock' };
const user = { id: 12, fullName: 'Customer', email: 'customer@example.com' };
const order = { orderId: 99, orderNumber: 'TEST', totalAmount: 1000, cashbackAmount: 50 };
async function check(expected) {
  sent.length = 0;
  await ctx.sendUserEmailNotification(env, 12, 'order_created', order, user);
  await ctx.sendAdminEmailNotification(env, 'order_created', order, user);
  assert.equal(sent.length, 2);
  for (const message of sent) {
    assert.equal(message.html.includes('کش‌بک این سفارش'), expected);
    assert.ok(message.html.includes('TEST'));
    assert.equal(message.to.length, 1);
  }
}
await check(true);
cashback.cashback_enabled = '0'; await check(false);
cashback.cashback_enabled = '1'; cashback.cashback_eligibility_mode = 'selected'; cashback.cashback_selected_user_ids = '112'; await check(false);
cashback.cashback_selected_user_ids = '12'; await check(true);
cashback.cashback_eligibility_mode = 'vip'; await check(false);
role = 'vip'; await check(true);
cashback.cashback_percent = '0'; await check(false);
cashback.cashback_percent = '5'; order.cashbackAmount = 0; await check(false);
order.cashbackAmount = 50;
cashback.cashback_enabled = '0';
templates = { 'order_created:admin': {is_enabled:true,subject:'Saved template',body:'<p>TEST</p><div class="cashback-box"><div class="icon">🎁</div><div><strong>{cashback_amount}</strong> کش‌بک این سفارش</div></div><p>KEEP FOOTER</p>'} };
await check(false);
assert.ok(sent[1].html.includes('KEEP FOOTER'));
assert.ok(!sent[1].html.includes('<strong>۵۰</strong>'));
templates = {};
sent.length = 0;
const result = await ctx.sendWalletEmailNotification(env, 12, 'cashback_applied', user, {amount:50});
assert.equal(result.results.user.skipped, true);
assert.equal(result.results.admin.skipped, true);
assert.equal(sent.length, 0);
cashback.cashback_enabled = '1';
await ctx.sendWalletEmailNotification(env, 12, 'cashback_applied', user, {amount:50});
assert.equal(sent.length, 2);
assert.ok(sent.every(message => message.html.includes('کش‌بک')));
sent.length = 0; cashback.cashback_enabled = '0';
await ctx.sendWalletEmailNotification(env, 12, 'wallet_credit', user, {amount:50});
assert.equal(sent.length, 2);
const child = await import('node:child_process');
const syntax = child.spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(root+'functions/lib/email.js'), encoding:'utf8' });
assert.equal(syntax.status, 0, syntax.stderr);
console.log('PASS: customer/admin, global off/on, selected users, VIP, zero amount/percent, saved nested template, dedicated cashback and unrelated wallet emails, syntax. No real emails sent.');
