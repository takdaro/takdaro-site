const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('navigation chat uses the identity-aware opener, including repeated clicks', () => {
  let handler;
  let identified = 0;
  const button = { dataset: {}, addEventListener(type, callback) { handler = callback; } };
  const window = {
    openTakdaroChat() { identified++; },
    TakdaroChat: { open() { assert.fail('SDK must not bypass identity'); } },
    addEventListener() {}
  };
  const document = { readyState: 'complete', body: null, querySelectorAll() { return [button]; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/chat-launcher.js'), 'utf8'), { window, document });
  let prevented = 0;
  const event = { preventDefault() { prevented++; }, stopImmediatePropagation() {} };
  handler(event);
  handler(event);
  assert.equal(identified, 2);
  assert.equal(prevented, 2);
});
