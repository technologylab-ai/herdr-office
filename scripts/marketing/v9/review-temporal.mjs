/** Export ordered temporal evidence from the actual assembled teaser. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const directory=path.resolve('artifacts/marketing/v9');
const report=JSON.parse(await readFile(path.join(directory,'assembly-report.json'),'utf8'));
const film=path.join(directory,report.final.filename);
const sha256=createHash('sha256').update(await readFile(film)).digest('hex');
if(sha256!==report.final.sha256)throw new Error('The reviewed film differs from the assembled film.');
const scene=id=>report.clips.find(c=>c.id===id);
const windows=[
 {id:'early-machine-switch',from:scene('floors-select').end-.6,to:scene('floors-buildnode').start+1.2,fps:8},
 {id:'return-and-walk',from:scene('floors-return-select').start-.4,to:scene('run').start+1.2,fps:8},
 {id:'bookmark-context',from:scene('bookmark-star-switch').start-.3,to:scene('bookmark-return').end+.3,fps:8},
 {id:'whole-film',from:0,to:report.duration,fps:1},
];
async function execute(args){return new Promise((resolve,reject)=>{let error='';const child=spawn('ffmpeg',['-y','-hide_banner','-loglevel','error',...args],{stdio:['ignore','ignore','pipe']});child.stderr.on('data',c=>error+=c);child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(error)));});}
const evidence=[];
for(const window of windows){
 const folder=path.join(directory,'temporal-review',window.id);await mkdir(folder,{recursive:true});
 await execute(['-ss',String(window.from),'-i',film,'-t',String(window.to-window.from),'-vf',`fps=${window.fps},scale=480:270,tile=4x4:nb_frames=16:padding=4:margin=4`,'-fps_mode','passthrough','-an',path.join(folder,'sheet-%03d.png')]);
 const count=Math.round((window.to-window.from)*window.fps);
 const tiles=Array.from({length:count},(_,i)=>({sheet:`sheet-${String(Math.floor(i/16)+1).padStart(3,'0')}.png`,row:Math.floor(i%16/4),column:i%4,seconds:window.from+i/window.fps}));
 const item={...window,filmSha256:sha256,order:'row-major',sampledTimeToleranceSeconds:.5/window.fps+1/30,tiles,reviewLimits:'Ordered sampled actual encoded frames, not a claim of continuous MP4 playback or audio audition.'};
 await writeFile(path.join(folder,'index.json'),JSON.stringify(item,null,2)+'\n');evidence.push(item);
}
await writeFile(path.join(directory,'temporal-review','index.json'),JSON.stringify({filmSha256:sha256,duration:report.duration,clips:report.clips.map(({id,start,end})=>({id,start,end})),windows:evidence},null,2)+'\n');
console.log(JSON.stringify({filmSha256:sha256,duration:report.duration,windows:windows.map(w=>w.id)}));
