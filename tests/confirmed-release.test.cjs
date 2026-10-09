const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { build } = require('../scripts/confirmed-release.cjs');
test('builds only approved Git blobs and refuses unreviewed or dirty content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'confirmed-source-'));
  const git = args => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  try {
    git(['init']); git(['config', 'user.name', 'Release test']); git(['config', 'user.email', 'test@recovery.invalid']);
    git(['config', 'core.autocrlf', 'false']);
    fs.mkdirSync(path.join(root, 'release'));
    fs.writeFileSync(path.join(root, 'index.html'), 'approved\r\n');
    fs.writeFileSync(path.join(root, 'extra.html'), 'not deployed');
    const sha = b => crypto.createHash('sha256').update(b).digest('hex');
    const files = [['index.html', sha('approved\r\n')]];
    fs.writeFileSync(path.join(root, 'release/confirmed.json'), JSON.stringify({ format: 1, files, packageHash: sha(JSON.stringify(files)) }));
    git(['add', '.']); git(['commit', '-m', 'fixture']);
    const output = path.join(root, '.git/output');
    assert.equal(build(root, output).files, 1);
    assert.equal(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), 'approved\r\n');
    assert(!fs.existsSync(path.join(output, 'extra.html')));
    assert.throws(() => build(root, output), /already exists/);
    fs.writeFileSync(path.join(root, 'index.html'), 'changed');
    assert.throws(() => build(root, path.join(root, '.git/dirty')), /working changes/);
    git(['add', 'index.html']); git(['commit', '-m', 'unreviewed']);
    assert.throws(() => build(root, path.join(root, '.git/mismatch')), /Unreviewed change/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
