param([string]$Result)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @"
using System;using System.IO;using System.Windows.Forms;using System.Runtime.InteropServices;
public class AuditBox:TextBox {
 public string Path;public void CapturePaste(){if(File.Exists(Path))return;var files=Clipboard.GetFileDropList();var paths=new string[files.Count];files.CopyTo(paths,0);File.WriteAllLines(Path,paths);Console.WriteLine("PASTE");Console.Out.Flush();}
 protected override bool ProcessCmdKey(ref Message m,Keys data){if((data&Keys.KeyCode)==Keys.V)File.AppendAllText(Path+".cmd",data+Environment.NewLine);if(data==(Keys.Control|Keys.V)){CapturePaste();return true;}return base.ProcessCmdKey(ref m,data);}
 protected override void OnKeyDown(KeyEventArgs e){if(e.KeyCode==Keys.Right){File.WriteAllText(Path+".after","restored");Console.WriteLine("AFTER");Console.Out.Flush();}base.OnKeyDown(e);}
 protected override void WndProc(ref Message m){if(m.Msg==0x302){CapturePaste();return;}base.WndProc(ref m);}
}
public class AuditForm:Form{public AuditBox Box;protected override bool ProcessCmdKey(ref Message m,Keys data){if(data==(Keys.Control|Keys.V)){Box.CapturePaste();return true;}return base.ProcessCmdKey(ref m,data);}}
public static class ReceiverProgram {
 [DllImport("user32.dll")]static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);[DllImport("kernel32.dll")]static extern uint GetCurrentThreadId();[DllImport("user32.dll")]static extern bool AttachThreadInput(uint a,uint b,bool c);[DllImport("user32.dll")]static extern bool SetForegroundWindow(IntPtr h);
 static void ActivateOwn(Form form,Control box){uint p;uint other=GetWindowThreadProcessId(GetForegroundWindow(),out p),current=GetCurrentThreadId();bool attached=other!=0&&other!=current&&AttachThreadInput(current,other,true);try{SetForegroundWindow(form.Handle);box.Focus();}finally{if(attached)AttachThreadInput(current,other,false);}box.Focus();}

 public static void Run(string result){
 var form=new AuditForm();var box=new AuditBox();box.Path=result;box.Multiline=true;box.Dock=DockStyle.Fill;form.Box=box;form.Controls.Add(box);form.ActiveControl=box;form.Text="before-you-do native paste verification";form.Width=420;form.Height=120;form.StartPosition=FormStartPosition.CenterScreen;form.TopMost=true;
 IDataObject saved=null;try{var original=Clipboard.GetDataObject();var copy=new DataObject();if(original!=null)foreach(var format in original.GetFormats(false)){try{copy.SetData(format,false,original.GetData(format,false));}catch{}}saved=copy;}catch{}
 form.Activated+=(s,e)=>{box.Focus();File.WriteAllText(result+".focus","focused="+box.Focused);};
 form.Shown+=(s,e)=>{form.Activate();ActivateOwn(form,box);File.WriteAllText(result+".focus","focused="+box.Focused);Console.WriteLine("HWND "+form.Handle.ToInt64());Console.Out.Flush();};
 var timer=new Timer();timer.Interval=20000;timer.Tick+=(s,e)=>form.Close();timer.Start();
 form.FormClosed+=(s,e)=>{try{var files=Clipboard.GetFileDropList();if(files.Count>0&&files[0].StartsWith(System.IO.Path.GetDirectoryName(result),StringComparison.OrdinalIgnoreCase)){if(saved!=null)Clipboard.SetDataObject(saved,true);else Clipboard.Clear();File.WriteAllText(result+".restore","restored");}else{File.WriteAllText(result+".restore","unchanged");}}catch(Exception error){File.WriteAllText(result+".restore",error.GetType().Name);}};
 Application.Run(form);timer.Dispose();form.Dispose();
 }
}
"@
[ReceiverProgram]::Run($Result)
