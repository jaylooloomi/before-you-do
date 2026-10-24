const base='https://github.com/jnMetaCode/agency-agents-zh/blob/main/';
export const extraRoles=[
 {id:'designer',mark:'◈',name:['UI 設計','UI 设计','UI design','UI デザイン'],description:['層級、配色與互動細節','层级、配色与交互细节','Hierarchy, color and interaction','階層・配色・操作性'],path:'design/design-ui-designer.md'},
 {id:'frontend',mark:'⌨',name:['前端開發','前端开发','Frontend','フロントエンド'],description:['響應式介面與操作體驗','响应式界面与操作体验','Responsive UI and interaction','レスポンシブ UI・操作性'],path:'engineering/engineering-frontend-developer.md'},
 {id:'backend',mark:'⚙',name:['後端架構','后端架构','Backend','バックエンド'],description:['API、資料與可靠性','API、数据与可靠性','APIs, data and reliability','API・データ・信頼性'],path:'engineering/engineering-backend-architect.md'},
 {id:'reviewer',mark:'⌗',name:['程式碼審查','代码审查','Code review','コードレビュー'],description:['找出具體問題與修法','找出具体问题与修法','Find actionable code issues','具体的な問題と修正案'],path:'engineering/engineering-code-reviewer.md'},
 {id:'tester',mark:'✓',name:['測試驗證','测试验证','QA testing','テスト・検証'],description:['重現、回歸與完成證據','复现、回归与完成证据','Reproduce, regress and verify','再現・回帰・検証の証拠'],path:'testing/testing-reality-checker.md'},
 {id:'product',mark:'◇',name:['產品規劃','产品规划','Product','プロダクト企画'],description:['需求、優先順序與驗收','需求、优先级与验收','Needs, priorities and acceptance','要件・優先順位・受入基準'],path:'product/product-manager.md'},
 {id:'marketing',mark:'↗',name:['內容行銷','内容营销','Marketing','コンテンツ企画'],description:['受眾、選題與行動引導','受众、选题与行动引导','Audience, topics and calls to action','読者・テーマ・行動喚起'],path:'marketing/marketing-content-creator.md'},
 {id:'project',mark:'☷',name:['專案管理','项目管理','Project planning','プロジェクト管理'],description:['拆解任務、相依與風險','拆解任务、依赖与风险','Tasks, dependencies and risks','タスク・依存関係・リスク'],path:'project-management/project-management-project-shepherd.md'},
].map(role=>({...role,url:base+role.path}));
// Original short adaptations of the linked roles, for insertion into a user's request.
// These are not the upstream full system prompts or claims of built-in AI capability.
export const extraTemplates={
 designer:[
  [['先整理視覺規則','先整理视觉规则','Define visual rules first','見た目のルールを整理'],
   ['請從 UI 設計角度，先整理這個畫面的資訊層級、字體、配色、間距與元件狀態，再依一致的視覺規則改善。保留原本功能，說明設計理由，並檢查文字可讀性與鍵盤焦點。','请从 UI 设计角度，先整理该页面的信息层级、字体、配色、间距与组件状态，再按一致的视觉规则改善。保留原有功能，说明设计理由，并检查文字可读性与键盘焦点。','From a UI design perspective, define the information hierarchy, typography, colors, spacing and component states before improving the screen. Preserve its functions, explain design choices, and check readability and keyboard focus.','UI デザインの観点で情報の階層、書体、配色、余白、コンポーネントの状態を整理してから画面を改善してください。機能を維持し、意図を説明して、可読性とキーボードフォーカスを確認してください。'],
   ['畫面雜亂、風格不一致，希望有系統地改善。','页面杂乱、风格不一致，希望系统地改善。','Use when a screen looks cluttered or inconsistent.','画面の散らかりや見た目の不統一を改善したいとき。']],
  [['檢查所有畫面狀態','检查所有页面状态','Check every UI state','画面の各状態を確認'],
   ['請檢查這個介面的預設、選取、停用、載入、空白與錯誤狀態，以及深淺色和不同視窗尺寸。優先修正看不清楚、按鈕遮擋與操作不明確的地方，附實際畫面證據；無法查看的部分請標明。','请检查该界面的默认、选中、禁用、加载、空白与错误状态，以及深浅色和不同窗口尺寸。优先修复文字不清、按钮遮挡与操作不明确的问题，附实际画面证据；无法查看的部分请标明。','Check default, selected, disabled, loading, empty and error states, light and dark themes, and different window sizes. Prioritize unreadable text, overlapping controls and unclear interactions. Include visual evidence and identify states you could not inspect.','通常・選択・無効・読み込み・空・エラー状態、明暗テーマ、異なるウィンドウサイズを確認してください。読みにくい文字、操作部品の重なり、不明確な操作を優先して直し、画面の証拠と未確認の状態を示してください。'],
   ['介面已做完，希望檢查狀態與版面是否完整。','界面已完成，希望检查状态与布局是否完整。','Use to inspect a finished UI across states and sizes.','実装済みの UI を状態やサイズごとに点検したいとき。']],
 ],
 frontend:[
  [['依現有元件完成介面','依现有组件完成界面','Build with existing components','既存部品で UI を実装'],
   ['請沿用現有前端架構與元件實作這個介面，處理不同寬度、鍵盤操作、焦點、載入與錯誤回饋。避免無關套件或重構，完成後測試主要互動與窄視窗版面。','请沿用现有前端架构与组件实现该界面，处理不同宽度、键盘操作、焦点、加载与错误反馈。避免无关依赖或重构，完成后测试主要交互与窄窗口布局。','Implement this UI using the existing frontend architecture and components. Handle responsive widths, keyboard access, focus, loading and error feedback. Avoid unrelated dependencies or refactoring; test the main interactions and narrow layouts.','既存のフロントエンド構成と部品で UI を実装してください。幅への対応、キーボード操作、フォーカス、読み込み・エラー表示を扱い、無関係な依存追加や改修を避けて、主要操作と狭い画面をテストしてください。'],
   ['新增互動功能，想維持既有架構與操作品質。','新增交互功能，希望维持现有架构与操作质量。','Use when adding an interactive frontend feature.','既存構成にインタラクティブな機能を追加するとき。']],
  [['找出前端效能瓶頸','找出前端性能瓶颈','Measure frontend bottlenecks','フロントエンドの遅さを測る'],
   ['請先量測造成載入或互動延遲的主要原因，再修正影響最大的瓶頸。不要只憑猜測加快取或換框架；比較修改前後的量測結果，並確認畫面與操作未退步。','请先测量加载或交互延迟的主要原因，再修复影响最大的瓶颈。不要凭猜测加缓存或换框架；比较修改前后的测量结果，并确认界面与操作没有退步。','Measure the main causes of loading or interaction delays, then fix the highest-impact bottleneck. Do not add caching or change frameworks based on guesses. Compare before-and-after measurements and check for visual or interaction regressions.','読み込みや操作の遅延原因を測定し、影響の大きいボトルネックから修正してください。推測だけでキャッシュやフレームワーク変更を行わず、前後の測定結果を比較して UI や操作の退行を確認してください。'],
   ['畫面載入慢、操作卡頓，需要找出實際原因。','页面加载慢、操作卡顿，需要查明实际原因。','Use when loading or interactions feel slow.','読み込みや操作が遅く、実際の原因を調べたいとき。']],
 ],
 backend:[
  [['先定義 API 與資料契約','先定义 API 与数据契约','Define API and data contracts','API とデータの契約を定義'],
   ['請先整理 API 輸入輸出、資料模型、權限、錯誤處理與相容性，再依現有架構實作。明確處理驗證失敗與重複請求，加入關鍵路徑測試，避免為尚未需要的規模過度設計。','请先整理 API 输入输出、数据模型、权限、错误处理与兼容性，再按现有架构实现。明确处理验证失败与重复请求，添加关键路径测试，避免为尚未需要的规模过度设计。','Define API inputs and outputs, data models, permissions, error handling and compatibility before implementing within the existing architecture. Handle validation failures and duplicate requests, test critical paths, and avoid designing for scale we do not yet need.','API の入出力、データモデル、権限、エラー処理、互換性を整理し、既存構成で実装してください。検証エラーや重複リクエストを扱い、重要経路をテストして、不要な規模を想定した過剰設計を避けてください。'],
   ['新增 API 或資料功能，需要先釐清契約與邊界。','新增 API 或数据功能，需要先厘清契约与边界。','Use when adding an API or data feature.','API やデータ機能を追加し、契約と境界を整理したいとき。']],
  [['檢查失敗與復原路徑','检查失败与恢复路径','Check failures and recovery','障害と復旧経路を確認'],
   ['請檢查這個後端流程的資料一致性、並行操作、逾時、部分失敗與重試行為。說明可能造成資料遺失或重複寫入的情況，提供最小修正與可重現測試；資料遷移需附備份和復原方式。','请检查该后端流程的数据一致性、并发操作、超时、部分失败与重试行为。说明可能导致数据丢失或重复写入的情况，给出最小修复与可复现测试；数据迁移需附备份和恢复方法。','Check data consistency, concurrent operations, timeouts, partial failures and retries. Identify data-loss or duplicate-write scenarios and provide minimal fixes with reproducible tests. Include backup and recovery steps for data migrations.','整合性、並行操作、タイムアウト、部分障害、再試行を確認してください。データ消失や重複書き込みの条件を示し、最小限の修正と再現可能なテストを用意してください。移行にはバックアップと復旧方法を含めてください。'],
   ['後端有偶發錯誤，或即將調整儲存與資料流程。','后端偶发出错，或即将调整存储与数据流程。','Use for intermittent backend failures or storage changes.','断続的な障害や保存処理の変更を調べるとき。']],
 ],
 reviewer:[
  [['只列可重現的實質問題','只列可复现的实质问题','Report concrete review findings','具体的な指摘に絞る'],
   ['請審查這次修改的正確性、安全性、相容性與關鍵測試，優先指出有具體依據的實質問題。每項附檔案位置、觸發條件、影響與修正建議，依嚴重度排序；不要把個人風格偏好當成 bug。先審查，不要修改程式。','请审查本次修改的正确性、安全性、兼容性与关键测试，优先指出有具体依据的实质问题。每项附文件位置、触发条件、影响与修复建议，按严重程度排序；不要把风格偏好当成 bug。先审查，不要修改代码。','Review correctness, security, compatibility and critical tests. Prioritize evidence-backed issues, each with a file location, trigger, impact and suggested fix, ordered by severity. Do not treat style preferences as bugs. Review only; do not change code yet.','正しさ、安全性、互換性、重要なテストをレビューしてください。根拠のある問題を優先し、場所・発生条件・影響・修正案を深刻度順に示してください。好みをバグとせず、まず指摘のみ行いコードは変更しないでください。'],
   ['準備合併或交付前，希望先取得具體審查意見。','准备合并或交付前，希望获得具体审查意见。','Use for actionable review before merging or delivery.','マージや納品前に具体的なレビューが欲しいとき。']],
  [['檢查相鄰流程有無退步','检查相邻流程有无退步','Review neighboring regressions','周辺処理の退行を確認'],
   ['請追蹤這次修改涉及的呼叫端、狀態與資料格式，檢查是否破壞既有正常流程。特別查看邊界輸入、舊資料、錯誤回復與取消操作，指出缺少哪些能驗證行為的測試；無法確認的地方請標明。','请追踪本次修改涉及的调用方、状态与数据格式，检查是否破坏原有流程。重点查看边界输入、旧数据、错误恢复与取消操作，指出缺少哪些行为测试；无法确认的地方请标明。','Trace affected callers, state and data formats to check for regressions in existing flows. Examine boundary inputs, old data, error recovery and cancellation. Identify missing behavioral tests and state what you could not confirm.','変更が影響する呼び出し元、状態、データ形式を追い、既存フローの退行を確認してください。境界入力、旧データ、エラー復旧、キャンセルを重点的に調べ、不足する動作テストと未確認点を示してください。'],
   ['修改共用邏輯、資料格式或狀態管理後擔心回歸。','修改公共逻辑、数据格式或状态管理后担心回归。','Use after changes to shared logic, state or data formats.','共通処理・状態・データ形式の変更後に退行を確認するとき。']],
 ],
 tester:[
  [['依主要流程實際驗收','依主要流程实际验收','Verify the real user journey','主要な利用手順で検証'],
   ['請依需求列出主要操作、邊界與失敗情境，實際執行可以執行的測試。回報步驟、預期與實際結果，涉及畫面請截圖查看；不要把編譯成功當作功能通過，無法實測的項目要分開列出。','请按需求列出主要操作、边界与失败场景，实际执行可执行的测试。汇报步骤、预期与实际结果，涉及界面请截图查看；不要把编译成功当作功能通过，无法实测的项目要单独列出。','List the main user flows, boundaries and failure cases, then run the tests you can execute. Report steps, expected and actual results, and inspect screenshots for visual changes. Compilation alone is not a functional pass; list untested items separately.','主要操作、境界、失敗ケースを整理し、実行可能なテストを実際に行ってください。手順・期待結果・実際の結果を報告し、画面はスクリーンショットで確認してください。ビルド成功だけで合格とせず、未実測項目を分けて示してください。'],
   ['功能完成，想確認使用者真的能完成任務。','功能完成，希望确认用户能完成任务。','Use when a feature needs end-to-end acceptance evidence.','機能完成後に一連の利用手順で受入確認したいとき。']],
  [['先重現，再修正重測','先复现，再修复重测','Reproduce, fix and retest','再現してから修正・再テスト'],
   ['請先找出最小重現步驟並確認錯誤原因，再修正與重測。保留可防止同類問題復發的測試，檢查相鄰功能沒有退步，最後回報重現條件、修正內容與測試結果。','请先找出最小复现步骤并确认原因，再修复和重测。保留能防止同类问题复发的测试，检查相邻功能没有退步，最后汇报复现条件、修复内容与测试结果。','Find minimal reproduction steps and confirm the cause before fixing and retesting. Keep a regression test, check neighboring functionality, and report the reproduction conditions, changes and test results.','最小の再現手順と原因を確認してから修正・再テストしてください。再発防止テストを残し、周辺機能の退行を確認して、再現条件・修正内容・テスト結果を報告してください。'],
   ['發現 bug，希望修正有依據且能防止再發。','发现 bug，希望有依据地修复并防止再发。','Use for a bug fix that needs reproducible regression coverage.','バグを根拠に基づいて直し、再発を防ぎたいとき。']],
 ],
 product:[
  [['把想法整理成可驗收需求','把想法整理成可验收需求','Turn an idea into acceptance criteria','アイデアを受入可能な要件に'],
   ['請先釐清使用者、問題、目的與限制，再整理最小可行範圍、主要情境和可觀察的驗收條件。區分必要功能與可延後項目，標明假設和待確認資訊，先不要進行實作。','请先厘清用户、问题、目的与限制，再整理最小可行范围、主要场景和可观察的验收条件。区分必需功能与可延后事项，标明假设和待确认信息，先不要实现。','Clarify the user, problem, goal and constraints. Define the minimum viable scope, main scenarios and observable acceptance criteria. Separate essentials from deferrable items, mark assumptions and open questions, and do not implement yet.','ユーザー・問題・目的・制約を整理し、最小実用範囲、主要な利用場面、観察可能な受入基準を定義してください。必須と後回し可能な項目を分け、仮定と未確認情報を明示し、まだ実装しないでください。'],
   ['只有模糊想法，需要先形成清楚需求。','只有模糊想法，需要先形成清晰需求。','Use when a vague idea needs a clear product scope.','曖昧なアイデアを明確な要件にしたいとき。']],
  [['依影響與成本排優先順序','依影响与成本排优先级','Prioritize by impact and effort','影響と工数で優先順位を付ける'],
   ['請依使用者價值、證據、風險、成本與相依關係，安排這些功能的優先順序。推薦第一批應做的項目並說明取捨；缺乏資料時標明假設，不要捏造精確分數或時程。','请按用户价值、证据、风险、成本与依赖关系排列功能优先级。推荐第一批应做的事项并说明取舍；缺少数据时标明假设，不要编造精确分数或工期。','Prioritize these features by user value, evidence, risk, effort and dependencies. Recommend the first batch and explain tradeoffs. Mark assumptions when data is missing rather than inventing precise scores or timelines.','ユーザー価値、根拠、リスク、工数、依存関係で優先順位を付けてください。最初に取り組む項目と取捨選択を説明し、情報がなければ仮定を示して正確そうな点数や日程を捏造しないでください。'],
   ['需求很多，希望先選出值得做的第一批。','需求很多，希望先选出值得做的第一批。','Use when deciding which features to build first.','多数の要望から最初に取り組む項目を選ぶとき。']],
 ],
 marketing:[
  [['依受眾與平台改寫內容','依受众与平台改写内容','Adapt content to audience and channel','読者と媒体に合わせて編集'],
   ['請依目標受眾與發布平台，改寫成有明確重點、具體例子與適當行動引導的內容。保留可查證資訊，避免空話、誇大承諾與捏造數據；先給可發布版本，再說明調整理由。','请按目标受众和发布平台，改写成重点明确、有具体例子与适当行动引导的内容。保留可核实信息，避免空话、夸大承诺与编造数据；先给可发布版本，再说明调整理由。','Adapt this for the target audience and publishing channel with a clear point, concrete examples and an appropriate call to action. Keep verifiable information; avoid filler, inflated promises or fabricated numbers. Lead with publishable copy, then explain the changes.','対象読者と媒体に合わせ、要点・具体例・適切な行動喚起のある内容に編集してください。検証可能な情報を保ち、空疎な表現や誇大な約束、架空の数値を避けて、公開可能な文章を先に示してください。'],
   ['已有內容，要改成貼文、產品介紹或宣傳文案。','已有内容，要改成帖子、产品介绍或宣传文案。','Use to turn existing material into posts or promotional copy.','既存の素材を投稿や紹介文に編集したいとき。']],
  [['給我可執行的內容企劃','给我可执行的内容策划','Create an actionable content plan','実行可能なコンテンツ計画'],
   ['請以我的產品、受眾與目標規劃內容主題，每個主題附切入角度、格式、讀者收穫與可觀察的成效指標。優先使用已有素材，說明如何改成不同平台版本，不要只列抽象口號。','请围绕产品、受众与目标规划内容主题，每个主题附切入角度、形式、读者收获与可观察的效果指标。优先使用现有素材，说明如何改成不同平台版本，不要只列抽象口号。','Plan content topics around my product, audience and goals. For each, include an angle, format, reader benefit and observable success measure. Reuse available material and explain channel adaptations instead of listing vague slogans.','製品・読者・目的に沿ったテーマを企画し、切り口、形式、読者のメリット、観察可能な成果指標を示してください。既存素材を優先して媒体別の展開方法を説明し、抽象的な標語だけにしないでください。'],
   ['要持續經營內容，需要具體主題與執行方向。','希望持续运营内容，需要具体主题与执行方向。','Use when planning a repeatable content program.','継続的な発信に向けてテーマと実行方針を決めるとき。']],
 ],
 project:[
  [['拆成可執行的工作清單','拆成可执行的任务清单','Break work into executable tasks','実行可能なタスクに分解'],
   ['請把目標拆成可執行任務，列出相依關係、每步產出、完成條件與主要風險。先安排最小可驗證的一批工作，區分必須先決定與可以邊做邊確認的事項；不要擅自承諾期限或替他人指派工作。','请把目标拆成可执行任务，列出依赖关系、每步产出、完成条件与主要风险。先安排最小可验证的一批任务，区分必须先决定与可以边做边确认的事项；不要擅自承诺期限或给他人分配工作。','Break the goal into tasks with dependencies, deliverables, completion criteria and key risks. Start with a small verifiable batch and distinguish upfront decisions from details that can be resolved during work. Do not commit deadlines or assign people without authorization.','目標をタスクに分け、依存関係・成果物・完了条件・主なリスクを示してください。最小の検証可能な作業から始め、先に必要な判断と進めながら確認できる事項を分け、無断で期限や担当者を決めないでください。'],
   ['要開始一個較大的工作，希望先知道執行順序。','即将开始较大的工作，希望先明确执行顺序。','Use when a larger goal needs a practical execution sequence.','大きな目標の実行順序を整理したいとき。']],
  [['整理進度、阻礙與下一步','整理进度、阻碍与下一步','Summarize progress and blockers','進捗・障害・次の行動を整理'],
   ['請根據已有紀錄整理已完成、進行中、阻礙與下一步，清楚區分已驗證結果與未完成承諾。指出需要誰提供什麼資訊才能繼續；資訊不足時不要猜測完成度或日期，保持回報簡短可追蹤。','请根据现有记录整理已完成、进行中、阻碍与下一步，明确区分已验证结果与未完成承诺。指出需要谁提供什么信息才能继续；信息不足时不要猜测完成度或日期，保持汇报简短可追踪。','Use the available records to summarize completed work, work in progress, blockers and next actions. Separate verified results from unfinished commitments. State what information is needed and from whom; do not invent completion percentages or dates. Keep it concise and traceable.','記録に基づき完了・進行中・障害・次の行動を整理し、検証済み結果と未完了の約束を区別してください。続行に必要な情報と提供元を示し、進捗率や日付を推測せず簡潔に追跡可能な報告にしてください。'],
   ['工作進行一段時間，需要整理目前狀況與阻礙。','工作已进行一段时间，需要整理当前情况与阻碍。','Use for a concise status update grounded in actual work.','実際の記録に基づく簡潔な状況報告が必要なとき。']],
 ],
};
