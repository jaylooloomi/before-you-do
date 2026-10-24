param([ValidateSet('dev','build','check','test')][string]$Action='build', [switch]$LocalGnu)
$ErrorActionPreference='Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    if (Test-Path '.tools\cargo\bin\cargo.exe') {
        $env:CARGO_HOME=Join-Path $PWD '.tools\cargo'
        $env:RUSTUP_HOME=Join-Path $PWD '.tools\rustup'
        $env:Path=(Join-Path $PWD '.tools\cargo\bin')+';'+$env:Path
    }
    if (Test-Path 'C:\Program Files\nodejs\node.exe') { $env:Path='C:\Program Files\nodejs;'+$env:Path }
    if ($LocalGnu) {
        $env:RUSTUP_TOOLCHAIN='stable-x86_64-pc-windows-gnu'
        $env:Path=(Join-Path $PWD '.tools\mingw64\bin')+';C:\Windows\System32;'+$env:Path
    }
    if ($Action -eq 'check' -or $Action -eq 'test') { & cargo $Action --manifest-path src-tauri/Cargo.toml }
    else { & npm.cmd run $Action }
    if ($LASTEXITCODE -ne 0) { throw "Tauri $Action failed" }
} finally { Pop-Location }
