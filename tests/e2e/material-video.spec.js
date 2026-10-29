import {readFileSync} from 'node:fs';import {test,expect} from './fixture.js';
const source='data:video/webm;base64,'+readFileSync(new URL('../fixtures/material-video.webm',import.meta.url)).toString('base64');
async function open(page){await page.goto('/');await page.evaluate(source=>{window.qa.state.materials={items:[{id:'clip',name:'recording.webm',kind:'file',text:'',size:53255}]};window.qa.mediaPreviews={clip:source};},source);await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();return page.getByLabel('影片預覽 recording.webm',{exact:true});}
test('existing file-kind recordings decode and play inline with seek and volume controls',async({page})=>{
 const video=await open(page);await expect(video).toBeVisible();await expect.poll(()=>video.evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(1);expect(await video.evaluate(v=>({controls:v.controls,paused:v.paused,width:v.videoWidth,height:v.videoHeight}))).toEqual({controls:true,paused:true,width:128,height:72});
 await video.evaluate(async v=>{v.muted=true;await v.play();});await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(0.1);await video.evaluate(v=>v.pause());expect(await video.evaluate(v=>v.paused)).toBe(true);
 await video.evaluate(v=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=1.1;}));expect(await video.evaluate(v=>v.currentTime)).toBeCloseTo(1.1,1);await video.evaluate(v=>{v.volume=.35;v.muted=false;});expect(await video.evaluate(v=>v.volume)).toBe(.35);await page.screenshot({path:'artifacts/material-video-player.png'});
 expect(await page.evaluate(()=>window.qa.count('save_snippets'))).toBe(0);expect(await page.evaluate(()=>window.qa.state.materials.items[0].kind)).toBe('file');
});
test('preview IPC failure keeps material and offers an export fallback',async({page})=>{
 await page.goto('/');await page.evaluate(()=>{window.qa.state.materials={items:[{id:'bad',name:'bad.mp4',kind:'file',text:'',size:10}]};window.qa.failures.materials_preview='Unsupported media';});await page.getByRole('button',{name:'本次 prompt 素材',exact:true}).click();await expect(page.getByText(/無法播放影片，請匯出素材包/)).toBeVisible();await page.getByRole('button',{name:'匯出素材包',exact:true}).click();await expect(page.getByText('素材包已匯出',{exact:true})).toBeVisible();expect(await page.evaluate(()=>window.qa.state.materials.items.length)).toBe(1);
});
