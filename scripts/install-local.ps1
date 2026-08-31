param(
  [string]$NodeDirectory = '',
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$local = Join-Path $repo '.local'
if (-not $NodeDirectory) {
  $NodeDirectory = Join-Path $local 'runtime/node-v25.7.0-win-x64'
}
$node = Join-Path $NodeDirectory 'node.exe'
if (-not (Test-Path -LiteralPath $node)) { throw "Node runtime missing: $node" }
$version = & $node -p 'process.versions.node'
if ([version]$version -lt [version]'25.7.0') { throw 'Node >=25.7.0 is required.' }
$env:PATH = "$NodeDirectory;" + $env:PATH
$env:TEMP = $env:TMP = $env:TMPDIR = Join-Path $local 'tmp'
$env:npm_config_cache = Join-Path $local 'npm-cache'
$env:npm_config_prefix = Join-Path $local 'prefix'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $local 'browsers'
$bin = Join-Path $local 'bin'
New-Item -ItemType Directory -Force $bin, $env:TEMP, (Join-Path $local 'state') | Out-Null
Push-Location $repo
try {
  if (-not $SkipBuild) {
    & (Join-Path $NodeDirectory 'npm.cmd') run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed; launcher was not installed.' }
  }
  if (-not (Test-Path 'dist/cli/index.js')) { throw 'Build output is missing.' }
  & (Join-Path $NodeDirectory 'npm.cmd') link --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Local package linking failed.' }
} finally { Pop-Location }

# Development launchers pin storage and the runtime without changing cwd.
$entries = @{
  'h0x-cli' = 'cli/index.js'
  'atomic-agent' = 'cli/index.js'
  'atag' = 'cli/index.js'
  'atomic-agent-sidecar' = 'sidecar/main.js'
}
foreach ($name in $entries.Keys) {
  $entry = $entries[$name]
  $launcher = @"
@echo off
setlocal
set "PATH=$NodeDirectory;%PATH%"
set "TEMP=$local\tmp"
set "TMP=$local\tmp"
set "TMPDIR=$local\tmp"
set "ATOMIC_AGENT_STATE_DIR=$local\state"
set "npm_config_cache=$local\npm-cache"
set "npm_config_prefix=$local\prefix"
set "PLAYWRIGHT_BROWSERS_PATH=$local\browsers"
"$node" "$repo\dist\$entry" %*
exit /b %errorlevel%
"@
  Set-Content -LiteralPath (Join-Path $bin "$name.cmd") -Value $launcher -Encoding ascii
}
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (@($userPath -split ';') -notcontains $bin) {
  [Environment]::SetEnvironmentVariable('Path', "$bin;$userPath", 'User')
}
$env:PATH = "$bin;" + $env:PATH
Write-Output "Installed h0x-cli at $bin. New terminals will use the updated user PATH."
