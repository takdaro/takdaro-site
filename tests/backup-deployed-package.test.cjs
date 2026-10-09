const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { findPackage, inventory } = require('../scripts/backup-deployed-package.cjs');
const { prepareProject, loadReference } = require('../scripts/backup-production-source.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'takdaro-deployed-source-'));
  const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const revision = 'a'.repeat(40);
  const project = { name: 'takdaro-site', canonical_deployment: { id, deployment_trigger: { metadata: { commit_hash: revision } } } };
  const release = path.join(root, '.wrangler/fixture-release');
  fs.mkdirSync(release, { recursive: true });
  fs.writeFileSync(path.join(release, 'invoice.html'), 'current invoice without share button');
  fs.writeFileSync(path.join(release, '_headers'), 'header fixture');
  const record = path.join(root, '.wrangler/fixture-record.json');
  const save = () => fs.writeFileSync(record, JSON.stringify({ published: true, observedDeployment: project.canonical_deployment.id, candidateHash: hash(JSON.stringify(inventory(release))) }));
  save();
  return { root, release, record, save, project, revision, id };
}
test('only the package tied to the active deployment is selected; tampering fails closed', () => {
  const f = fixture();
  try {
    assert.equal(findPackage(f.root, f.project).deploymentId, f.id);
    assert.equal(findPackage(f.root, { canonical_deployment: { id: 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee' } }), null);
    fs.appendFileSync(path.join(f.release, 'invoice.html'), 'unexpected changes');
    assert.throws(() => findPackage(f.root, f.project), /package changed/);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
test('confirmed baseline never silently falls back to an old metadata commit', () => {
  const f = fixture();
  try {
    fs.mkdirSync(path.join(f.root, 'release'));
    const reference = path.join(f.root, 'release/confirmed.json');
    fs.writeFileSync(reference, JSON.stringify({ deploymentId: f.id, packageHash: hash(JSON.stringify(inventory(f.release))) }));
    assert.equal(findPackage(f.root, f.project).deploymentId, f.id);
    assert.throws(() => findPackage(f.root, { canonical_deployment: { id: 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee' } }), /refusing stale/);
    assert.throws(() => findPackage(f.root, {}), /refusing stale/);
    fs.writeFileSync(reference, JSON.stringify({ deploymentId: f.id, packageHash: 'wrong' }));
    assert.throws(() => findPackage(f.root, f.project), /source differs/);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('different deployments with the same Git revision retain distinct verified archives', { skip: process.platform !== 'win32' }, () => {
  const f = fixture();
  try {
    const directory = path.join(f.root, 'source-reference');
    const first = prepareProject(f.project, directory, f.root);
    assert.equal(first.recordedDeploymentPackageVerified, true);
    assert.equal(first.uploadedBytesVerified, false);
    assert(loadReference(directory, f.revision, f.id).bytes.length > 0);
    assert.throws(() => loadReference(path.join(directory, 'deployment-' + f.id), f.revision), /integrity/);
    f.project.canonical_deployment.id = 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee';
    fs.writeFileSync(path.join(f.release, 'invoice.html'), 'new published invoice'); f.save();
    const second = prepareProject(f.project, directory, f.root);
    assert.notEqual(first.zipSha256, second.zipSha256);
    assert.equal(loadReference(directory, f.revision, f.id).metadata.zipSha256, first.zipSha256);
    assert.equal(prepareProject(f.project, directory, f.root).zipSha256, second.zipSha256);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
