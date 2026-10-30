const paths={
 file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6M9 16h6"/>',
 folder:'<path d="M3 7h7l2-3h8a1 1 0 0 1 1 1v14H3z"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 2-1 4 3 2 3-1 3 4 3-2v-4l3-2-1-4-3-1-1-3z"/>',
 text:'<path d="M4 5h16M12 5v15M8 20h8"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 18 6-6 4 4 3-6 5 8"/>',
 play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
 window:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18"/>',
 region:'<path stroke-dasharray="2 2" d="M3 3h18v18H3z"/>',
 video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
 gif:'<circle cx="12" cy="12" r="9"/>',
 copy:'<rect x="8" y="7" width="12" height="14" rx="2"/><path d="M16 7V3H4v14h4"/>',
 export:'<path d="M5 9H3v12h18V9h-2M12 16V2m-5 5 5-5 5 5"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18M7 14h2m4 0h2m-8 4h2m4 0h2"/>',
 size:'<path d="M3 3h18v18H3zM7 3v4m5-4v4m5-4v4M3 7h4m-4 5h4m-4 5h4"/>',
 globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
 drag:'<circle cx="8" cy="5" r=".8"/><circle cx="16" cy="5" r=".8"/><circle cx="8" cy="12" r=".8"/><circle cx="16" cy="12" r=".8"/><circle cx="8" cy="19" r=".8"/><circle cx="16" cy="19" r=".8"/>',
};
export function uiIcon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??paths.file}</svg>`;}
export function actionIcon(button,name,label,accessible=label){button.setAttribute('aria-label',accessible);button.title=accessible;button.innerHTML=uiIcon(name);const span=document.createElement('span');span.textContent=label;button.append(span);}
export function formatBytes(size){return size>=1024*1024?`${(size/(1024*1024)).toFixed(1)} MB`:`${(size/1024).toFixed(1)} KB`;}
export function formatDuration(seconds){if(!Number.isFinite(seconds))return '—';const value=Math.floor(seconds);return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}
