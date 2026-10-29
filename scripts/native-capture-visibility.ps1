param([uint32]$AppProcessId,[switch]$Details)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public class BydCaptureVisibility {
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left,Top,Right,Bottom;}
 public delegate bool EnumCallback(IntPtr window,IntPtr data);
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumCallback callback,IntPtr data);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out Rect rectangle);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowTextW(IntPtr window,StringBuilder text,int size);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassNameW(IntPtr window,StringBuilder text,int size);
 public static string Describe(uint expected){StringBuilder result=new StringBuilder();EnumWindows((window,data)=>{uint process;GetWindowThreadProcessId(window,out process);if(process==expected&&IsWindowVisible(window)){StringBuilder title=new StringBuilder(256),kind=new StringBuilder(256);GetWindowTextW(window,title,256);GetClassNameW(window,kind,256);result.Append(kind).Append(":").Append(title).Append(";");}return true;},IntPtr.Zero);return result.ToString();}
 public static int Visible(uint expected){int count=0;EnumWindows((window,data)=>{uint process;GetWindowThreadProcessId(window,out process);Rect rectangle;if(process==expected&&IsWindowVisible(window)&&GetWindowRect(window,out rectangle)&&rectangle.Right>rectangle.Left&&rectangle.Bottom>rectangle.Top){StringBuilder kind=new StringBuilder(256);GetClassNameW(window,kind,256);if(kind.ToString()!="Tao Thread Event Target")count++;}return true;},IntPtr.Zero);return count;}
}
'@
if($Details){[BydCaptureVisibility]::Describe($AppProcessId)}else{[BydCaptureVisibility]::Visible($AppProcessId)}
