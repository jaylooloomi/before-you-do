import { translate } from './i18n.js';
export function scenarioHint(info, language) {
  const note=translate('僅作為選句提示，不會一起貼入。',language);
  return info?.source ? `${note} · ${info.source}` : note;
}
