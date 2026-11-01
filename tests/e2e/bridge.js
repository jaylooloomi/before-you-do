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
    state.recording??={supported:true,runtime_ready:true,installing:false,status:{phase:'idle'}};
    state.captureHotkeys??={supported:true,registered:true,error:null,config:{region:'Shift+PrintScreen',fullscreen:'PrintScreen',window:'Alt+PrintScreen',video:'Ctrl+Shift+PrintScreen',gif:'Ctrl+Alt+Shift+PrintScreen'}};
    if(cmd==='recording_control'){const next={pause:'paused',resume:'recording',stop:'finalizing',cancel:'cancelled'}[args.action];state.recording.status={...state.recording.status,phase:next};emit('recording-state',state.recording.status);return;}
    if(cmd==='recording_state')return structuredClone(state.recording);
    if(cmd==='recording_install'){state.recording.runtime_ready=true;return;}
    if(cmd==='recording_stop'){state.recording.status={phase:'finalizing'};emit('recording-state',state.recording.status);return;}
    if(cmd==='capture_hotkeys_get')return structuredClone(state.captureHotkeys);
    if(cmd==='capture_hotkeys_editing'){state.captureHotkeysEditing=args.editing;return null;}
    if(cmd==='materials_workspace'){
      state.taskPacks??={version:1,active:'legacy',packs:[{id:'legacy',name:'My task',bundle:structuredClone(state.materials)}]};const store=state.taskPacks;
      const copy=bundle=>{const result=structuredClone(bundle);result.items.forEach(item=>{const old=item.id;item.id='copy-'+(++next);if(qa.mediaPreviews?.[old])qa.mediaPreviews[item.id]=qa.mediaPreviews[old];});return result;};
      if(!store.workspace){store.packs.find(p=>p.id===store.active).bundle=copy(state.materials);store.workspace=structuredClone(state.materials);store.next_sequence=1;}
      store.workspace=structuredClone(state.materials);let savedName=null;
      if(args.action==='save'){if(!state.materials.items.length)throw 'No materials to save';const base='素材包 '+args.name;let n=2;savedName=base;while(store.packs.some(p=>p.name===savedName))savedName=base+'-'+String(n++).padStart(2,'0');store.packs.push({id:'saved-'+(++next),name:savedName,bundle:copy(state.materials),created_ms:Date.now()});}
      else if(args.action==='clear'){if(state.materials.items.length){store.undo=structuredClone(state.materials);state.materials={items:[]};}}
      else if(args.action==='undo'){if(!store.undo)throw 'Nothing to restore';state.materials={items:[...store.undo.items,...state.materials.items]};store.undo=null;}
      else if(args.action==='add'||args.action==='replace'){const pack=store.packs.find(p=>p.id===args.target);if(!pack)throw 'Material pack not found';const items=[...(args.action==='add'?state.materials.items:[]),...copy(pack.bundle).items];if(items.length>100)throw 'Material limits exceeded';state.materials={items};store.undo=null;}
      else if(args.action==='delete'){const i=store.packs.findIndex(p=>p.id===args.target);if(i<0)throw 'Material pack not found';store.packs.splice(i,1);}
      else if(args.action==='rename'){const name=args.name.trim();if(!name||name.length>80)throw 'Enter a material pack name (1–80 characters)';if(store.packs.some(p=>p.id!==args.target&&p.name.toLowerCase()===name.toLowerCase()))throw 'Material pack name already exists';store.packs.find(p=>p.id===args.target).name=name;}
      store.workspace=structuredClone(state.materials);persist();return structuredClone({active:'workspace',previous_active:store.active,packs:store.packs.filter(p=>p.bundle.items.length).map(p=>({id:p.id,name:p.name,count:p.bundle.items.length,created_ms:p.created_ms||0})),canUndo:!!store.undo,savedName});
    }
    if(cmd==='materials_save_as'){state.taskPacks.packs.find(p=>p.id===state.taskPacks.active).bundle=structuredClone(state.materials);const name=args.name.trim();if(state.taskPacks.packs.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw 'Task name already exists';const id='copy-'+(++next),bundle=structuredClone(state.materials);bundle.items.forEach(item=>item.id='copy-item-'+(++next));state.taskPacks.packs.push({id,name,bundle});state.taskPacks.active=id;state.materials=structuredClone(bundle);persist();return null;}
    if(cmd==='materials_store'){if(args.clear)state.materials={items:[]};if(state.taskPacks)state.taskPacks.packs.find(p=>p.id===state.taskPacks.active).bundle=structuredClone(state.materials);persist();return structuredClone(state.materials);}
    if(cmd==='materials_quick_snapshot')return structuredClone({items:state.materials.items,taskName:'My task',quick:state.captureHotkeys?.config.quick??'Alt+M',paste:state.captureHotkeys?.config.paste??'Alt+V'});
    if(cmd==='materials_quick_finish_clear'){state.taskPacks??={packs:[]};state.taskPacks.undo=structuredClone(state.materials);state.materials={items:[]};persist();return null;}
    if(cmd==='materials_quick_action'||cmd==='materials_quick_open'||cmd==='materials_quick_abort'||cmd==='materials_quick_finish_paste')return null;
    if(cmd==='materials_paste_all'){qa.batchPaste={target:args.target,items:structuredClone(state.materials.items)};return null;}
    if(cmd==='capture_hotkeys_save'){state.captureHotkeys.config=args.config;persist();return structuredClone(state.captureHotkeys);}

    if(cmd==='capture_capabilities')return structuredClone(state.captureCapabilities||{platform:'windows',supported:true,permission:'not_required',reason:null,windowSemantics:'visible_pixels'});
    if(cmd==='capture_request_permission'){state.captureCapabilities.permission=qa.permissionDecision||'required';state.captureCapabilities.reason=state.captureCapabilities.permission==='granted'?null:'error.capture_permission';return structuredClone(state.captureCapabilities);}
    if(cmd==='capture_open_permissions')return;
    if(cmd==='materials_info')return qa.materialInfo?.[args.itemId]??{};
    if(cmd==='materials_choose_files'){for(const item of qa.chosenMaterials??[])state.materials.items.push(item);persist();return structuredClone(state.materials);}
    if(cmd==='materials_open'||cmd==='materials_copy')return;
    if(cmd==='get_default_role')return state.defaultRole??null;
    if(cmd==='set_default_role'){state.defaultRole=args.role;persist();emit('default-role-changed',args.role);return args.role;}
    if(cmd==='materials_packs'||cmd==='materials_select_pack'){
      state.taskPacks??={version:1,active:'legacy',packs:[{id:'legacy',name:'My task',bundle:structuredClone(state.materials)}]};
      const store=state.taskPacks;if(!store.workspace)store.packs.find(p=>p.id===store.active).bundle=structuredClone(state.materials);
      if(cmd==='materials_select_pack'){
        if(args.name!=null){const name=args.name.trim();if(store.packs.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw 'Task name already exists';const id='pack-'+Date.now();store.packs.push({id,name,bundle:{items:[]}});store.active=id;}
        else {if(!store.packs.some(p=>p.id===args.target))throw 'Task pack not found';store.active=args.target;}
        state.materials=structuredClone(store.packs.find(p=>p.id===store.active).bundle);persist();
      }
      return structuredClone(store);
    }
    if(cmd==='materials_load')return structuredClone(state.materials);
    if(cmd==='materials_text'){if(args.itemId){state.materials.items.find(i=>i.id===args.itemId).text=args.text;}else state.materials.items.push({id:'m'+(++next),name:'Text',kind:'text',text:args.text,size:0});persist();return structuredClone(state.materials);}
    if(cmd==='materials_import'){state.materials.items.push({id:'m'+(++next),name:args.name,kind:args.name.endsWith('.png')?'image':'file',text:'',size:args.bytes.length});persist();return structuredClone(state.materials);}
    if(cmd==='materials_replace_image'){const item=state.materials.items.find(item=>item.id===args.itemId);if(!item)throw 'Material not found';item.size=args.bytes.length;qa.mediaPreviews??={};qa.mediaPreviews[args.itemId]='data:image/png;base64,'+btoa(String.fromCharCode(...args.bytes));persist();return structuredClone(state.materials);}
    if(cmd==='materials_preview'&&qa.mediaPreviews?.[args.itemId])return qa.mediaPreviews[args.itemId];
    if(cmd==='materials_preview')return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';
    if(cmd==='materials_order'){state.materials.items=args.ids.map(id=>state.materials.items.find(i=>i.id===id));persist();return structuredClone(state.materials);}
    if(cmd==='materials_remove'){state.materials.items=state.materials.items.filter(i=>i.id!==args.itemId);persist();return structuredClone(state.materials);}
    if(cmd==='materials_export')return 'QA_ONLY/prompt-materials/exports/test-bundle';
    if(cmd==='capture_start'){if(args.mode.startsWith('record-'))return;if(args.mode!=='region'){state.materials.items.push({id:'m'+(++next),name:args.mode+'.png',kind:'image',text:'',size:100});persist();emit('materials-updated',null);}return;}
    if(cmd==='capture_frame'&&qa.frame)return structuredClone(qa.frame);
    if(cmd==='capture_frame')return {session:1,width:1920,height:1080,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg=='};
    if(['capture_finish','capture_prime','capture_present','capture_prepare_failed'].includes(cmd))return;
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
