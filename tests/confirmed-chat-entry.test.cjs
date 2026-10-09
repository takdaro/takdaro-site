const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const loggedIn of [false, true]) test('confirmed chat bridge preserves ' + (loggedIn ? 'site identity' : 'independent guest login'), async () => {
  const listeners = {}, messages = [];
  const frame = { style: { display: 'block' }, contentWindow: { postMessage(data, origin) { messages.push({ data, origin }); } } };
  const api = { open() {}, toggle() {} };
  const window = { TakdaroChat: api, addEventListener(name, callback) { listeners[name] = callback; } };
  const document = { querySelector(selector) { return selector.startsWith('iframe.') ? frame : null; } };
  let calls = 0;
  const fetch = async (url, options) => {
    calls++;
    assert.equal(url, '/api/chat/identity-token');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.method, 'POST');
    return { ok: loggedIn, status: loggedIn ? 200 : 401, json: async () => loggedIn ? { success: true, token: 'signed-fixture' } : { success: false } };
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/chat-identity-bridge.js'), 'utf8'),
    { window, document, fetch, localStorage: { getItem() { return null; } } });
  listeners.message({ origin: 'https://wrong.invalid', source: frame.contentWindow, data: { type: 'takdaro:ready' } });
  assert.equal(calls, 0);
  listeners.message({ origin: 'https://chat.takdaro.com', source: frame.contentWindow, data: { type: 'takdaro:ready' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  const identity = messages.find(m => m.data.type === (loggedIn ? 'takdaro:identity' : 'takdaro:guest'));
  assert(identity);
  assert.equal(identity.origin, 'https://chat.takdaro.com');
  if (loggedIn) assert.equal(identity.data.token, 'signed-fixture');
  assert(!messages.some(m => m.data.type === 'takdaro:identity-error'));
});
