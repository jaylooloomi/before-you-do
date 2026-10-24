$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'scripts\tauri.ps1') -Action build
