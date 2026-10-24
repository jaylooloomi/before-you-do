using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Threading;
public class ToggleIntegration {
 [DllImport("user32.dll")] static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string cls,string title);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 static void Key(byte k,bool up){keybd_event(k,0,up?2u:0u,UIntPtr.Zero);}
 static void H(){Key(72,false);Key(72,true);}
 static bool Visible(){return IsWindowVisible(FindWindow(null,"Before You Do"));}
 [STAThread] public static int Main(string[] args){
  var app=new Application();var box=new TextBox{AcceptsReturn=true,TextWrapping=TextWrapping.Wrap};
  var target=new Window{Title="Before You Do H toggle test",Width=600,Height=220,Content=box};
  var timer=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(500)};
  int step=0;bool repeat=false,opened=false,closed=false,reopened=false,closedAgain=false,noPaste=false;
  string first="先簡短整理你理解的需求、目的與重要限制，再依此規劃並直接進行，不用等我確認。";
  timer.Tick+=delegate{step++;
   if(GetForegroundWindow()!=new WindowInteropHelper(target).Handle){timer.Stop();Key(72,true);Key(18,true);File.WriteAllText(args[0],"FAIL: target lost focus at "+step+"; foreground="+GetForegroundWindow()+"; opened="+opened+" repeat="+repeat+" closed="+closed);app.Shutdown(1);return;}
   switch(step){
    case 1:Key(18,false);Key(72,false);break;
    case 2:opened=Visible();Key(72,false);break;
    case 3:repeat=Visible();Key(72,true);break;
    case 4:H();break;
    case 5:closed=!Visible();H();break;
    case 6:reopened=Visible();H();break;
    case 7:closedAgain=!Visible();Key(18,true);break;
    case 8:noPaste=box.Text.Length==0;Key(18,false);H();break;
    case 9:Key(18,true);break;
    case 11:timer.Stop();bool paste=box.Text==first;bool ok=opened&&repeat&&closed&&reopened&&closedAgain&&noPaste&&paste;
     File.WriteAllText(args[0],"Toggle integration: "+(ok?"PASS":"FAIL")+"\r\nOpened: "+opened+"\r\nHolding H keeps picker open: "+repeat+"\r\nSecond H closes picker: "+closed+"\r\nThird H reopens while Alt held: "+reopened+"\r\nFourth H cancels again: "+closedAgain+"\r\nAlt release after cancellation does not paste or leak H: "+noPaste+"\r\nFresh Alt+H still pastes: "+paste);app.Shutdown(ok?0:1);break;
   }
  };
  target.ContentRendered+=delegate{Key(72,true);Key(18,true);target.Activate();box.Focus();timer.Start();};target.Show();return app.Run();
 }
}
