// Convert a physical key press, including Option-modified letters, to native syntax.
export function recordedShortcut(event,{allowSpace=false}={}) {
  if(event.metaKey||event.isComposing||event.repeat)return null;
  let key=event.code==='PrintScreen'?'PrintScreen':/^Key[A-Z]$/.test(event.code)?event.code.slice(3):/^Digit[0-9]$/.test(event.code)?event.code.slice(5):event.key;
  if(allowSpace&&(event.code==='Space'||key===' '))key='Space';
  if(/^[a-z0-9]$/i.test(key)||key==='Space'&&allowSpace){
    if(!event.ctrlKey&&!event.altKey)return null;
    key=key.toUpperCase();
  }else if(!/^(PrintScreen|F(?:[6-9]|1[0-2]))$/.test(key))return null;
  return [...(event.ctrlKey?['Ctrl']:[]),...(event.altKey?['Alt']:[]),...(event.shiftKey?['Shift']:[]),key].join('+');
}
export function normalizeCaptureShortcut(value) {
  if(!value.trim())return '';
  const parts=value.split('+').map(part=>part.trim().toLowerCase()),modifiers=new Set();let key='';
  for(const part of parts){const mod=part==='control'?'ctrl':part;if(['ctrl','alt','shift'].includes(mod)){if(modifiers.has(mod))return null;modifiers.add(mod);}else{if(key)return null;key=['prtsc','prtscr','printscreen'].includes(part)?'PrintScreen':part.toUpperCase();}}
  if(!/^(PrintScreen|F(?:[6-9]|1[0-2])|[A-Z0-9])$/.test(key))return null;
  if(/^[A-Z0-9]$/.test(key)&&!modifiers.has('ctrl')&&!modifiers.has('alt'))return null;
  const result=[...['ctrl','alt','shift'].filter(mod=>modifiers.has(mod)).map(mod=>({ctrl:'Ctrl',alt:'Alt',shift:'Shift'}[mod])),key].join('+');
  return result==='Ctrl+V'?null:result;
}
export function captureShortcutIssues(config,main='') {
  const issues={},entries=Object.entries(config).map(([key,value])=>[key,normalizeCaptureShortcut(value)]);
  for(const [key,value]of entries){if(value===null){issues[key]={type:'invalid'};continue;}if(!value)continue;const others=entries.filter(([other,binding])=>other!==key&&binding===value).map(([other])=>other);if(value===main)others.push('snippet');if(others.length)issues[key]={type:'duplicate',binding:value,others};}
  return issues;
}
export function snippetShortcutFromBinding(value){
 const parts=value.split('+').map(part=>part.trim().toLowerCase()),mods=new Set();let key='';
 for(const part of parts){const mod=part==='control'?'ctrl':part;if(['ctrl','alt','shift'].includes(mod)){if(mods.has(mod))return null;mods.add(mod);}else{if(key)return null;key=part==='space'?'Space':part.toUpperCase();}}
 if(!/^(Space|[A-Z0-9])$/.test(key)||mods.has('ctrl')===mods.has('alt'))return null;
 if(mods.has('ctrl')&&!mods.has('shift')&&['A','C','V','X','Z','Y','S'].includes(key))return null;
 return {modifier:(mods.has('alt')?'alt':'ctrl')+(mods.has('shift')?'Shift':''),key};
}
export function attachShortcutRecorder(input,{onUnsupported=()=>{},allowSpace=false}={}) {
  input.dataset.shortcutRecorder='true';
  let original=input.value;
  input.addEventListener('focus',()=>{original=input.value;});
  // Windows may deliver PrintScreen only on keyup. Accept either path.
  input.addEventListener('keyup',event=>{if(event.key!=='PrintScreen'&&event.code!=='PrintScreen')return;event.preventDefault();event.stopPropagation();const value=recordedShortcut(event,{allowSpace});if(value!==null){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}});
  input.addEventListener('keydown',event=>{
    if(event.key==='Tab')return;
    event.preventDefault();event.stopPropagation();
    if(event.key==='Escape'){input.value=original;input.dispatchEvent(new Event('input',{bubbles:true}));return;}
    if((event.key==='Backspace'||event.key==='Delete')&&!event.ctrlKey&&!event.altKey&&!event.metaKey){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));return;}
    const value=recordedShortcut(event,{allowSpace});
    if(value!==null){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
    else if(!['Alt','Control','Shift','Meta'].includes(event.key)&&!event.isComposing&&!event.repeat)onUnsupported();
  });
}
