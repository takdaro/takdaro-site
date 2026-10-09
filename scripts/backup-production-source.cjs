const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const repository = 'https://github.com/takdaro/takdaro-site.git';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function loadReference(directory, revision, deployment) {
  if (!/^[a-f0-9]{40}$/.test(revision || '')) throw Error('Invalid deployment revision');
  if (deployment !== undefined) {
    if (!require('./backup-deployed-package.cjs').deploymentId(deployment)) throw Error('Invalid deployment identity');
    const scoped = path.join(directory, 'deployment-' + deployment);
    if (fs.existsSync(scoped)) directory = scoped;
  }
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'source-' + revision + '.json'), 'utf8'));
  const bytes = fs.readFileSync(path.join(directory, 'source-' + revision + '.zip'));
  if (metadata.format !== 1 || metadata.repository !== repository || metadata.revision !== revision ||
      metadata.zipSha256 !== sha(bytes) || metadata.zipBytes !== bytes.length || bytes.length === 0 ||
      bytes.length > 256 * 1024 * 1024 || metadata.uploadedBytesVerified !== false ||
      (metadata.deploymentId && metadata.deploymentId !== deployment)) {
    throw Error('Source reference integrity or provenance failed');
  }
  return { metadata, bytes };
}

function prepare(restore, directory) {
  const project = JSON.parse(fs.readFileSync(path.join(restore, 'additional/cloudflare/pages-project.json'), 'utf8'));
  return prepareProject(project, directory);
}

function prepareProject(project, directory, localRoot) {
  if (project.name !== 'takdaro-site') throw Error('Unexpected source project');
  const revision = project.canonical_deployment?.deployment_trigger?.metadata?.commit_hash;
  if (!/^[a-f0-9]{40}$/.test(revision || '')) throw Error('No exact deployment commit recorded');
  const deployed = localRoot ? require('./backup-deployed-package.cjs').findPackage(localRoot, project) : null;
  if (deployed) {
    const scoped = path.join(directory, 'deployment-' + deployed.deploymentId);
    fs.mkdirSync(scoped, { recursive: true });
    const metadataPath = path.join(scoped, 'source-' + revision + '.json');
    if (fs.existsSync(metadataPath)) {
      const saved = loadReference(directory, revision, deployed.deploymentId).metadata;
      if (saved.packageHash !== deployed.packageHash) throw Error('Cached deployment package differs');
      return saved;
    }
    const zip = path.join(scoped, 'source-' + revision + '.zip');
    if (fs.existsSync(zip)) throw Error('Incomplete deployment archive; not overwritten');
    require('./backup-deployed-package.cjs').archivePackage(deployed, zip, path.join(scoped, 'inventory.json'));
    const bytes = fs.readFileSync(zip);
    const metadata = { format: 1, repository, revision, deploymentId: deployed.deploymentId,
      packageHash: deployed.packageHash, capturedAt: new Date().toISOString(), zipSha256: sha(bytes), zipBytes: bytes.length,
      provenance: 'Hash-verified package recorded as successfully published to the currently active deployment',
      acquisition: 'Recorded deployment package including uncommitted published changes',
      recordedDeploymentPackageVerified: true, uploadedBytesVerified: false, localWorkingTreeModified: false, productionChanged: false };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), { flag: 'wx' });
    return loadReference(directory, revision, deployed.deploymentId).metadata;
  }
  fs.mkdirSync(directory, { recursive: true });
  const zipFile = path.join(directory, 'source-' + revision + '.zip');
  const metadataFile = path.join(directory, 'source-' + revision + '.json');
  if (fs.existsSync(metadataFile)) return loadReference(directory, revision).metadata;
  if (fs.existsSync(zipFile)) throw Error('Incomplete existing source reference; not overwritten');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'takdaro-source-reference-'));
  const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, maxBuffer: 8 * 1024 * 1024 });
  try {
    let archiveRepository = temporary;
    let acquisition = 'Fetched exact commit from GitHub';
    if (localRoot) {
      try {
        const origin = git(['-C', localRoot, 'remote', 'get-url', 'origin']).trim();
        if (![repository, 'https://github.com/takdaro/takdaro-site', 'git@github.com:takdaro/takdaro-site.git'].includes(origin)) throw Error('Unexpected repository');
        if (git(['-C', localRoot, 'rev-parse', '--verify', revision + '^{commit}']).trim() !== revision) throw Error('Commit mismatch');
        archiveRepository = localRoot;
        acquisition = 'Exact existing local Git commit object; fresh GitHub comparison not performed';
      } catch { /* Fetch from the pinned repository if no verified local object is available. */ }
    }
    if (archiveRepository === temporary) {
      git(['init', '--bare', temporary]);
      git(['-C', temporary, 'fetch', '--depth=1', repository, revision]);
      const fetched = git(['-C', temporary, 'rev-parse', 'FETCH_HEAD']).trim();
      if (fetched !== revision) throw Error('Fetched revision mismatch');
    }
    const archive = path.join(temporary, 'source.zip');
    git(['-C', archiveRepository, 'archive', '--format=zip', '--output=' + archive, revision]);
    const bytes = fs.readFileSync(archive);
    if (!bytes.length || bytes.length > 256 * 1024 * 1024) throw Error('Source archive exceeds safe bounds');
    const metadata = { format: 1, repository, revision, capturedAt: new Date().toISOString(),
      zipSha256: sha(bytes), zipBytes: bytes.length, provenance: 'Exact Git commit recorded in archived Pages deployment metadata',
      acquisition, uploadedBytesVerified: false, localWorkingTreeModified: false, productionChanged: false };
    fs.writeFileSync(zipFile, bytes, { flag: 'wx' });
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), { flag: 'wx' });
    loadReference(directory, revision);
    return metadata;
  } finally {
    if (path.dirname(temporary) === os.tmpdir() && path.basename(temporary).startsWith('takdaro-source-reference-')) {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
}
if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw Error('Restore and private source-reference directory required');
    const metadata = prepare(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
    console.log(JSON.stringify({ revision: metadata.revision.slice(0, 12), archiveBytes: metadata.zipBytes,
      archiveIntegrityVerified: true, uploadedBytesVerified: false, localWorkingTreeModified: false, productionChanged: false }));
  } catch { console.error('Separate source capture failed; private details suppressed; no deployment performed'); process.exitCode = 1; }
}
module.exports = { prepare, prepareProject, loadReference, repository };
