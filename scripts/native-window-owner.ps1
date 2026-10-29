param([Int64]$WindowHandle)
$ErrorActionPreference='Stop'
Add-Type @'
using System;using System.Runtime.InteropServices;
public static class BydWindowOwner {
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 public static uint Get(long handle){uint process;GetWindowThreadProcessId(new IntPtr(handle),out process);return process;}
}
'@
[BydWindowOwner]::Get($WindowHandle)
