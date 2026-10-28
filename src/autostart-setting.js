import {t,errorMessage,onLanguageChange} from './i18n.js';

export function createAutostartSetting(invoke) {
 const card=document.createElement('section');card.className='settings-card';
 card.innerHTML='<h3>啟動設定</h3><label class="autostart-toggle"><input type="checkbox" disabled> 登入電腦後自動啟動</label><p>首次使用預設開啟，手動關閉後會記住選擇。</p><p>登入後只啟動到系統匣，不彈出主畫面。移動程式位置後，請關閉再重新開啟此設定。</p><p aria-live="polite"></p>';
 const toggle=card.querySelector('input'),status=card.querySelector('[aria-live]');
 let busy=false,enabled=false,message='正在讀取啟動設定…',params={};
 const report=(key,values={})=>{message=key;params=values;status.textContent=t(message,params);};
 onLanguageChange(()=>report(message,params));report(message);
 async function refresh(){
  if(busy)return;busy=true;toggle.disabled=true;
  try{
   const result=await invoke('get_autostart');
   enabled=!!result.enabled;toggle.checked=enabled;toggle.disabled=!result.supported;
   report(result.supported?(enabled?'已啟用登入時自動啟動。':'登入時自動啟動已關閉。'):'此環境不支援開機啟動設定。');
  }catch(error){report('無法讀取啟動設定：{error}',{error:errorMessage(error)});}
  finally{busy=false;}
 }
 toggle.addEventListener('change',async()=>{
  if(busy){toggle.checked=enabled;return;}
  busy=true;toggle.disabled=true;report('正在儲存啟動設定…');
  try{
   const result=await invoke('set_autostart',{enabled:toggle.checked});
   if(!result.supported||result.enabled!==toggle.checked)throw 'error.autostart_verify';
   enabled=result.enabled;report(enabled?'已啟用登入時自動啟動。':'登入時自動啟動已關閉。');
  }catch(error){report('未能更新啟動設定：{error}',{error:errorMessage(error)});}
  finally{toggle.checked=enabled;toggle.disabled=false;busy=false;}
 });
 return {card,refresh};
}
