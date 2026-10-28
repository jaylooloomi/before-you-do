param([Parameter(Mandatory=$true)][string]$Tag)
$ErrorActionPreference='Stop'
if($Tag -notmatch '^v\d+\.\d+\.\d+$'){throw 'Expected a stable version tag'}
$releaseVersion=$Tag.Substring(1)
$manifest=Get-Content package.json -Raw|ConvertFrom-Json
if($manifest.version -ne $releaseVersion){throw 'Package/tag version mismatch'}
$exe=Join-Path $PWD 'src-tauri/target/release/before-you-do.exe'
if((Get-Item -LiteralPath $exe).VersionInfo.ProductVersion -ne $releaseVersion){throw 'Executable version mismatch'}
$cargoRoot=if($env:CARGO_HOME){$env:CARGO_HOME}else{Join-Path $env:USERPROFILE '.cargo'}
$lockText=Get-Content src-tauri/Cargo.lock -Raw
$crateVersion=[regex]::Match($lockText,'name = "webview2-com-sys"\s+version = "([^"]+)"').Groups[1].Value
if(-not $crateVersion){throw 'Missing locked WebView2 loader version'}
$loaders=@(Get-ChildItem (Join-Path $cargoRoot 'registry/src') -Filter WebView2Loader.dll -Recurse | Where-Object {$_.FullName -like "*webview2-com-sys-$crateVersion\x64\WebView2Loader.dll"})
if($loaders.Count -ne 1){throw 'Expected exactly one locked x64 WebView2 loader'}
$staging=Join-Path $PWD "artifacts/package-$Tag-windows"
New-Item -ItemType Directory -Force -Path $staging|Out-Null
Copy-Item -LiteralPath $exe -Destination (Join-Path $staging 'before-you-do.exe')
Copy-Item -LiteralPath $loaders[0].FullName -Destination (Join-Path $staging 'WebView2Loader.dll')
$instructions=@"
before-you-do $Tag - Windows x64

Extract all files together. Keep WebView2Loader.dll beside before-you-do.exe.
Requires Microsoft Edge WebView2 Runtime:
https://developer.microsoft.com/microsoft-edge/webview2/

Before upgrading, save drafts in every role and fully quit the old app from the tray.
Existing snippets and settings remain in %APPDATA%\dev.quicksay.desktop.
Unsaved drafts live in memory; do not force-quit an app with edits you want to keep.

Hold Alt and press H, use Left/Right for roles and Up/Down for snippets, release Alt to paste.
Change the shortcut, interface language and theme under Settings & AI guide.
Choose Follow system, Light or Dark for the interface theme.
Optional sign-in startup: Settings & AI guide > Startup. Off by default; starts in the tray.
After moving the app, toggle startup off/on to update its path. Disable it before removing the app.
Pristine built-in prompts follow your language. Added/customized prompts keep their text.
The tool pastes text without sending the message. Pasting replaces the clipboard.
Unsigned portable build; no automatic updater.

繁體中文
請完整解壓縮，保留同資料夾內的 WebView2Loader.dll。
升級前先儲存所有角色要保留的草稿，再透過系統匣完整退出舊版。
原有短句與設定會保留；未儲存草稿僅在記憶體中，不要直接強制結束。
可在「設定與 AI 教學」調整快捷鍵及語言，並在主畫面選擇跟隨系統、亮色或暗色；自訂短句不會被語系切換覆蓋。
此版本未簽章，沒有自動更新；貼入會取代剪貼簿內容，不會送出訊息。
「設定與 AI 教學 → 啟動設定」可設定登入後啟動到系統匣，預設關閉。移動程式後請關閉再開啟此設定；移除程式前請先關閉。
"@
[IO.File]::WriteAllText((Join-Path $staging 'START-HERE.txt'),$instructions,[Text.UTF8Encoding]::new($false))
Compress-Archive -Path "$staging/*" -DestinationPath "artifacts/before-you-do-$Tag-windows-x64.zip" -Force
Write-Output "Packaged before-you-do-$Tag-windows-x64.zip"
