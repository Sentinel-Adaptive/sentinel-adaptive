$ErrorActionPreference = "Stop"

$pluginId = "grafana-clickhouse-datasource"
$pluginVersion = "4.20.0"
$assetName = "$pluginId-$pluginVersion.linux_amd64.zip"
$downloadUrl = "https://github.com/grafana/clickhouse-datasource/releases/download/v$pluginVersion/$assetName"
$root = Split-Path -Parent $PSScriptRoot
$cacheDirectory = Join-Path $root ".temp\grafana"
$archivePath = Join-Path $cacheDirectory $assetName
$pluginDirectory = Join-Path $root "infra\grafana\plugins"

New-Item -ItemType Directory -Force -Path $cacheDirectory | Out-Null

if (-not (Test-Path $archivePath)) {
    Write-Output "Downloading $pluginId $pluginVersion..."
    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $archivePath
}

if (Test-Path $pluginDirectory) {
    Remove-Item -Recurse -Force $pluginDirectory
}

New-Item -ItemType Directory -Force -Path $pluginDirectory | Out-Null
Expand-Archive -Path $archivePath -DestinationPath $pluginDirectory -Force

$manifestPath = Get-ChildItem -Path $pluginDirectory -Filter "plugin.json" -Recurse |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $manifestPath) {
    throw "Downloaded archive does not contain plugin.json."
}

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
if ($manifest.id -ne $pluginId -or $manifest.info.version -ne $pluginVersion) {
    throw "Plugin manifest mismatch: $($manifest.id) $($manifest.info.version)"
}

Write-Output "Grafana plugin ready: $($manifest.id) $($manifest.info.version)"
