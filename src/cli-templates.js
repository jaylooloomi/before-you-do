const commands = [
 'claude --dangerously-skip-permissions',
 'codex --dangerously-bypass-approvals-and-sandbox',
];
const labels = {
 'zh-TW': ['Claude Code：略過權限確認', 'Codex：略過確認與沙箱', '在終端機啟動 Claude Code 並略過權限確認。僅用於你信任的專案與執行環境。', '在終端機啟動 Codex，停用核准流程與沙箱限制。僅用於你信任的專案與執行環境。', '內建啟動指令'],
 'zh-CN': ['Claude Code：跳过权限确认', 'Codex：跳过确认与沙箱', '在终端启动 Claude Code 并跳过权限确认。仅用于你信任的项目与运行环境。', '在终端启动 Codex，停用审批流程与沙箱限制。仅用于你信任的项目与运行环境。', '内置启动命令'],
 en: ['Claude Code: skip permission prompts', 'Codex: bypass approvals and sandbox', 'Launch Claude Code from a terminal without permission prompts. Use only with projects and environments you trust.', 'Launch Codex from a terminal with approvals and sandbox restrictions disabled. Use only with projects and environments you trust.', 'Built-in launch command'],
 ja: ['Claude Code：権限確認をスキップ', 'Codex：承認とサンドボックスを無効化', 'ターミナルで権限確認を省略して Claude Code を起動するとき。信頼できるプロジェクトと環境でのみ使用してください。', 'ターミナルで承認とサンドボックス制限を無効にして Codex を起動するとき。信頼できるプロジェクトと環境でのみ使用してください。', '内蔵起動コマンド'],
};
const resumeLabels = {
 'zh-TW': ['Claude Code：繼續先前對話', 'Codex：瀏覽所有對話並繼續', '在終端機開啟 Claude Code 的對話選擇器，選擇先前工作階段並繼續。', '在終端機開啟 Codex 的工作階段選擇器，顯示所有目錄的對話，選擇後繼續。'],
 'zh-CN': ['Claude Code：继续之前的对话', 'Codex：浏览所有对话并继续', '在终端打开 Claude Code 的会话选择器，选择之前的工作会话并继续。', '在终端打开 Codex 的会话选择器，显示所有目录的对话，选择后继续。'],
 en: ['Claude Code: resume a conversation', 'Codex: browse and resume all sessions', 'Open the Claude Code conversation picker in a terminal and select a previous session to resume.', 'Open the Codex session picker across all directories, then select a session to resume.'],
 ja: ['Claude Code：以前の会話を再開', 'Codex：すべてのセッションから再開', 'ターミナルで Claude Code の会話選択画面を開き、以前のセッションを選んで再開します。', 'ターミナルで全ディレクトリの Codex セッションを表示し、選択して再開します。'],
};
export function getCliTemplates(language) {
 const values=labels[language]??labels.en;
 const resume=resumeLabels[language]??resumeLabels.en;
 const templates=[...commands.map((text,i)=>({name:values[i],text,scenario:values[i+2],source:values[4]})),
  ...['claude --resume','codex resume --all'].map((text,i)=>({name:resume[i],text,scenario:resume[i+2],source:values[4]}))];
 const permissionLabels={
  'zh-TW':['Claude Code：權限模式快捷鍵','在 Claude Code 互動介面按 Shift+Tab。此短句只貼入按鍵提示，不會模擬按鍵。','Codex：權限設定','在 Codex 互動介面輸入 /permissions，開啟權限設定。'],
  'zh-CN':['Claude Code：权限模式快捷键','在 Claude Code 交互界面按 Shift+Tab。此短句只粘贴按键提示，不会模拟按键。','Codex：权限设置','在 Codex 交互界面输入 /permissions，打开权限设置。'],
  en:['Claude Code: permission mode shortcut','Press Shift+Tab in the Claude Code interactive interface. This snippet only pastes the key reminder; it does not simulate a keypress.','Codex: permissions','Enter /permissions in the Codex interactive interface to open permission settings.'],
  ja:['Claude Code：権限モードのショートカット','Claude Code の対話画面で Shift+Tab を押します。この短文はキー操作の説明を貼り付けるだけで、キー入力は実行しません。','Codex：権限設定','Codex の対話画面で /permissions を入力し、権限設定を開きます。'],
 };
 const permission=permissionLabels[language]??permissionLabels.en;
 const antigravity={
  'zh-TW':['Antigravity：接續並略過權限確認','在終端機貼入此啟動指令；僅用於信任的專案與執行環境。','Antigravity：接續對話','在 Antigravity 互動介面貼入 /resume。','Antigravity：快捷鍵提示','在 Antigravity 使用 Shift+Tab；此短句只貼入提示文字，不會模擬按鍵。'],
  'zh-CN':['Antigravity：继续并跳过权限确认','在终端粘贴此启动命令；仅用于信任的项目与运行环境。','Antigravity：继续对话','在 Antigravity 交互界面粘贴 /resume。','Antigravity：快捷键提示','在 Antigravity 使用 Shift+Tab；此短句只粘贴提示文字，不会模拟按键。'],
  en:['Antigravity: continue without permission prompts','Paste this launch command in a terminal; use only with trusted projects and environments.','Antigravity: resume','Paste /resume in the Antigravity interactive interface.','Antigravity: keyboard shortcut','Use Shift+Tab in Antigravity. This snippet only pastes a reminder, without simulating a keypress.'],
  ja:['Antigravity：権限確認を省略して再開','信頼できるプロジェクトと環境でのみ、この起動コマンドをターミナルに貼り付けてください。','Antigravity：会話を再開','Antigravity の対話画面で /resume を貼り付けます。','Antigravity：ショートカット','Antigravity で Shift+Tab を使用します。この短文は説明のみを貼り付け、キー入力は実行しません。'],
 };
 const agy=antigravity[language]??antigravity.en;
 const openCodeLabels={
  'zh-TW':['OpenCode：自動模式','在 OpenCode 終端啟動自動模式。','OpenCode：選擇舊對話','進入 OpenCode 後輸入 /sessions，選擇舊對話。','OpenCode：切換 Build／Plan','在 OpenCode 按 Tab 切換 Build／Plan。此短句只貼入按鍵提示，不會模擬按鍵。'],
  'zh-CN':['OpenCode：自动模式','在 OpenCode 终端启动自动模式。','OpenCode：选择旧对话','进入 OpenCode 后输入 /sessions，选择旧对话。','OpenCode：切换 Build／Plan','在 OpenCode 按 Tab 切换 Build／Plan。此短句只粘贴按键提示，不会模拟按键。'],
  en:['OpenCode: auto mode','Start auto mode in the OpenCode terminal.','OpenCode: choose a previous session','Enter /sessions inside OpenCode to choose a previous conversation.','OpenCode: switch Build / Plan','Press Tab in OpenCode to switch Build / Plan. This snippet pastes a key reminder without simulating a keypress.'],
  ja:['OpenCode：自動モード','OpenCode のターミナルで自動モードを起動します。','OpenCode：過去の会話を選択','OpenCode 内で /sessions を入力し、過去の会話を選択します。','OpenCode：Build／Plan 切り替え','OpenCode で Tab を押して Build／Plan を切り替えます。この短文はキー操作の説明のみを貼り付けます。'],
 };
 const oc=openCodeLabels[language]??openCodeLabels.en;
 return [templates[0],templates[2],{name:permission[0],text:'[Shift+Tab]',scenario:permission[1],source:values[4]},templates[1],templates[3],{name:permission[2],text:'/permissions',scenario:permission[3],source:values[4]},
  ...['agy --continue --dangerously-skip-permissions','/resume','[Shift+Tab]'].map((text,i)=>({name:agy[i*2],text,scenario:agy[i*2+1],source:values[4]})),
  ...['opencode --auto','/sessions','[Tab]'].map((text,i)=>({name:oc[i*2],text,scenario:oc[i*2+1],source:values[4]}))];
}
