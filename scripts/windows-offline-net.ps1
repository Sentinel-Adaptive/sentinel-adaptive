param(
  [ValidateSet("add", "remove")]
  [string]$Action,
  [string]$Programs = "",
  [string]$RequestPath = ""
)

$ErrorActionPreference = "Stop"
$rulePrefix = "SentinelAdaptive-Stage9-Offline"

if ($RequestPath) {
  $request = Get-Content -LiteralPath $RequestPath -Raw | ConvertFrom-Json
  $Action = [string]$request.Action
  $Programs = [string](@($request.Programs) -join ";")
}

if (-not $Action) {
  Write-Output "Action is required."
  exit 1
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Output "Administrator rights are required to toggle outbound firewall rules."
  exit 2
}

function Remove-Stage9Rules {
  Get-NetFirewallRule -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like "$rulePrefix*" } |
    ForEach-Object { Remove-NetFirewallRule -Name $_.Name }
}

if ($Action -eq "remove") {
  Remove-Stage9Rules
  Write-Output "Removed Stage 9 outbound block rules."
  exit 0
}

$programPaths = @($Programs -split ";" | Where-Object { $_.Trim() -ne "" })
if ($programPaths.Count -eq 0) {
  Write-Output "At least one program path is required when adding rules."
  exit 1
}

Remove-Stage9Rules
$index = 0
foreach ($path in $programPaths) {
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Output "Program not found: $path"
    exit 1
  }
  $index += 1
  New-NetFirewallRule `
    -DisplayName "$rulePrefix-$index" `
    -Direction Outbound `
    -Action Block `
    -Program $path `
    -Profile Any `
    -Enabled True |
    Out-Null
}

Write-Output "Added $($programPaths.Count) Stage 9 outbound block rule(s)."
