const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function build(root, output) {
  const git = args => execFileSync('git', ['-C', root, ...args], { maxBuffer: 64 * 1024 * 1024 });
  const manifest = JSON.parse(git(['show', 'HEAD:release/confirmed.json']));
  assert.equal(manifest.format, 1);
  assert.equal(sha(JSON.stringify(manifest.files)), manifest.packageHash);
  assert.equal(git(['status', '--porcelain']).toString().trim(), '', 'Commit or preserve working changes before building');
  assert(!fs.existsSync(output), 'Output already exists; never overwrite a release');
  const files = manifest.files.map(([name, hash]) => {
    assert(!name.includes('\\') && !name.startsWith('/') && !name.split('/').includes('..'));
    const bytes = git(['show', 'HEAD:' + name]);
    assert.equal(sha(bytes), hash, 'Unreviewed change: ' + name);
    return [name, bytes];
  });
  // Read Git blobs, not checkout bytes: Windows line-ending conversion must not alter the release.
  for (const [name, bytes] of files) {
    const target = path.join(output, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx' });
  }
  return { revision: git(['rev-parse', 'HEAD']).toString().trim(), files: files.length,
    packageHash: manifest.packageHash, baselineDeployment: manifest.deploymentId, output };
}
module.exports = { build };
if (require.main === module) {
  try {
    assert(process.argv[2], 'Provide a new output folder');
    console.log(JSON.stringify(build(path.resolve(__dirname, '..'), path.resolve(process.argv[2]))));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
