$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root "infra\wazuh\runtime"
$eventLog = Join-Path $runtimeDirectory "events.json"

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

if (-not (Test-Path $eventLog)) {
    New-Item -ItemType File -Path $eventLog | Out-Null
}

Write-Output "Wazuh runtime event log is ready."
