using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Threading;

// Isolated external target. The application under test owns all hotkeys and paste logic.
public class WindowsIntegration {
    [DllImport("user32.dll")] static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    static void Key(byte key,bool up){keybd_event(key,0,up?2u:0u,UIntPtr.Zero);}
    [STAThread] public static int Main(string[] args){
        var app=new Application();var box=new TextBox{AcceptsReturn=true,TextWrapping=TextWrapping.Wrap};
        var target=new Window{Title="Before You Do — isolated paste test",Width=600,Height=240,Topmost=true};
        string first="先簡短整理你理解的需求、目的與重要限制，再依此規劃並直接進行，不用等我確認。";
        string second="你知道我的意思嗎？幫我規劃一下，直接給我你推薦的方案與理由，先不要實作。";
        int step=0;bool focus=false,down=false,cancel=false,quick=false,up=false;string diagnostic="";
        var layout=new DockPanel();var start=new Button{Content="開始測試",Padding=new Thickness(12)};DockPanel.SetDock(start,Dock.Top);layout.Children.Add(start);layout.Children.Add(box);target.Content=layout;
        target.Show();target.Activate();box.Focus();
        var timer=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(500)};
        timer.Tick+=delegate{step++;
            if(step<16 && GetForegroundWindow()!=new WindowInteropHelper(target).Handle){timer.Stop();Key(72,true);Key(0x12,true);File.WriteAllText(args[0],"FAIL: test target lost foreground focus at step "+step+". No further shortcuts sent. Down paste="+down+", quick paste="+quick+", up paste="+up);app.Shutdown(1);return;}
            switch(step){
            case 1:Key(0x12,false);Key(72,false);Key(72,true);break;
            case 2:focus=GetForegroundWindow()==new WindowInteropHelper(target).Handle;Key(0x28,false);Key(0x28,true);break;
            case 3:Key(0x12,true);break;
            case 5:down=box.Text==second;diagnostic+="After down: "+box.Text+"\r\n";box.Clear();Key(0x12,false);Key(72,false);Key(72,true);Key(0x12,true);break;
            case 8:quick=box.Text==first;diagnostic+="After quick: "+box.Text+"\r\n";box.Clear();Key(0x12,false);Key(72,false);Key(72,true);break;
            // Up first selects the pinned Add action; Up again selects the last phrase.
            case 9:Key(0x26,false);Key(0x26,true);Key(0x26,false);Key(0x26,true);break;
            case 10:Key(0x12,true);break;
            case 12:up=box.Text==second;Key(0x12,false);Key(72,false);Key(72,true);break;
            case 13:Key(0x1B,false);Key(0x1B,true);break;
            case 14:Key(0x12,true);break;
            case 16:cancel=box.Text==second;timer.Stop();bool ok=focus&&down&&cancel&&quick&&up;
                File.WriteAllText(args[0],"Tauri Windows integration: "+(ok?"PASS":"FAIL")+"\r\nNon-activating picker: "+focus+"\r\nDown then release Alt: "+down+"\r\nEscape cancellation: "+cancel+"\r\nQuick Alt+H release: "+quick+"\r\nUp wraps selection: "+up+"\r\n"+diagnostic);
                app.Shutdown(ok?0:1);break;
        }};start.Click+=delegate{start.IsEnabled=false;box.Focus();timer.Start();};return app.Run();
    }
}
