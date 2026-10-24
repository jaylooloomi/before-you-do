import { rows, specialTraditional } from './locales.js';
export const languages = ['zh-TW', 'zh-CN', 'en', 'ja'];
const dictionaries = Object.fromEntries(languages.map((language, i) => [language, Object.fromEntries(rows.map(row => [row[0], i ? row[i] : specialTraditional[row[0]] ?? row[0]]))]));
export function resolveLanguage(preference, system = 'en') {
  if (languages.includes(preference)) return preference;
  const value = system.toLowerCase();
  if (/^zh(?:-|$)/.test(value)) return /(?:tw|hk|mo|hant)/.test(value) ? 'zh-TW' : 'zh-CN';
  return value.startsWith('ja') ? 'ja' : 'en';
}
export function translate(key, language, params = {}) {
  return (dictionaries[language]?.[key] ?? dictionaries.en[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
}
let preference = 'system';
try { preference = localStorage.getItem('quicksay.language') || 'system'; } catch {}
if (!['system', ...languages].includes(preference)) preference = 'system';
export const getPreference = () => preference;
export const getLanguage = () => resolveLanguage(preference, globalThis.navigator?.language);
export const t = (key, params) => translate(key, getLanguage(), params);
const callbacks = new Set();
export function onLanguageChange(callback) { callbacks.add(callback); return () => callbacks.delete(callback); }
export function setLanguage(value, persist = true) {
  preference = ['system', ...languages].includes(value) ? value : 'system';
  if (persist) localStorage.setItem('quicksay.language', preference);
  if (globalThis.document) document.documentElement.lang = getLanguage();
  for (const callback of callbacks) callback();
}
if (globalThis.window) window.addEventListener('storage', event => {
  if (event.key === 'quicksay.language') setLanguage(event.newValue, false);
});
if (globalThis.window) window.addEventListener('languagechange', () => {
  if (preference === 'system') setLanguage('system', false);
});
// Bind app-owned static labels. Never traverse user text, JSON, paths, or editable values.
// A binding retains its source key across language switches and detects regenerated labels.
export function bindTranslations(root) {
  const bindings = new WeakMap();
  const protectedSelector = '.role-save-overview,.save-issues,.picker-rolebar,input,textarea,code,.snippet-info,.picker-list .picker-content,#template-preview,#settings-status,#save-status,#native-error';
  let queued = false;
  function render() {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest(protectedSelector)) continue;
      const previous = bindings.get(node);
      const source = previous && node.data === previous.rendered ? previous.source : node.data;
      const key = source.trim();
      const rendered = source.replace(key, t(key));
      bindings.set(node, { source, rendered });
      if (rendered !== node.data) node.data = rendered;
    }
    root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(element => {
      if (element.closest('.snippet,.picker-list .picker-content,code')) return;
      let entry = bindings.get(element); if (!entry) bindings.set(element, entry = {});
      for (const attribute of ['placeholder','aria-label','title']) {
        if (!element.hasAttribute(attribute)) continue;
        const value = element.getAttribute(attribute), prior = entry[attribute];
        const source = prior && prior.rendered === value ? prior.source : value;
        const rendered = t(source); entry[attribute] = {source, rendered};
        if (value !== rendered) element.setAttribute(attribute, rendered);
      }
    });
  }
  const observer = new MutationObserver(() => {
    if (queued) return; queued = true;
    queueMicrotask(() => { queued = false; render(); });
  });
  observer.observe(root, {childList:true, subtree:true, characterData:true});
  onLanguageChange(render); render();
}
export function errorMessage(error) {
  if (error?.code === 'error.import_entry') {
    return t(error.code, {...error.params, reason:t(error.params.reason, error.params)});
  }
  const message = error?.message ?? String(error);
  const code = message.split(':')[0];
  if (code.startsWith('error.')) return t(code);
  if (error instanceof SyntaxError) return t('error.invalid_json');
  return t(message);
}
