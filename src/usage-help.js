import { translate } from './i18n.js';
export function usageHelp(language, modifier, key) {
  const params = {modifier, key};
  return {
    instruction: translate('先點對話輸入框，再按住 {modifier} 並按 {key}，選句後放開貼入。', language, params),
    summary: translate('操作與取消方式', language),
    details: translate('← → 切換角色，↑ ↓ 選句；Esc 或再按 {key} 取消。在管理視窗按快捷鍵只會先收起，草稿會保留。', language, params),
  };
}
