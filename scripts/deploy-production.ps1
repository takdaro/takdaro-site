param([Parameter(Mandatory = $true)][string]$ExpectedDeployment)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Git-Output([string[]]$Arguments) {
  $result = & git @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Git failed: $Arguments" }
  return $result
}
if ($ExpectedDeployment -notmatch '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$') { throw 'Invalid expected deployment.' }
if (Git-Output @('status', '--porcelain')) { throw 'Preserve or commit working changes first.' }
if ((Git-Output @('branch', '--show-current')) -ne 'main') { throw 'Production requires main.' }
Git-Output @('fetch', 'origin')
$revision = Git-Output @('rev-parse', 'HEAD')
if ($revision -ne (Git-Output @('rev-parse', 'origin/main'))) { throw 'Local main must equal GitHub main.' }
node --test tests/confirmed-release.test.cjs tests/chat-entry.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'Chat entry test failed.' }
$root = Split-Path $PSScriptRoot -Parent
$wrangler = Join-Path $root 'sms-worker/node_modules/wrangler/bin/wrangler.js'
$tokenText = & node $wrangler auth token --json
if ($LASTEXITCODE -ne 0) { throw 'Cloudflare authentication failed.' }
$token = ($tokenText | ConvertFrom-Json).token
if (-not $token) { throw 'No authentication token.' }
$uri = 'https://api.cloudflare.com/client/v4/accounts/0e9a63389a20574facfbe8e4fc13013e/pages/projects/takdaro-site'
function Project {
  $response = Invoke-RestMethod -Uri $uri -Headers @{Authorization = "Bearer $token"}
  if (-not $response.success) { throw 'Cloudflare check failed.' }
  return $response.result
}
$project = Project
if ($project.canonical_deployment.id -ne $ExpectedDeployment) { throw 'Active deployment changed; review again.' }
if ($project.source.config.production_deployments_enabled -ne $false) { throw 'Automatic production deployments must be disabled.' }
$stem = 'confirmed-' + [guid]::NewGuid().ToString()
$candidate = Join-Path $root ".wrangler/$stem-release"
$builtText = & node "$PSScriptRoot/confirmed-release.cjs" $candidate
if ($LASTEXITCODE -ne 0) { throw 'Approved release build failed.' }
$built = $builtText | ConvertFrom-Json
if ((Project).canonical_deployment.id -ne $ExpectedDeployment) { throw 'Production changed while building.' }
Push-Location $candidate
try {
  & node $wrangler pages deploy . --project-name takdaro-site --branch main --commit-hash $revision --commit-dirty=false
  if ($LASTEXITCODE -ne 0) { throw 'Deployment failed; do not claim success.' }
} finally { Pop-Location }
$after = Project
if ($after.canonical_deployment.deployment_trigger.metadata.commit_hash -ne $revision) { throw 'Unexpected published revision.' }
@{published = $true; observedDeployment = $after.canonical_deployment.id; candidateHash = $built.packageHash;
  revision = $revision; previousDeployment = $ExpectedDeployment; productionDataWritten = $false} |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root ".wrangler/$stem-record.json") -Encoding utf8
Write-Output "Published approved inventory only: $($after.canonical_deployment.id)"
