import { t } from './i18n.js';
// App-owned modal: no WebView origin heading, safe text, native focus trapping.
export function askConfirmation({ title, message, confirmText = '確認', danger = false, notice = false }) {
  if (document.querySelector('dialog[open]')) return Promise.resolve(false);
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'app-dialog';
  dialog.setAttribute('aria-labelledby', 'confirmation-title');
  dialog.setAttribute('aria-describedby', 'confirmation-message');
  const heading = document.createElement('h3');
  heading.id = 'confirmation-title'; heading.textContent = t(title);
  const description = document.createElement('p');
  description.id = 'confirmation-message'; description.textContent = t(message);
  const actions = document.createElement('div'); actions.className = 'dialog-actions';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = t('取消');
  cancel.className = 'dialog-cancel'; cancel.hidden = notice;
  const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = t(confirmText);
  confirm.className = danger ? 'dialog-confirm danger' : 'dialog-confirm';
  actions.append(cancel, confirm); dialog.append(heading, description, actions); document.body.append(dialog);
  return new Promise(resolve => {
    let finished = false;
    const finish = result => {
      if (finished) return;
      finished = true; dialog.close(); dialog.remove();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      resolve(result);
    };
    cancel.onclick = () => finish(false);
    confirm.onclick = () => finish(true);
    dialog.oncancel = event => { event.preventDefault(); finish(false); };
    dialog.onclose = () => finish(false);
    dialog.showModal(); (notice ? confirm : cancel).focus();
  });
}
