const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const esbuild = require('../sms-worker/node_modules/esbuild');
const { Miniflare, convertV4MiniflareOptions } = require('../sms-worker/node_modules/miniflare');
const sourceRoot = process.env.PURCHASE_RELEASE_DIR || path.resolve('.');

test('purchase limits validate positive integers, preserve partial edits and reject inverted ranges', async () => {
  const bundle = await esbuild.build({ entryPoints: [path.join(sourceRoot, 'functions/lib/purchase-limits.js')], bundle: true, write: false, format: 'cjs' });
  const context = { module: { exports: {} } }; vm.createContext(context); vm.runInContext(bundle.outputFiles[0].text, context);
  const read = context.module.exports.readPurchaseLimits;
  assert.equal(read({ purchase_min_quantity: '۲', purchase_max_quantity: '١٠' }).max, 10);
  assert.equal(read({}, { purchase_min_quantity: 2, purchase_max_quantity: 10 }).min, 2);
  assert.equal(read({}, { purchase_min_quantity: 2, purchase_max_quantity: 10 }).max, 10);
  assert.equal(read({ purchase_max_quantity: null }, { purchase_min_quantity: 2, purchase_max_quantity: 10 }).max, null);
  for (const body of [{ purchase_min_quantity: 0 }, { purchase_min_quantity: -1 }, { purchase_min_quantity: 2.5 }, { purchase_max_quantity: 'abc' }, { purchase_min_quantity: 10, purchase_max_quantity: 2 }]) assert(read(body).error);
});

test('cart clamps every add/update to configured limits and refuses insufficient stock', () => {
  const store = new Map(), product = { id: 1, slug: 'fixture', name: 'Fixture', price: 100, inStock: true, stockQty: 20, purchaseMinQty: 2, purchaseMaxQty: 10 };
  const window = { PRODUCTS: [product], addEventListener() {}, dispatchEvent() {} };
  const document = { readyState: 'loading', addEventListener() {}, dispatchEvent() {}, querySelectorAll: () => [] };
  const context = { window, document, localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) }, CustomEvent: class {}, Intl, setTimeout() {} };
  vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(sourceRoot, 'assets/js/cart.js'), 'utf8'), context);
  const cart = window.CartStore;
  cart.addToCart('fixture', 1); assert.equal(cart.getRawItems()[0].quantity, 2);
  cart.addToCart('fixture', 100); assert.equal(cart.getRawItems()[0].quantity, 10);
  cart.updateQuantity('fixture', 1); assert.equal(cart.getRawItems()[0].quantity, 2);
  cart.updateQuantity('fixture', 99); assert.equal(cart.getRawItems()[0].quantity, 10);
  cart.clearCart(); product.stockQty = 1; assert.equal(cart.addToCart('fixture', 2).success, false);
});

