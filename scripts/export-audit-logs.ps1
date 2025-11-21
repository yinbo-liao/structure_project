$DestRoot = Join-Path (Split-Path $PSScriptRoot -Parent) "audit-exports"
$Source = Join-Path (Split-Path $PSScriptRoot -Parent) "backend\logs"
$Now = Get-Date
$WeekStart = $Now.AddDays(-6)
$RunTag = $Now.ToString("yyyy-MM-dd")
$Dest = Join-Path (Join-Path $DestRoot "weekly") $RunTag
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
for ($i = 0; $i -lt 7; $i++) {
  $d = $WeekStart.AddDays($i).ToString("yyyy-MM-dd")
  $srcFile = Join-Path $Source ($d + ".log")
  if (Test-Path $srcFile) {
    Copy-Item -Path $srcFile -Destination (Join-Path $Dest ($d + ".log")) -Force
  }
}