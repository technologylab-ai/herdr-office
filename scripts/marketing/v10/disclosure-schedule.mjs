/** Resolve the global disclosure on actual encoded drawer appearance frames. */
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sequence, disclosure, navigationCue } from './plan.mjs';
const directory=path.resolve('artifacts/marketing/v10');
async function pixels(id){return new Promise((resolve,reject)=>{const buffers=[];let error='';const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-i',path.join(directory,'raw',id+'.mp4'),'-vf','crop=860:560:980:360,scale=96:64,format=gray','-fps_mode','passthrough','-an','-f','rawvideo','pipe:1'],{stdio:['ignore','pipe','pipe']});child.stdout.on('data',c=>buffers.push(c));child.stderr.on('data',c=>error+=c);child.on('error',reject);child.on('close',c=>c===0?resolve(Buffer.concat(buffers)):reject(new Error(error)));});}
const changed=[];const gates={};
for(const id of ['basalt-open','needs-input']){
 const bytes=await pixels(id),size=96*64,baseline=bytes.subarray(0,size),mad=[];
 for(let offset=0;offset<bytes.length;offset+=size){let sum=0;for(let p=0;p<size;p++)sum+=Math.abs(baseline[p]-bytes[offset+p]);mad.push(sum/size);}
 const frame=mad.findIndex(v=>v>3);
 if(frame<0||mad.at(-1)<20||mad.slice(0,frame).some(v=>v>=1))throw new Error('Drawer appearance is not a clean measurable visual transition.');
 gates[id]=frame;
 changed.push({id,firstEncodedDrawerFrame:frame,seconds:frame/30,precedingDifference:mad[frame-1],firstDifference:mad[frame],method:'Right drawer ROI mean absolute difference from the initial drawer-free frame; then inspected in the native 30fps boundary review.'});
}
let cursor=0;const ranges=[];
for(const scene of sequence){
 const frames=Math.round(scene.duration*30),mode=disclosure.actualStateModes[scene.id];
 const changes=typeof mode==='string'?[{at:0,mode}]:structuredClone(mode);
 if(scene.id in gates)changes[1].at=gates[scene.id]/30;
 for(let i=0;i<changes.length;i++){
  const start=cursor+Math.round(changes[i].at*30),end=cursor+(i+1<changes.length?Math.round(changes[i+1].at*30):frames);
  const state=changes[i].mode+(navigationCue.scenes.includes(scene.id)?'-navigation':'');
  if(state==='left-navigation'||end<=start)throw new Error('Unexpected global utility state.');
  const previous=ranges.at(-1);
  if(previous?.state===state&&previous.endFrame===start)previous.endFrame=end;
  else ranges.push({state,startFrame:start,endFrame:end});
 }
 cursor+=frames;
}
if(cursor!==1501||ranges[0].startFrame!==0||ranges.at(-1).endFrame!==1501)throw new Error('Incomplete disclosure coverage.');
for(let i=1;i<ranges.length;i++)if(ranges[i-1].endFrame!==ranges[i].startFrame)throw new Error('Disclosure modes overlap or leave a gap.');
const report={frames:cursor,ranges,actualAppearanceGates:changed,oneDisclosurePerFrame:true,navigationCueOnlyDuringPreparedNavigation:true};
await writeFile(path.join(directory,'global-overlay','schedule.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
