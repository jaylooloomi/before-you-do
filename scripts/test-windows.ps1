param([string]$AppPath)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
if(-not $AppPath){$AppPath=Join-Path $root 'src-tauri\target\release\before-you-do.exe'}
$AppPath=(Resolve-Path -LiteralPath $AppPath).Path
$out=Join-Path $root 'artifacts'
New-Item -ItemType Directory -Path $out -Force | Out-Null
$framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$testExe=Join-Path $out 'WindowsIntegration.exe'
& "$framework\csc.exe" /nologo /target:winexe "/out:$testExe" "/reference:$framework\WPF\PresentationFramework.dll" "/reference:$framework\WPF\PresentationCore.dll" "/reference:$framework\WPF\WindowsBase.dll" /reference:System.Xaml.dll (Join-Path $root 'tests\WindowsIntegration.cs')
if($LASTEXITCODE -ne 0){throw 'Cannot build test target'}
$appProcess=Start-Process -FilePath $AppPath -ArgumentList '--integration-test' -WindowStyle Hidden -PassThru
try {
    Start-Sleep -Seconds 4
    if($appProcess.HasExited){throw 'before-you-do exited before integration test'}
    # A visible isolated input window is required to verify focus and real key release.
    $result=Join-Path $out 'windows-integration.txt'
    if(Test-Path -LiteralPath $result){Remove-Item -LiteralPath $result}
    $testProcess=Start-Process -FilePath $testExe -ArgumentList ('"'+$result+'"') -WindowStyle Normal -PassThru
    Write-Output 'Click 開始測試 in the isolated test window. Do not switch windows during the test.'
    if(-not $testProcess.WaitForExit(45000)){Stop-Process -Id $testProcess.Id;throw 'Integration test timed out'}
    if(-not(Test-Path -LiteralPath $result)){throw 'Integration test exited without writing a result'}
    Get-Content -LiteralPath $result
    if($testProcess.ExitCode -ne 0){throw 'Windows integration failed'}
} finally { if(-not $appProcess.HasExited){Stop-Process -Id $appProcess.Id} }
