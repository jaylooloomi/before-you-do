// Pure geometry/interaction layer. All rectangles are frozen-image pixels; pointers are CSS pixels.
export function selectionRect(start,end,width,height,viewWidth,viewHeight){
 if(!start||!end||![width,height,viewWidth,viewHeight,start.x,start.y,end.x,end.y].every(Number.isFinite)||width<=0||height<=0||viewWidth<=0||viewHeight<=0)return null;
 const left=Math.max(0,Math.min(width,Math.floor(Math.min(start.x,end.x)*width/viewWidth)));
 const top=Math.max(0,Math.min(height,Math.floor(Math.min(start.y,end.y)*height/viewHeight)));
 const right=Math.max(left,Math.min(width,Math.ceil(Math.max(start.x,end.x)*width/viewWidth)));
 const bottom=Math.max(top,Math.min(height,Math.ceil(Math.max(start.y,end.y)*height/viewHeight)));
 return right>left&&bottom>top?[left,top,right-left,bottom-top]:null;
}
export function imagePoint(point,width,height,viewWidth,viewHeight){return {x:Math.max(0,Math.min(width,point.x*width/viewWidth)),y:Math.max(0,Math.min(height,point.y*height/viewHeight))};}
export function contains(rect,point){return point.x>=rect[0]&&point.y>=rect[1]&&point.x<rect[0]+rect[2]&&point.y<rect[1]+rect[3];}
export function normalizeCandidates(candidates,width,height){
 const seen=new Set();return (Array.isArray(candidates)?candidates:[]).slice(0,4096).filter(item=>{
  if(!item||!Number.isInteger(item.id)||item.id<=0||seen.has(item.id)||!Number.isInteger(item.parent)||item.parent<0||!Number.isInteger(item.group)||item.group<=0||!['window','client','control'].includes(item.kind)||!Array.isArray(item.rect)||item.rect.length!==4||!item.rect.every(Number.isInteger))return false;
  const[x,y,w,h]=item.rect;if(x<0||y<0||w<=0||h<=0||x+w>width||y+h>height)return false;
  seen.add(item.id);return true;
 });
}
export function candidateChain(candidates,point){
 // First choose the foreground owner. Small controls in a covered window must never win.
 let node=candidates.find(item=>item.kind==='window'&&item.parent===0&&contains(item.rect,point));if(!node)return [];
 const chain=[node],seen=new Set([node.id]);
 while(chain.length<32){const child=candidates.find(item=>item.group===node.group&&item.parent===node.id&&!seen.has(item.id)&&contains(item.rect,point));if(!child)break;chain.push(child);seen.add(child.id);node=child;}
 return chain.reverse();
}
export function cssRect(rect,width,height,viewWidth,viewHeight){return rect?[rect[0]*viewWidth/width,rect[1]*viewHeight/height,rect[2]*viewWidth/width,rect[3]*viewHeight/height]:null;}
export function floatingPosition(point,width,height,viewWidth,viewHeight,gap=20){
 const x=point.x+gap+width<=viewWidth?point.x+gap:point.x-gap-width;
 const y=point.y+gap+height<=viewHeight?point.y+gap:point.y-gap-height;
 return {x:Math.max(0,Math.min(Math.max(0,viewWidth-width),x)),y:Math.max(0,Math.min(Math.max(0,viewHeight-height),y))};
}
export function magnifierSample(point,width,height,count=17){
 const center={x:Math.min(width-1,Math.max(0,Math.floor(point.x))),y:Math.min(height-1,Math.max(0,Math.floor(point.y)))};
 const radius=Math.floor(count/2),left=center.x-radius,top=center.y-radius;
 const sx=Math.max(0,left),sy=Math.max(0,top),right=Math.min(width,left+count),bottom=Math.min(height,top+count);
 return {sx,sy,sw:right-sx,sh:bottom-sy,dx:sx-left,dy:sy-top,count,center};
}
export class RegionSelection{
 constructor(frame){this.frame=frame;this.candidates=normalizeCandidates(frame.candidates,frame.width,frame.height);this.enabled=true;this.chain=[];this.index=0;this.pressState=null;this.point=null;}
 move(point,viewWidth,viewHeight){
  this.point=point;
  if(this.pressState){const p=this.pressState;if(Math.hypot(point.x-p.start.x,point.y-p.start.y)>=4)p.dragged=true;p.end=point;return;}
  const pixel=imagePoint(point,this.frame.width,this.frame.height,viewWidth,viewHeight);
  const chain=this.enabled?candidateChain(this.candidates,pixel):[];
  if(chain.map(i=>i.id).join('/')!==this.chain.map(i=>i.id).join('/'))this.index=0;this.chain=chain;
 }
 selected(){return this.chain[this.index]??null;}
 cycle(delta=1){if(this.pressState||this.chain.length<2)return false;this.index=(this.index+delta+this.chain.length)%this.chain.length;return true;}
 press(point,viewWidth,viewHeight){this.move(point,viewWidth,viewHeight);this.pressState={start:{...point},end:{...point},dragged:false,candidate:this.selected()};}
 rect(viewWidth,viewHeight){const p=this.pressState;if(p?.dragged)return selectionRect(p.start,p.end,this.frame.width,this.frame.height,viewWidth,viewHeight);return (p?p.candidate:this.selected())?.rect??null;}
 release(point,viewWidth,viewHeight){if(!this.pressState)return null;this.move(point,viewWidth,viewHeight);const rect=this.rect(viewWidth,viewHeight)?.slice()??null;this.pressState=null;this.move(point,viewWidth,viewHeight);return rect;}
 reset(){this.pressState=null;this.chain=[];this.index=0;}
 setEnabled(enabled,viewWidth,viewHeight){this.enabled=enabled;this.reset();if(this.point)this.move(this.point,viewWidth,viewHeight);}
}
