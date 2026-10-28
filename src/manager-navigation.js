// Only navigate the manager when arrows are not being used by an editor/native control.
export function managerNavigation(event, blocked = false) {
 if(blocked||event.defaultPrevented||event.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return null;
 const target=event.target;
 if(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="slider"]'))return null;
 if(event.key==='ArrowLeft'||event.key==='ArrowRight')return {kind:'role',delta:event.key==='ArrowLeft'?-1:1};
 if(event.key==='ArrowUp'||event.key==='ArrowDown')return {kind:'snippet',delta:event.key==='ArrowUp'?-1:1};
 return null;
}

export function nextVisibleSnippet(indices, selected, delta) {
 if(!indices.length)return null;
 const index=indices.indexOf(selected);
 if(index<0)return delta<0?indices.at(-1):indices[0];
 return indices[(index+delta+indices.length)%indices.length];
}
