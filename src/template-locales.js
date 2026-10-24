import originals from './templates.json' with { type: 'json' };
const variants = {
 'zh-CN': [
 ['理解后直接进行','先简短整理你理解的需求、目的与重要限制，再依此规划并直接进行，不用等我确认。','需求已描述好，希望 AI 先说明理解，再自主继续。'],
 ['先规划，不实现','你知道我的意思吗？帮我规划一下，直接给我你推荐的方案与理由，先不要实现。','方向尚未决定，先听推荐方案与理由，暂时不修改程序。'],
 ['实现、测试并汇报','帮我规划并实现，实际测试主要使用流程；发现 bug 就修正并重测。完成后告诉我测过什么、结果如何，以及哪些还没验证，不用每一步等我确认。','需求已确定，希望 AI 完成实现、测试与修正，再汇报验证结果。'],
 ['按推荐方案直接做','根据我的需求与限制，选择你最推荐的方案，简短说明理由后直接实现并验证，不用再问我选哪个。若有会明显改变需求的取舍，再让我决定。','AI 已列出多个方案，希望它选择最合适的并直接完成。'],
 ['只改必要的地方','在现有方案上完成这次需求，只修改必要的地方，保留其他正常功能。先不要顺便重构或增加额外功能；若发现无关问题，完成后另外告诉我。','修复小功能或 bug，不希望顺便重构、换框架或改动其他功能。'],
 ['实际操作给我看','完成后请实际操作主要使用流程，确认结果符合我的要求；涉及界面的部分，请截图并检查实际显示效果。不要只用编译成功或模拟结果判定完成，无法实测的部分请明说。','界面、快捷键、粘贴与窗口效果需要实际操作和截图验证。'],
 ],
 en: [
 ['Understand, then proceed','Briefly summarize your understanding of my requirements, purpose and key constraints. Then plan and proceed without waiting for my confirmation.','Use when the request is described and you want the AI to explain its understanding before proceeding independently.'],
 ['Plan before implementing','Do you understand what I mean? Plan it out and give me your recommended approach and reasons. Do not implement it yet.','Use when you want a recommendation before deciding on a direction or changing code.'],
 ['Implement, test and report','Plan and implement this, then test the main workflows. Fix any bugs you find and retest. When done, tell me what you tested, the results and anything still unverified. Do not wait for confirmation at every step.','Use when the requirements are settled and you want implementation, testing, fixes and a verification report.'],
 ['Choose and carry out a recommendation','Based on my requirements and constraints, choose your recommended approach, briefly explain why, then implement and verify it. Do not ask me to choose between options unless a tradeoff would materially change the requirements.','Use after the AI lists options and you want it to choose and complete the most suitable one.'],
 ['Change only what is necessary','Complete this request within the existing approach. Change only what is necessary and preserve working features. Do not add unrelated features or refactor along the way. Report unrelated issues separately when done.','Use for a small feature or bug fix when you want to avoid unrelated refactoring or framework changes.'],
 ['Show it working','After completing the work, operate the main workflows and verify that the results meet my requirements. For visual changes, capture screenshots and inspect the actual appearance. Do not treat compilation or simulated results alone as completion. Clearly state anything you could not test.','Use for UI, shortcuts, pasting and window effects that need real operation and visual verification.'],
 ],
 ja: [
 ['理解を整理してから進める','理解した要件、目的、重要な制約を簡潔に整理してください。その内容に基づいて計画し、確認を待たずに進めてください。','依頼内容は説明済みで、AI に理解を説明してから自律的に進めてほしいとき。'],
 ['まず計画し、実装はしない','意図は伝わりましたか？計画を立て、おすすめの方法とその理由を示してください。まだ実装はしないでください。','方針を決める前に提案と理由を聞き、コードはまだ変更したくないとき。'],
 ['実装・テスト・結果報告','計画と実装を行い、主な操作手順を実際にテストしてください。バグがあれば修正して再テストしてください。完了後、テスト内容、結果、未検証の点を報告してください。毎回の確認は不要です。','要件が決まり、実装・テスト・修正を完了して検証結果を報告してほしいとき。'],
 ['推奨する方法で進める','要件と制約に基づいて最もおすすめの方法を選び、理由を簡潔に説明してから実装と検証を進めてください。選択を毎回求める必要はありません。要件が大きく変わる判断がある場合は確認してください。','AI が複数の案を出した後、最適な案を選んで完了してほしいとき。'],
 ['必要な箇所だけ変更する','既存の方法で今回の要件を満たし、必要な箇所だけ変更してください。他の正常な機能は維持し、ついでのリファクタリングや機能追加は行わないでください。無関係な問題は完了後に別途報告してください。','小さな機能変更やバグ修正で、無関係な改修やフレームワーク変更を避けたいとき。'],
 ['実際に動かして確認する','完了後、主な操作手順を実際に実行し、結果が要件を満たすか確認してください。画面に関わる部分はスクリーンショットを撮り、実際の表示を確認してください。コンパイル成功や模擬結果だけで完了と判断せず、実測できない点は明示してください。','UI、ショートカット、貼り付け、ウィンドウ表示を実操作と画像で確認したいとき。'],
 ],
};
const source = {
 'zh-CN':['原有模板','参考 Get Shit Done 执行流程','参考 Get Shit Done 范围限制','参考 Superpowers 验证原则'],
 en:['Original template','Adapted from Get Shit Done execution workflow','Adapted from Get Shit Done scope guidance','Adapted from Superpowers verification guidance'],
 ja:['元のテンプレート','Get Shit Done の実行手順を参考に作成','Get Shit Done のスコープ指針を参考に作成','Superpowers の検証指針を参考に作成'],
};
export function getTemplates(language) {
 if (!variants[language]) return originals;
 return variants[language].map(([name,text,scenario],i)=>({name,text,scenario,source:source[language][i<3?0:i-2],url:originals[i].url}));
}
export function findTemplate(item, language) {
 const index=['zh-TW','zh-CN','en','ja'].map(getTemplates).map(list=>list.findIndex(t=>t.text===item?.text)).find(i=>i>=0);
 return index === undefined ? undefined : getTemplates(language)[index];
}
