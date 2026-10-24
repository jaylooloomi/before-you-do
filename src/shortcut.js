import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { t, onLanguageChange } from './i18n.js';
let shortcut = {modifier:'alt', key:'H'};
const callbacks = new Set();
export const getShortcut = () => ({...shortcut});
export const modifierLabel = () => {
  const mac=/Mac/i.test(navigator.platform);
  return (shortcut.modifier.startsWith('alt') ? (mac?'Option ⌥':'Alt') : 'Ctrl') + (shortcut.modifier.endsWith('Shift')?' + Shift':'');
};
export const keyLabel = () => shortcut.key==='Space' ? t('空白鍵') : shortcut.key;
export const shortcutLabel = () => `${modifierLabel()} + ${keyLabel()}`;
export function onShortcutChange(callback) {callbacks.add(callback);}
export function renderShortcut() {
  document.querySelectorAll('.shortcut').forEach(element=>{
    const keys=element.querySelectorAll('kbd');
    if(keys.length===2){keys[0].textContent=modifierLabel();keys[1].textContent=keyLabel();}
  });
}
function update(value) {shortcut=value;renderShortcut();for(const callback of callbacks)callback(value);}
export async function initializeShortcut() {
  await listen('shortcut-changed',event=>update(event.payload));
  // A WebView can load before setup has managed the Rust state on a warm start.
  // Retry the initial read so a transient startup error cannot leave a blank UI.
  let failure;
  for(let attempt=0;attempt<20;attempt++) {
    try {update(await invoke('get_shortcut'));failure=undefined;break;}
    catch(error) {failure=error;await new Promise(resolve=>setTimeout(resolve,100));}
  }
  if(failure)console.warn('Shortcut settings not ready; displaying the default.',failure);
  onLanguageChange(()=>{renderShortcut();for(const callback of callbacks)callback(shortcut);});
}
