import { translate } from './i18n.js';
export function importPreview(items, savedCount, language) {
  const shown=items.slice(0,5);
  const names=shown.map((item,index)=>{
    const name=Array.from(item.name.replace(/\s+/gu,' ').trim());
    return `${index+1}. ${name.slice(0,32).join('')}${name.length>32?'…':''}`;
  }).join(' | ');
  const message=[
    translate('目前角色已儲存 {current} 筆；將用這 {count} 筆取代清單與未儲存草稿，並先備份原檔。',language,{current:savedCount,count:items.length}),
    translate('名稱預覽（{shown}/{count}）：{names}',language,{shown:shown.length,count:items.length,names}),
  ];
  if(items.length>shown.length)message.push(translate('另有 {count} 筆未列出，請在 JSON 欄確認完整內容。',language,{count:items.length-shown.length}));
  return message.join(' ');
}
