$ErrorActionPreference = 'Stop'
# Pinned LGPL shared build; never execute a downloaded archive before its SHA-256 matches.
$runtimeDir = $env:BYD_RECORDING_RUNTIME
if (-not $runtimeDir) { $runtimeDir = Join-Path $env:LOCALAPPDATA 'before-you-do/recording-runtime/ffmpeg-8.1-0448c3f3' }
$archive = Join-Path ([IO.Path]::GetTempPath()) ('byd-ffmpeg-' + [Guid]::NewGuid() + '.zip')
$unpacked = $archive + '.unpacked'
try {
    Invoke-WebRequest 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-28-19-47/ffmpeg-n8.1.3-25-g611cec792a-win64-lgpl-shared-8.1.zip' -OutFile $archive -UseBasicParsing
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne '0448c3f3b9bdc724cc0189d5ce6e6bfa5b8937e7ec408e1e97fb08719bdb3b92') { throw 'Recording runtime checksum mismatch. No downloaded code was executed.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $unpacked
    $source = Join-Path $unpacked 'ffmpeg-n8.1.3-25-g611cec792a-win64-lgpl-shared-8.1'
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
    Copy-Item -LiteralPath (Join-Path $source 'bin') -Destination $runtimeDir -Recurse -Force
    Copy-Item -LiteralPath (Join-Path $source 'LICENSE.txt') -Destination $runtimeDir -Force
    Get-ChildItem -LiteralPath $source -File | Where-Object Name -ne 'LICENSE.txt' | Copy-Item -Destination $runtimeDir -Force
    Write-Output 'Recording runtime installed.'
} finally {
    # Temporary paths are newly created under GetTempPath; do not recursively delete a computed user directory.
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
}
