param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
$workspace=Split-Path $PSScriptRoot
if(Get-Process before-you-do -ErrorAction SilentlyContinue){throw 'Close before-you-do before running the native audit; this script never closes your app.'}
Push-Location $workspace
try {
 if(-not $SkipBuild){npm run build -- --no-bundle;if($LASTEXITCODE){throw 'Build failed'}}
 $results=@()
 foreach($scenario in @('paste','clear')){foreach($iteration in 1..2){
  $auditDir=Join-Path $workspace ('artifacts\qa\native-quick-'+[guid]::NewGuid().ToString('N'))
  node scripts/create-native-quick-fixture.mjs $auditDir;if($LASTEXITCODE){throw 'Fixture creation failed'}
  $savedTemp=$env:TEMP;$savedTmp=$env:TMP
  try{$env:TEMP=Join-Path $auditDir 'tmp';$env:TMP=$env:TEMP
   $auditArgs=@('--integration-test','--quick-native-audit',$auditDir);if($scenario -eq 'clear'){$auditArgs+='--quick-native-clear'}
   $process=Start-Process -FilePath (Join-Path $workspace 'src-tauri\target\release\before-you-do.exe') -ArgumentList $auditArgs -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardError (Join-Path $auditDir 'stderr.log') -RedirectStandardOutput (Join-Path $auditDir 'stdout.log') -PassThru
  }finally{$env:TEMP=$savedTemp;$env:TMP=$savedTmp}
  $process | Wait-Process -Timeout 60
  $result=Get-Content -LiteralPath (Join-Path $auditDir 'result.json') -Raw | ConvertFrom-Json
  if(-not $result.success){throw $result.error}
  $verified=Get-Content -LiteralPath (Join-Path $auditDir 'verified.json') -Raw | ConvertFrom-Json
  if(-not $verified.keyboardRestored -or -not $verified.quickClosed -or (-not $verified.releasePasted -and -not $verified.clearConfirmed)){throw 'Native journey incomplete'}
  if((Get-Content -LiteralPath (Join-Path $auditDir 'received.txt.restore') -Raw) -notin @('restored','unchanged')){throw 'Clipboard restoration did not complete'}
  $results+=@{scenario=$scenario;iteration=$iteration;directory=$auditDir;verification=$verified}
 }
 }
 $results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $workspace 'artifacts\qa\native-quick-results.json')
 'Native paste and confirmed clear each passed twice; clipboard preserved.'
}finally{Pop-Location}
