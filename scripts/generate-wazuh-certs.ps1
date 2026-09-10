$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$wazuhDirectory = Join-Path $root "infra\wazuh"
$toolDirectory = Join-Path $wazuhDirectory "certs\tool"
$outputDirectory = Join-Path $wazuhDirectory "certs\generated"
$toolPath = Join-Path $toolDirectory "wazuh-certs-tool.sh"
$toolUrl = "https://packages.wazuh.com/4.14/wazuh-certs-tool.sh"
$requiredCertificates = @(
    "admin-key.pem",
    "admin.pem",
    "root-ca-manager.pem",
    "root-ca.pem",
    "wazuh.dashboard-key.pem",
    "wazuh.dashboard.pem",
    "wazuh.indexer-key.pem",
    "wazuh.indexer.pem",
    "wazuh.manager-key.pem",
    "wazuh.manager.pem"
)

$hasCompleteSet = $true
foreach ($certificate in $requiredCertificates) {
    if (-not (Test-Path (Join-Path $outputDirectory $certificate))) {
        $hasCompleteSet = $false
        break
    }
}

if ($hasCompleteSet) {
    Write-Output "Wazuh certificate set already exists and is complete."
    exit 0
}

New-Item -ItemType Directory -Force -Path $toolDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

Write-Output "Downloading the pinned Wazuh 4.14 certificate tool..."
Invoke-WebRequest -UseBasicParsing -Uri $toolUrl -OutFile $toolPath

& docker compose -f (Join-Path $wazuhDirectory "generate-certs.yml") run --rm generator
if ($LASTEXITCODE -ne 0) {
    throw "Wazuh certificate generation failed with exit code $LASTEXITCODE."
}

foreach ($certificate in $requiredCertificates) {
    if (-not (Test-Path (Join-Path $outputDirectory $certificate))) {
        throw "Missing generated certificate: $certificate"
    }
}

Write-Output "Wazuh certificate set verified."
