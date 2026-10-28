// Browser-only IPC boundary double. Never accesses native app, disk or OS clipboard.
export function installBridge(){
  const seed=[{name:'理解後直接進行',text:'先整理需求再進行。',scenario:'需求已描述好'}, {name:'先規劃，不實作',text:'請先規劃。'}, {name:'實作測試',text:'實作並測試。'}];
  const state=JSON.parse(localStorage.getItem('qa.disk')||'null')||{role:'personal',files:{personal:seed},shortcut:{modifier:'alt',key:'H'}};
  const callbacks=new Map(),events=new Map(),calls=[],failures={},gates={};let next=0;
  function persist(){localStorage.setItem('qa.disk',JSON.stringify(state));}
  function emit(event,payload){for(const id of events.get(event)||[])callbacks.get(id)?.({event,payload});}
  const qa=window.qa={state,calls,failures,clipboard:'',emit,
    hold(cmd){gates[cmd]={};gates[cmd].promise=new Promise(resolve=>gates[cmd].resolve=resolve);},
    release(cmd){gates[cmd]?.resolve();delete gates[cmd];},
    count(cmd){return calls.filter(c=>c.cmd===cmd).length;}};
  const startupFailure=new URLSearchParams(location.search).get('qaFail');
  if(startupFailure)failures[startupFailure]='error.read';
  window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
  window.__TAURI_INTERNALS__={transformCallback(fn){callbacks.set(++next,fn);return next;},async invoke(cmd,args={}){
    calls.push({cmd,args:structuredClone(args)});
    if(gates[cmd])await gates[cmd].promise;
    if(failures[cmd])throw failures[cmd];
    if(cmd==='plugin:event|listen'){const ids=events.get(args.event)||[];ids.push(args.handler);events.set(args.event,ids);return args.handler;}
    state.materials??={items:[]};
    if(cmd==='materials_load')return structuredClone(state.materials);
    if(cmd==='materials_text'){if(args.itemId){state.materials.items.find(i=>i.id===args.itemId).text=args.text;}else state.materials.items.push({id:'m'+(++next),name:'Text',kind:'text',text:args.text,size:0});persist();return structuredClone(state.materials);}
    if(cmd==='materials_import'){state.materials.items.push({id:'m'+(++next),name:args.name,kind:args.name.endsWith('.png')?'image':'file',text:'',size:args.bytes.length});persist();return structuredClone(state.materials);}
    if(cmd==='materials_preview')return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
    if(cmd==='materials_order'){state.materials.items=args.ids.map(id=>state.materials.items.find(i=>i.id===id));persist();return structuredClone(state.materials);}
    if(cmd==='materials_remove'){state.materials.items=state.materials.items.filter(i=>i.id!==args.itemId);persist();return structuredClone(state.materials);}
    if(cmd==='materials_export')return 'QA_ONLY/prompt-materials/exports/test-bundle';
    if(cmd==='capture_start'){if(args.mode!=='region'){state.materials.items.push({id:'m'+(++next),name:args.mode+'.png',kind:'image',text:'',size:100});persist();emit('materials-updated',null);}return;}
    if(cmd==='capture_frame')return {width:1920,height:1080,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='};
    if(cmd==='capture_finish')return;
    if(cmd==='get_role')return state.role;
    if(cmd==='get_autostart')return {supported:true,enabled:!!state.autostart};
    if(cmd==='set_autostart'){state.autostart=args.enabled;persist();return {supported:true,enabled:state.autostart};}
    if(cmd==='get_snippets'||cmd==='reload_snippets')return structuredClone(state.files[state.role]||[]);
    if(cmd==='get_shortcut')return state.shortcut;
    if(cmd==='save_shortcut'){if(args.shortcut.modifier==='ctrl'&&['A','C','V','X','Z','Y','S'].includes(args.shortcut.key))throw 'error.shortcut_reserved';state.shortcut=args.shortcut;persist();emit('shortcut-changed',args.shortcut);return args.shortcut;}
    if(cmd==='storage_info')return {path:`QA_ONLY/snippets-${state.role}.json`,backup:'QA_ONLY/previous.json.bak',exists:true};
    if(cmd==='switch_role'){state.role=args.role;state.files[args.role]??=structuredClone(args.defaults);persist();return structuredClone(state.files[state.role]);}
    if(cmd==='save_snippets'){state.files[state.role]=structuredClone(args.items);persist();return;}
    if(cmd==='copy_text'){qa.clipboard=args.text;return;}
    if(cmd==='native_status')return '已啟用';
    if(cmd==='picker_state')return {items:structuredClone(state.files[state.role]||[]),selected:0,role:state.role,visible:true};
    if(cmd==='consume_new_snippet'||cmd==='consume_open_settings')return false;
    if(cmd==='request_quit'){emit('quit-requested',null);return;}
    if(['configure_glass','set_ui_language','window_action','hide_manager','dismiss_manager_shortcut','restart_keyboard','confirm_quit','open_data_folder'].includes(cmd))return;
    throw new Error(`Unimplemented test IPC: ${cmd}`);
  }};
}
