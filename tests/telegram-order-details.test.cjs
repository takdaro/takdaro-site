const { test } = require('node:test');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const esbuild = require('../sms-worker/node_modules/esbuild');
const sourceRoot = path.resolve(process.env.TELEGRAM_RELEASE_DIR || '.');
async function load() {
  const bundle = await esbuild.build({ entryPoints: [path.join(sourceRoot, 'functions/api/telegram/webhook.js')], bundle: true, write: false, format: 'cjs', platform: 'browser', plugins: [{ name: 'test-exports', setup(build) {
    build.onLoad({ filter: /api[\\/]telegram[\\/]webhook\.js$/ }, args => ({ contents: fs.readFileSync(args.path, 'utf8') + '\nexport {getLastOrder,buildOrderDetailsMessage};', resolveDir: path.dirname(args.path) }));
  } }] });
  const context = { module: { exports: {} }, Intl, Date, TextEncoder, console, fetch() { throw Error('No external requests allowed'); } };
  vm.createContext(context); vm.runInContext(bundle.outputFiles[0].text, context);
  return context.module.exports;
}
test('last order query selects stored shipping schedule and remains scoped to its owner', async () => {
  const { getLastOrder } = await load(), queries = [];
  const order = { id: 7, delivery_date: '1405/07/20', delivery_time_from: '11:00', delivery_time_to: '14:00' };
  const DB = { prepare(sql) { queries.push(sql); return { bind(id) {
    assert.equal(id, sql.includes('FROM orders o') ? 54 : 7);
    return { async first() { return order; }, async all() { return { results: [] }; } };
  } }; } };
  const result = await getLastOrder({ DB }, 54);
  assert.equal(result.order.delivery_date, order.delivery_date);
  for (const field of ['delivery_date', 'delivery_time_from', 'delivery_time_to']) assert(queries[0].includes('o.' + field));
  assert(queries[0].includes('WHERE o.user_id = ?'));
});
test('bot order details reuse schedule labels and delivery code while preserving existing contents', async () => {
  const { buildOrderDetailsMessage } = await load();
  const order = { order_number: 'TT-20261008-296377', status: 'payment_pending', payment_status: 'pending', created_at: '2026-10-08T10:00:00Z', delivery_date: '1405/07/20', delivery_time_from: '11:00', delivery_time_to: '14:00', subtotal_amount: 100, total_amount: 100, payable_amount: 100, cashback_amount: 20 };
  const render = (value, cashback = false) => buildOrderDetailsMessage(value, [{ product_name: 'Fixture Product', quantity: 2, total_price: 100 }], cashback);
  let text = render(order);
  for (const expected of ['TT-20261008-296377', 'Fixture Product', 'زمان تقریبی ارسال', '1405/07/20', '11:00 تا 14:00', '6377']) assert(text.includes(expected));
  assert(!text.includes('کش‌بک'));
  text = render({ ...order, status: 'payment_success', payment_status: 'paid' });
  assert(text.includes('<b>زمان ارسال:</b>')); assert(!text.includes('زمان تقریبی ارسال'));
  assert(render(order, true).includes('کش‌بک'));
  text = render({ ...order, delivery_date: '1405/07/21', delivery_time_from: '15:00', delivery_time_to: '18:00' });
  assert(text.includes('1405/07/21')); assert(text.includes('15:00 تا 18:00')); assert(!text.includes('1405/07/20'));
  text = render({ ...order, delivery_date: '', delivery_time_from: '', delivery_time_to: '' });
  assert(!text.includes('زمان تقریبی ارسال')); assert(text.includes('6377'));
});
