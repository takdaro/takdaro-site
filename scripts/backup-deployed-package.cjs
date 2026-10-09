const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const deploymentId = value => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value || '');
function inventory(directory) {
  const files = [];
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.name === '.wrangler') continue;
      assert(!entry.isSymbolicLink(), 'Deployment package contains a symbolic link');
      const target = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile()) files.push([path.relative(directory, target).replace(/\\/g, '/'), sha(fs.readFileSync(target))]);
    }
  }
  walk(directory);
  return files.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}
function findPackage(root, project) {
  const id = project.canonical_deployment?.id;
  const reference = path.join(root, 'release', 'confirmed.json');
  if (!deploymentId(id)) {
    assert(!fs.existsSync(reference), 'Active deployment identity missing; refusing stale Git commit fallback');
    return null;
  }
  const folder = path.join(root, '.wrangler');
  if (!fs.existsSync(folder)) {
    assert(!fs.existsSync(reference), 'Verified source packages missing; refusing stale Git commit fallback');
    return null;
  }
  const matches = [];
  for (const name of fs.readdirSync(folder).filter(name => /^[a-z0-9-]+-record\.json$/.test(name))) {
    const record = JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8').replace(/^\uFEFF/, ''));
    if (record.published !== true || record.observedDeployment !== id) continue;
    const candidate = path.join(folder, name.replace(/-record\.json$/, '-release'));
    assert(fs.existsSync(candidate), 'Recorded deployment package missing');
    const files = inventory(candidate);
    assert.equal(sha(JSON.stringify(files)), record.candidateHash, 'Recorded deployment package changed');
    matches.push({ directory: candidate, files, deploymentId: id, packageHash: record.candidateHash });
  }
  assert(matches.length <= 1, 'Ambiguous deployment source');
  if (fs.existsSync(reference)) {
    const confirmed = JSON.parse(fs.readFileSync(reference, 'utf8'));
    assert(matches.length === 1, 'Active deployment has no verified source package; refusing stale Git commit fallback');
    if (confirmed.deploymentId === id) {
      assert.equal(matches[0].packageHash, confirmed.packageHash, 'Confirmed production source differs');
    }
  }
  return matches[0] || null;
}
function archivePackage(candidate, output, inventoryFile) {
  fs.writeFileSync(inventoryFile, JSON.stringify(candidate.files), { flag: 'wx' });
  const env = { ...process.env }; delete env.PSModulePath;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'archive-deployed-package.ps1'),
    '-Source', candidate.directory, '-Inventory', inventoryFile, '-Archive', output],
    { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
}
module.exports = { findPackage, archivePackage, inventory, deploymentId };
