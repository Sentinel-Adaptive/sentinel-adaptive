param(
  [ValidateSet("add", "remove")]
  [string]$Action,
  [string]$RequestPath = ""
)

$ErrorActionPreference = "Stop"
$rulePrefix = "SentinelAdaptive-Stage9-Offline"

if ($RequestPath) {
  $request = Get-Content -LiteralPath $RequestPath -Raw | ConvertFrom-Json
  $Action = [string]$request.Action
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

Remove-Stage9Rules

# Block public IPv4. Loopback, RFC1918, and link-local stay reachable so local
# Docker/ClickHouse are not part of this cut. Program-only rules were not enough:
# Node still reached the public probe host after those rules were added.
New-NetFirewallRule `
  -DisplayName "$rulePrefix-Internet4" `
  -Direction Outbound `
  -Action Block `
  -RemoteAddress @(
    "0.0.0.0-9.255.255.255",
    "11.0.0.0-126.255.255.255",
    "128.0.0.0-169.253.255.255",
    "169.255.0.0-172.15.255.255",
    "172.32.0.0-192.167.255.255",
    "192.169.0.0-223.255.255.255"
  ) `
  -Profile Any `
  -Enabled True |
  Out-Null

New-NetFirewallRule `
  -DisplayName "$rulePrefix-Internet6" `
  -Direction Outbound `
  -Action Block `
  -RemoteAddress "2000::/3" `
  -Profile Any `
  -Enabled True |
  Out-Null

Write-Output "Added Stage 9 public-outbound block rules."
