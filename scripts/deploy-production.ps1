$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Git-Output([string[]]$Arguments) {
  $result = & git @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Git failed: $Arguments" }
  return $result
}
if (Git-Output @('status', '--porcelain')) { throw 'Commit all changes before deployment.' }
if ((Git-Output @('branch', '--show-current')) -ne 'main') { throw 'Production requires main.' }
Git-Output @('fetch', 'origin')
$revision = Git-Output @('rev-parse', 'HEAD')
if ($revision -ne (Git-Output @('rev-parse', 'origin/main'))) { throw 'Local main must equal GitHub main.' }
node --test tests/chat-entry.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'Chat entry test failed.' }
& "$PSScriptRoot/../sms-worker/node_modules/.bin/wrangler.cmd" pages deploy . --project-name takdaro-site --branch main --commit-hash $revision --commit-dirty=false
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed.' }
