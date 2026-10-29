# Test-only reservation; no keyboard event is generated.
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RecordingTestHotkey {
    [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr h, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr h, int id);
}
'@
if (-not [RecordingTestHotkey]::RegisterHotKey([IntPtr]::Zero, 1, 0x4007, 0x7A)) { throw 'Cannot reserve isolated Ctrl+Alt+Shift+F11 test key' }
try { [Console]::WriteLine('READY'); [Console]::Out.Flush(); $null = [Console]::ReadLine() }
finally { $null = [RecordingTestHotkey]::UnregisterHotKey([IntPtr]::Zero, 1) }
