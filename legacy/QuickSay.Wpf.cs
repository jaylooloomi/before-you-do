using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using System.Xml.Serialization;
using Forms = System.Windows.Forms;

public class Snippet { public string Name {get;set;} public string Text {get;set;} public override string ToString(){return Name;} }
public class Settings { public int Modifiers=1; public int Key=72; public List<Snippet> Items=new List<Snippet>(); }
public class QuickSayApp : Application {
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr h,int id,uint mods,uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h,int id);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, Hook callback,IntPtr module,uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr wp,IntPtr lp);
    [DllImport("kernel32.dll",CharSet=CharSet.Auto)] static extern IntPtr GetModuleHandle(string name);
    [DllImport("user32.dll")] static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
    delegate IntPtr Hook(int code,IntPtr wp,IntPtr lp);
    Hook callback; IntPtr hook, target; HwndSource receiver; Window popup,editor; ListBox choices;
    string trace=""; Settings settings; Forms.NotifyIcon tray; bool picking; int generation;
    string path=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"QuickSay","settings.xml");
    static void Key(byte key,bool up){keybd_event(key,0,up?2u:0u,UIntPtr.Zero);}
    static bool Held(int key){return (GetAsyncKeyState(key)&0x8000)!=0;}
    protected override void OnStartup(StartupEventArgs e){
        base.OnStartup(e);ShutdownMode=ShutdownMode.OnExplicitShutdown;
        settings=Load();
        var p=new HwndSourceParameters("QuickSay hotkeys"){Width=0,Height=0,WindowStyle=0};receiver=new HwndSource(p);receiver.AddHook(Messages);
        bool registered=RegisterHotKey(receiver.Handle,1,0x4001,72);
        callback=Keyboard;hook=SetWindowsHookEx(13,callback,GetModuleHandle(null),0);
        if(hook==IntPtr.Zero){MessageBox.Show("無法註冊鍵盤選擇功能，程式將結束。");Shutdown(1);return;}
        tray=new Forms.NotifyIcon{Icon=System.Drawing.SystemIcons.Information,Text="QuickSay · 按住 Alt+H，上下選句，放開 Alt 貼入",Visible=true};
        var menu=new Forms.ContextMenuStrip();menu.Items.Add("管理短句",null,delegate{Manage();});menu.Items.Add("結束",null,delegate{Shutdown();});tray.ContextMenuStrip=menu;tray.DoubleClick+=delegate{Manage();};
        if(!registered)MessageBox.Show("Alt+H 已被占用。請關閉舊版 QuickSay 或 QuickAsk.ahk 後重新啟動。");
        if(e.Args.Length>0 && e.Args[0]=="--selftest")SelfTest();
        else Manage();
    }
    Settings Load(){try{if(File.Exists(path))using(var f=File.OpenRead(path))return (Settings)new XmlSerializer(typeof(Settings)).Deserialize(f);}catch(Exception ex){MessageBox.Show("設定讀取失敗，原檔保留："+ex.Message);}
        var s=new Settings();s.Items.Add(new Snippet{Name="理解後直接進行",Text="先簡短整理你理解的需求、目的與重要限制，再依此規劃並直接進行，不用等我確認。"});s.Items.Add(new Snippet{Name="先規劃，不實作",Text="你知道我的意思嗎？幫我規劃一下，直接給我你推薦的方案與理由，先不要實作。"});return s;}
    bool Save(){try{Directory.CreateDirectory(Path.GetDirectoryName(path));using(var f=File.Create(path+".tmp"))new XmlSerializer(typeof(Settings)).Serialize(f,settings);if(File.Exists(path))File.Replace(path+".tmp",path,path+".bak");else File.Move(path+".tmp",path);return true;}catch(Exception ex){MessageBox.Show("儲存失敗："+ex.Message);return false;}}
    IntPtr Messages(IntPtr h,int msg,IntPtr wp,IntPtr lp,ref bool handled){if(msg==0x312){trace+=" HOTKEY";handled=true;if(!picking)OpenPicker();}return IntPtr.Zero;}
    void OpenPicker(){
        if(settings.Items.Count==0)return;
        target=GetForegroundWindow();trace+=" OPEN:"+target;choices=new ListBox{FontSize=16,Margin=new Thickness(0,12,0,10),BorderThickness=new Thickness(0),Background=Brushes.White};
        foreach(var s in settings.Items)choices.Items.Add(new ListBoxItem{Content=new TextBlock{Text=s.Name+"\n"+s.Text,TextWrapping=TextWrapping.Wrap,MaxWidth=490,Margin=new Thickness(8)},Tag=s});choices.SelectedIndex=0;
        var panel=new StackPanel{Margin=new Thickness(20)};panel.Children.Add(new TextBlock{Text="↑ ↓ 選擇短句 · 放開 Alt 貼上 · Esc 取消",FontSize=15,FontWeight=FontWeights.SemiBold});panel.Children.Add(choices);
        popup=new Window{Title="QuickSay 短句選擇",Width=560,MaxHeight=600,SizeToContent=SizeToContent.Height,WindowStartupLocation=WindowStartupLocation.CenterScreen,WindowStyle=WindowStyle.None,ResizeMode=ResizeMode.NoResize,ShowInTaskbar=false,ShowActivated=false,Topmost=true,Content=panel,Background=Brushes.White};
        popup.SourceInitialized+=delegate{var handle=new WindowInteropHelper(popup).Handle;SetWindowLong(handle,-20,GetWindowLong(handle,-20)|0x08000000|0x80);};
        picking=true;generation++;popup.Show();
        // Covers a very quick Alt release before WM_HOTKEY is dispatched.
        var releaseCheck=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(30)};int ticket=generation;
        releaseCheck.Tick+=delegate{if(!picking || ticket!=generation){releaseCheck.Stop();return;}if(!Held(0x12)){releaseCheck.Stop();Finish(true);}};releaseCheck.Start();
    }
    [DllImport("user32.dll")]static extern int GetWindowLong(IntPtr h,int index);
    [DllImport("user32.dll")]static extern int SetWindowLong(IntPtr h,int index,int value);
    IntPtr Keyboard(int code,IntPtr wp,IntPtr lp){
        if(code>=0 && picking){int key=Marshal.ReadInt32(lp);int msg=wp.ToInt32();bool up=msg==0x101 || msg==0x105;
            if(key==0xA4 || key==0xA5 || key==0x12){if(up)Dispatcher.BeginInvoke(new Action(delegate{if(picking)Finish(true);}));}
            else if(key==0x26 || key==0x28){if(!up){int delta=key==0x26?-1:1;Dispatcher.BeginInvoke(new Action(delegate{if(picking){choices.SelectedIndex=(choices.SelectedIndex+delta+choices.Items.Count)%choices.Items.Count;choices.ScrollIntoView(choices.SelectedItem);}}));}return new IntPtr(1);}
            else if(key==0x1B){if(!up)Dispatcher.BeginInvoke(new Action(delegate{Finish(false);}));return new IntPtr(1);}
            else if(key==72)return new IntPtr(1);
        }return CallNextHookEx(hook,code,wp,lp);
    }
    void Finish(bool paste){if(!picking)return;var item=choices.SelectedItem as ListBoxItem;var s=item==null?null:item.Tag as Snippet;picking=false;popup.Close();popup=null;
        if(!paste || s==null || string.IsNullOrEmpty(s.Text))return;
        var original=target;int tries=0;var timer=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(35)};
        timer.Tick+=delegate{if(GetForegroundWindow()!=original){timer.Stop();return;}if(Held(0x12)||Held(72)||Held(0x11)||Held(0x10)){if(++tries>60)timer.Stop();return;}timer.Stop();trace+=" PASTE:"+s.Text;try{Clipboard.SetText(s.Text);Key(0x11,false);Key(0x56,false);Key(0x56,true);Key(0x11,true);}catch(Exception ex){tray.ShowBalloonTip(3000,"貼入失敗",ex.Message,Forms.ToolTipIcon.Warning);}};timer.Start();
    }
    void Manage(){if(editor!=null){editor.Activate();return;}
        editor=new Window{Title="QuickSay · 管理短句",Width=760,Height=560,WindowStartupLocation=WindowStartupLocation.CenterScreen};
        var root=new DockPanel{Margin=new Thickness(20)};var help=new TextBlock{Text="對話框中按住 Alt，再按 H → ↑↓ 選句 → 放開 Alt 貼入\n不會送出訊息。Esc 取消。關閉此視窗後仍在系統匣執行。",Margin=new Thickness(0,0,0,15)};DockPanel.SetDock(help,Dock.Top);root.Children.Add(help);
        var actions=new StackPanel{Orientation=Orientation.Horizontal,Margin=new Thickness(0,12,0,0)};DockPanel.SetDock(actions,Dock.Bottom);root.Children.Add(actions);
        var grid=new Grid();grid.ColumnDefinitions.Add(new ColumnDefinition{Width=new GridLength(230)});grid.ColumnDefinitions.Add(new ColumnDefinition());root.Children.Add(grid);
        var list=new ListBox{Margin=new Thickness(0,0,16,0)};grid.Children.Add(list);var fields=new DockPanel();Grid.SetColumn(fields,1);grid.Children.Add(fields);
        var name=new TextBox{Margin=new Thickness(0,0,0,12),FontSize=16};DockPanel.SetDock(name,Dock.Top);fields.Children.Add(name);var text=new TextBox{AcceptsReturn=true,TextWrapping=TextWrapping.Wrap,VerticalScrollBarVisibility=ScrollBarVisibility.Auto,FontSize=16};fields.Children.Add(text);
        Action refresh=delegate{list.Items.Clear();foreach(var s in settings.Items)list.Items.Add(s);};
        list.SelectionChanged+=delegate{var s=list.SelectedItem as Snippet;name.Text=s==null?"":s.Name;text.Text=s==null?"":s.Text;};refresh();if(list.Items.Count>0)list.SelectedIndex=0;
        Action<string,Action> add=delegate(string label,Action action){var b=new Button{Content=label,Padding=new Thickness(14,6,14,6),Margin=new Thickness(0,0,10,0)};b.Click+=delegate{action();};actions.Children.Add(b);};
        add("新增",delegate{var s=new Snippet{Name="新短句",Text=""};settings.Items.Add(s);refresh();list.SelectedItem=s;name.Focus();});
        add("儲存",delegate{var s=list.SelectedItem as Snippet;if(s==null)return;s.Name=name.Text.Trim();s.Text=text.Text;if(Save()){refresh();list.SelectedItem=s;}});
        add("刪除",delegate{var s=list.SelectedItem as Snippet;if(s!=null && MessageBox.Show("刪除「"+s.Name+"」？","QuickSay",MessageBoxButton.YesNo)==MessageBoxResult.Yes){settings.Items.Remove(s);Save();refresh();if(list.Items.Count>0)list.SelectedIndex=0;}});
        editor.Content=root;editor.Closed+=delegate{editor=null;};editor.Show();
    }
    void SelfTest(){
        settings=new Settings();settings.Items.Add(new Snippet{Name="第一句",Text="第一句"});settings.Items.Add(new Snippet{Name="第二句",Text="第二句測試"});
        var box=new TextBox();var test=new Window{Title="QuickSay Integration Test",Width=400,Height=180,Content=box};test.Show();test.Activate();box.Focus();
        int step=0;bool first=false,cancel=false;var timer=new DispatcherTimer{Interval=TimeSpan.FromMilliseconds(650)};
        timer.Tick+=delegate{step++;switch(step){
            case 1:Key(0x12,false);Key(72,false);Key(72,true);break;
            case 2:trace+=" CHECK:"+GetForegroundWindow()+" target:"+new WindowInteropHelper(test).Handle+" picking:"+picking;first=picking && GetForegroundWindow()==new WindowInteropHelper(test).Handle;Key(0x28,false);Key(0x28,true);break;
            case 3:Key(0x12,true);break;
            case 5:trace+=" TEXT:"+box.Text+" FOCUS:"+box.IsKeyboardFocused;cancel=box.Text=="第二句測試";Key(0x12,false);Key(72,false);Key(72,true);break;
            case 6:Key(0x1B,false);Key(0x1B,true);break;
            case 7:Key(0x12,true);break;
            case 9:timer.Stop();bool ok=first&&cancel&&box.Text=="第二句測試"&&!picking;File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"selftest-result.txt"),"Trace: "+trace+"\r\nWPF integration: "+(ok?"PASS":"FAIL")+"\r\nNon-activating picker: "+first+"\r\nAlt+H, Down, release Alt paste: "+cancel+"\r\nEscape cancels without extra paste: "+(box.Text=="第二句測試"&&!picking));test.Close();Shutdown(ok?0:1);break;
        }};timer.Start();
    }
    protected override void OnExit(ExitEventArgs e){if(hook!=IntPtr.Zero)UnhookWindowsHookEx(hook);if(receiver!=null){UnregisterHotKey(receiver.Handle,1);receiver.Dispose();}if(tray!=null)tray.Dispose();base.OnExit(e);}
    [STAThread] public static void Main(){bool created;using(var mutex=new System.Threading.Mutex(true,"Local\\QuickSay.Desktop",out created)){if(!created){MessageBox.Show("QuickSay 已在執行，請從系統匣開啟。");return;}new QuickSayApp().Run();}}
}