test('admin limits persist in D1, public API returns them and checkout enforces aggregate quantities', async () => {
  const fixtures = {
    admin: "export async function requireAdmin(){return {ok:true,user:{id:1,role:'admin'}};} export async function getCurrentUser(){return {id:1,full_name:'Fixture',phone:'09120000000'};} export async function logAdminAction(){}",
    rate: 'export async function getCurrentRate(){return {rate:100};} export function calculateProductPrice(p){return Number(p.price)||0;}',
    notification: 'export async function sendLowStockNotification(){} export async function sendOrderCreatedNotification(){} export async function sendUserOrderCreatedNotification(){}',
    'delivery-availability': "export async function validateDeliveryChoice(){return {ok:true,date:'1405/07/20',slot:{id:1,start_time:'10:00',end_time:'14:00'}};}",
  };
  const bundle = await esbuild.build({ stdin: { resolveDir: sourceRoot, contents: `
    import * as admin from './functions/api/admin/products.js';
    import * as detail from './functions/api/admin/products/[id].js';
    import {onRequestGet as list} from './functions/api/products.js';
    import {validateProductStock,onRequestPost as checkout} from './functions/api/account/create-order.js';
    export default {async fetch(request,env){const url=new URL(request.url),c={request,env,params:{id:url.searchParams.get('id')}};
      if(url.pathname==='/stock')return Response.json(await validateProductStock(env.DB,await request.json()));
      if(url.pathname==='/checkout')return checkout(c);if(url.pathname==='/public')return list(c);
      const api=url.pathname==='/detail'?detail:admin;return api['onRequest'+({POST:'Post',PUT:'Put',GET:'Get'})[request.method]](c);}};
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', plugins: [{ name: 'isolated-purchase-fixtures', setup(build) {
    build.onLoad({ filter: /create-order\.js$/ }, args => ({ contents: fs.readFileSync(args.path, 'utf8') + '\nexport {validateProductStock};', resolveDir: path.dirname(args.path) }));
    build.onResolve({ filter: /\/lib\/(admin|rate|notification|delivery-availability)(\.js)?$/ }, args => ({ path: path.basename(args.path).replace(/\.js$/, ''), namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: fixtures[args.path] }));
  } }] });
  const runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-07-08', host: '127.0.0.1', port: 0, d1Databases: { DB: '00000000-0000-0000-0000-000000000082' }, outboundService: () => { throw Error('No external requests'); } }));
  try {
    const { DatabaseSync } = require('node:sqlite'), schema = new DatabaseSync(':memory:');
    schema.exec(fs.readFileSync('schema.production.sql', 'utf8'));
    const db = await runtime.getD1Database('DB');
    for (const name of ['products', 'product_images']) await db.prepare(schema.prepare('SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=?').get(name).sql).run();
    schema.close();
    const call = (route, method, body) => runtime.dispatchFetch('https://fixture.invalid' + route, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const payload = { name: 'Fixture Product', slug: 'fixture-product', price: 100, show_price: true, stock_quantity: 20, status: 'published', purchase_min_quantity: 2, purchase_max_quantity: 10, images: [] };
    let response = await call('/admin', 'POST', payload); assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
    const row = await db.prepare('SELECT * FROM products WHERE slug=?').bind(payload.slug).first(); assert.equal(row.purchase_min_quantity, 2); assert.equal(row.purchase_max_quantity, 10);
    const publicResult = await (await call('/public', 'GET')).json(); assert.equal(publicResult.products[0].purchaseMinQty, 2); assert.equal(publicResult.products[0].purchaseMaxQty, 10);
    const stock = async quantities => (await (await call('/stock', 'POST', quantities.map(quantity => ({ product_id: row.id, quantity })))).json());
    assert.equal((await stock([1])).error, 'purchase_min_quantity'); assert.equal((await stock([11])).error, 'purchase_max_quantity');
    assert.equal((await stock([6, 6])).error, 'purchase_max_quantity'); assert.equal((await stock([1, 1])).success, true);
    for (const quantity of [2, 10]) assert.equal((await stock([quantity])).success, true);
    for (const quantity of [1, 11]) {
      const body = { address: { full_name: 'Fixture', address_line: 'Fixture', city: 'Fixture', state: 'Fixture' }, order: { total_amount: quantity * 100, items: [{ product_id: row.id, quantity, unit_price: 100 }] } };
      response = await call('/checkout', 'POST', body); assert.equal(response.status, 400);
      assert.equal((await response.json()).error, quantity === 1 ? 'purchase_min_quantity' : 'purchase_max_quantity');
    }
    response = await call('/detail?id=' + row.id, 'PUT', { purchase_min_quantity: 3, purchase_max_quantity: 9 }); assert.equal(response.status, 200);
    response = await call('/detail?id=' + row.id, 'PUT', { purchase_min_quantity: 10, purchase_max_quantity: 2 }); assert.equal(response.status, 400);
    response = await call('/admin', 'PUT', { ...payload, id: row.id, purchase_min_quantity: 4, purchase_max_quantity: 8 }); assert.equal(response.status, 200);
    response = await call('/admin', 'PUT', { id: row.id, name: payload.name, slug: payload.slug, price: 100, stock_quantity: 20, status: 'published' }); assert.equal(response.status, 200);
    const edited = await db.prepare('SELECT * FROM products WHERE id=?').bind(row.id).first(); assert.equal(edited.purchase_min_quantity, 4); assert.equal(edited.purchase_max_quantity, 8); assert.equal(edited.stock_quantity, 20);
  } finally { await runtime.dispose(); }
});
