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
 return [...commands.map((text,i)=>({name:values[i],text,scenario:values[i+2],source:values[4]})),
  ...['claude --resume','codex resume --all'].map((text,i)=>({name:resume[i],text,scenario:resume[i+2],source:values[4]}))];
}
