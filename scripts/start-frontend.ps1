param(
  [string]$ApiHost = "http://localhost",
  [int]$ApiPort = 8000,
  [int]$FrontendPort = 3001,
  [switch]$Install
)
$projectRoot = Split-Path $PSScriptRoot -Parent
$frontendDir = Join-Path $projectRoot "frontend"
$prodFlag = (($env:PRODUCTION) + "").ToLower()
if ($prodFlag -eq "true") { Write-Error "Frontend dev start blocked because PRODUCTION=true"; exit 1 }
Set-Location $frontendDir
$env:REACT_APP_API_URL = "${ApiHost}:${ApiPort}/api/v1"
$env:PORT = "$FrontendPort"
if ($Install -or -not (Test-Path (Join-Path $frontendDir "node_modules"))) { npm ci }
npm start