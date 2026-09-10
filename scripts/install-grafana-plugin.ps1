$ErrorActionPreference = "Stop"

$pluginId = "grafana-clickhouse-datasource"
$pluginVersion = "4.20.0"
$assetName = "$pluginId-$pluginVersion.linux_amd64.zip"
$downloadUrl = "https://github.com/grafana/clickhouse-datasource/releases/download/v$pluginVersion/$assetName"
$root = Split-Path -Parent $PSScriptRoot
$cacheDirectory = Join-Path $root ".temp\grafana"
$archivePath = Join-Path $cacheDirectory $assetName
$pluginDirectory = Join-Path $root "infra\grafana\plugin-cache\$pluginVersion"
$installedManifestPath = Join-Path $pluginDirectory "$pluginId\plugin.json"
$requiredPluginFiles = @(
    "$pluginId\plugin.json",
    "$pluginId\MANIFEST.txt",
    "$pluginId\gpx_clickhouse_linux_amd64",
    "$pluginId\dashboards\system-dashboards.json"
)

if (-not ($requiredPluginFiles | Where-Object {
    -not (Test-Path (Join-Path $pluginDirectory $_))
})) {
    $installedManifest = Get-Content -Raw -Path $installedManifestPath | ConvertFrom-Json
    if (
        $installedManifest.id -eq $pluginId -and
        $installedManifest.info.version -eq $pluginVersion
    ) {
        Write-Output "Grafana plugin already ready: $pluginId $pluginVersion"
        exit 0
    }
}

New-Item -ItemType Directory -Force -Path $cacheDirectory | Out-Null

if (-not (Test-Path $archivePath)) {
    Write-Output "Downloading $pluginId $pluginVersion..."
    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $archivePath
}

if (Test-Path $pluginDirectory) {
    Get-ChildItem -Path $pluginDirectory -Recurse -Force -File | ForEach-Object {
        $_.IsReadOnly = $false
    }
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
