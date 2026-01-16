param(
  [string]$BindHost = "0.0.0.0",
  [int]$BindPort = 8000,
  [switch]$Reload,
  [switch]$UseSqlite,
  [switch]$BypassLogin
)
$projectRoot = Split-Path $PSScriptRoot -Parent
$backendDir = Join-Path $projectRoot "backend"
Set-Location $backendDir
$uvicornExe = Join-Path $backendDir "venv311\Scripts\uvicorn.exe"
$pythonExe = Join-Path $backendDir "venv311\Scripts\python.exe"
$prodFlag = (($env:PRODUCTION) + "").ToLower()
if ($UseSqlite -or $BypassLogin) {
  if ($prodFlag -eq "true") {
    Write-Error "Dev flags are disabled because PRODUCTION=true"
    exit 1
  }
  $enabled = @()
  if ($UseSqlite) { $enabled += "USE_SQLITE" }
  if ($BypassLogin) { $enabled += "TEST_LOGIN_BYPASS" }
  Write-Warning ("Enabling dev flags: " + ($enabled -join ", "))
}
if ($UseSqlite) { $env:USE_SQLITE = "true" }
if ($BypassLogin) { $env:TEST_LOGIN_BYPASS = "true" }
$args = @("app.main:app", "--host", $BindHost, "--port", $BindPort)
if ($Reload) { $args += "--reload" }
if (Test-Path $uvicornExe) {
  & $uvicornExe @args
} elseif (Test-Path $pythonExe) {
  & $pythonExe "-m" "uvicorn" @args
} else {
  & python "-m" "uvicorn" @args
}