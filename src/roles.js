import { extraRoles, extraTemplates } from './extra-role-presets.js';
import { getTemplates } from './template-locales.js';
const languages=['zh-TW','zh-CN','en','ja'];
const localized=(values,language)=>values[languages.indexOf(language)]??values[2];
export const roles=[
 {id:'personal',mark:'✦',name:['我的短句','我的短句','My snippets','マイ短文'],description:['保留原本的常用交代','保留原本的常用交代','Your existing instructions','いつもの指示をそのまま']},
 {id:'developer',mark:'⌘',name:['程式開發','程序开发','Development','開発'],description:['實作、除錯與驗證','实现、调试与验证','Build, debug and verify','実装・デバッグ・検証']},
 {id:'writer',mark:'✎',name:['文字寫作','文字写作','Writing','文章作成'],description:['改寫、潤飾與調整語氣','改写、润色与调整语气','Rewrite, polish and refine','推敲・表現・トーン調整']},
 {id:'researcher',mark:'⌕',name:['研究分析','研究分析','Research','調査・分析'],description:['查證、比較與整理觀點','查证、比较与整理观点','Verify, compare and synthesize','検証・比較・整理']},
];
roles.push(...extraRoles);
export const roleName=(id,language)=>localized(roles.find(r=>r.id===id)?.name??roles[0].name,language);
export const roleDescription=(role,language)=>localized(role.description,language);
const templates={
 ...extraTemplates,
 writer:[
  [
   ['保留原意，幫我潤飾','保留原意，帮我润色','Polish without changing meaning','意味を保って推敲する'],
   ['請保留我的原意與重要細節，讓文字更清楚、自然、精簡；不要擅自加入事實或承諾。直接給我修改後的版本，簡短說明主要調整。','请保留我的原意与重要细节，让文字更清楚、自然、精简；不要擅自加入事实或承诺。直接给我修改后的版本，简短说明主要调整。','Preserve my meaning and important details while making the writing clear, natural and concise. Do not add facts or commitments. Give me the revised text and briefly explain the main changes.','意図と重要な詳細を保ち、明確で自然な簡潔な文章に整えてください。事実や約束を追加せず、修正版と主な変更点を簡潔に示してください。'],
   ['已有初稿，希望改善表達又不改變原意。','已有初稿，希望改善表达又不改变原意。','Use when you have a draft and want clearer wording without changing its meaning.','下書きの意味を変えずに表現を改善したいとき。']
  ],
  [
   ['依讀者調整語氣','依读者调整语气','Adapt to the reader','読み手に合わせる'],
   ['請依我提到的讀者、用途與管道調整語氣，保留核心訊息，避免空話與過度誇飾。若資訊不足，先採用自然、友善且專業的口吻，直接提供可使用的版本。','请依我提到的读者、用途与渠道调整语气，保留核心信息，避免空话与过度夸饰。若信息不足，先采用自然、友善且专业的口吻，直接提供可使用的版本。','Adapt the tone to the audience, purpose and channel I described. Keep the core message and avoid filler or exaggeration. If details are missing, use a natural, friendly and professional tone and provide a ready-to-use version.','指定した読者・目的・媒体に合わせて文体を調整してください。要点を保ち、空疎な表現や誇張を避けてください。情報が不足する場合は自然で親しみやすい丁寧な文体で、そのまま使える文章を示してください。'],
   ['撰寫信件、貼文或對外說明，需要合適的口吻。','撰写信件、帖子或对外说明，需要合适的口吻。','Use for emails, posts or announcements that need an appropriate tone.','メール・投稿・案内のトーンを整えたいとき。']
  ],
  [
   ['先給可直接用的版本','先给可直接用的版本','Lead with the finished text','完成した文章を先に'],
   ['請先給我可直接使用的完整文字，再簡短補充必要說明。用具體、容易理解的說法，刪除重複與不必要的鋪陳，保留重要限制。','请先给我可直接使用的完整文字，再简短补充必要说明。用具体、容易理解的说法，删除重复与不必要的铺陈，保留重要限制。','Start with the complete text ready to use, followed by any essential notes. Use concrete, understandable wording, remove repetition and unnecessary setup, and preserve important qualifications.','そのまま使える完成した文章を先に示し、必要な説明だけを簡潔に添えてください。具体的で分かりやすい表現を使い、重複や不要な前置きを省き、重要な条件は残してください。'],
   ['希望直接取得成品，減少往返修改。','希望直接取得成品，减少往返修改。','Use when you want a ready-to-use result with fewer revision rounds.','やり取りを減らし、そのまま使える文章が欲しいとき。']
  ],
 ],
 researcher:[
  [
   ['先查證，再下結論','先查证，再下结论','Verify before concluding','検証してから結論を出す'],
   ['請先查證關鍵資訊，優先使用官方文件與第一手來源，附上可點開的來源連結與相關日期。清楚區分已確認事實、推論與未知；無法查證就直接說明，不要猜測。','请先查证关键信息，优先使用官方文档与第一手来源，附上可打开的来源链接与相关日期。清楚区分已确认事实、推论与未知；无法查证就直接说明，不要猜测。','Verify key information using official documentation and primary sources where possible. Include accessible source links and relevant dates. Distinguish confirmed facts, inference and unknowns; state what you could not verify rather than guessing.','重要な情報を検証し、公式資料や一次情報を優先して、参照先のリンクと関連する日付を示してください。確認済みの事実・推論・不明点を区別し、確認できない点は推測せず明示してください。'],
   ['涉及時效、數據或來源，需要可靠依據。','涉及时效、数据或来源，需要可靠依据。','Use for time-sensitive claims, data or questions that need reliable sources.','最新情報・数値・出典の信頼性を確認したいとき。']
  ],
  [
   ['用相同標準比較','用相同标准比较','Compare on equal terms','同じ基準で比較する'],
   ['請依我的需求與限制，用相同標準比較方案，整理優缺點、成本與適用情境。說明推薦選項及理由，也指出什麼條件下會改選其他方案；資訊不足處請標明。','请依我的需求与限制，用相同标准比较方案，整理优缺点、成本与适用情境。说明推荐选项及理由，也指出什么条件下会改选其他方案；信息不足处请标明。','Compare options against the same criteria based on my needs and constraints. Summarize benefits, drawbacks, costs and suitable scenarios. Recommend an option with reasons and explain when another would be preferable. Mark missing information.','要件と制約に基づき、同じ基準で選択肢を比較してください。長所・短所・コスト・適した場面を整理し、推奨案と理由、別案が適する条件を示してください。不足する情報は明記してください。'],
   ['正在選工具或方案，想知道差異與取捨。','正在选工具或方案，想知道差异与取舍。','Use when choosing tools or approaches and weighing tradeoffs.','ツールや方法の違いとトレードオフを知りたいとき。']
  ],
  [
   ['找出盲點與反例','找出盲点与反例','Find blind spots and counterexamples','盲点と反例を探す'],
   ['請檢查上述觀點的假設、證據與推論，找出可能的盲點、反例及其他解釋。依影響程度排序，說明哪些有證據、哪些只是可能性，以及還需要什麼資訊才能判斷。','请检查上述观点的假设、证据与推论，找出可能的盲点、反例及其他解释。依影响程度排序，说明哪些有证据、哪些只是可能性，以及还需要什么信息才能判断。','Examine the assumptions, evidence and reasoning above. Identify blind spots, counterexamples and alternative explanations, ordered by impact. Separate evidence-backed issues from possibilities and state what information would help decide.','上の見解の前提・証拠・推論を検討し、盲点・反例・別の解釈を影響の大きい順に挙げてください。裏付けのある問題と可能性を区別し、判断に必要な追加情報を示してください。'],
   ['已有想法或結論，希望檢查是否忽略重要因素。','已有想法或结论，希望检查是否忽略重要因素。','Use when you have a conclusion and want to check what you may have missed.','考えや結論に見落としがないか確認したいとき。']
  ],
 ],
};
export function getRoleDefaults(id,language){
 if(id==='personal')return getTemplates(language).map(({name,text})=>({name,text}));
 if(id==='developer')return [2,4,5].map(i=>{const {name,text}=getTemplates(language)[i];return {name,text};});
 if(!templates[id])throw Error('Unknown role');
 return templates[id].map(([name,text])=>({name:localized(name,language),text:localized(text,language)}));
}
export function findRoleTemplate(item,language){
 if(!item)return null;
 for(const list of Object.values(templates))for(const [names,texts,scenarios] of list){
  if(texts.includes(item.text))return {name:localized(names,language),scenario:localized(scenarios,language),source:localized(Object.values(extraTemplates).includes(list)?['改寫自 agency-agents-zh','改写自 agency-agents-zh','Adapted from agency-agents-zh','agency-agents-zh を基に編集']:['內建角色範本','内置角色模板','Built-in role template','内蔵ロールテンプレート'],language),url:extraRoles.find(role=>extraTemplates[role.id]===list)?.url};
 }
 return null;
}
