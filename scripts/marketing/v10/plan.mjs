/** External Claude Opus 5.5 V10: an action-led social story, with truthful floor and agent identities. */
import * as accepted from '../v9/plan.mjs';
export const palette = { ...structuredClone(accepted.palette), actionEyebrowSize: 20, actionTitleSize: 32, actionSubtitleSize: 24 };
export const glassDesign = { ...structuredClone(accepted.glassDesign), placementsByScene: {}, enterSeconds: .25, exitSeconds: .2, textExitSeconds: .2, staggerSeconds: 0 };
const action = (id, frames, eyebrow, title, subtitle = '', extra = {}) => ({
  id, duration: frames / 30, sourceDuration: frames / 30, rawSourceDuration: frames / 30, kind: 'card', action: true,
  card: { eyebrow, title, subtitle, footer: '' },
  backgroundSource: `artifacts/marketing/v10/raw/${id}.mp4`,
  backgroundRanges: [{ sourceFrames: [0, frames], outputFrames: frames }],
  hudFile: `${id}-hud.mov`, glassMaskFile: `${id}-glass-mask.png`, backgroundFile: `${id}-bg.mp4`,
  ...extra,
});
const footage = (id, frames, extra = {}) => ({ id, duration: frames / 30, sourceDuration: frames / 30, rawSourceDuration: frames / 30, kind: 'footage', card: null, sourceFile: `artifacts/marketing/v10/raw/${id}.mp4`, ...extra });
export const sequence = [
  action('opener-floors',120,'HERDR OFFICE','Every machine is a floor.','Switch machines without leaving the office.', { evidence: 'One persistent explanation over three real views: large Studio, compact Cinder CI Build, Studio. Two native Floor presses; no fictitious third press.' }),
  footage('descent',144,{ navigationAlreadyRetimed: true, speedPolicy: 'Prepared real native descent at 1.8x, complete leveling and matched 10-frame Eye height handoff; do not retime again.' }),
  action('run-to-basalt',274,'STUDIO MAC','Agents at their desks.',"See who's working.",{ navigationAlreadyRetimed:true, animation:{ enterDelaySeconds:.6,enterSeconds:.25,endSeconds:7.8,exitSeconds:.25,textExitSeconds:.25,staggerSeconds:0 }, evidence:'Real occupied aisle, corner into another company lane and Basalt arrival. Prepared navigation at 1.8x, final arrival at 1x; do not retime again.' }),
  footage('basalt-open',30,{ evidence:'Click the actual red-haired Basalt agent at the exact accepted run endpoint. Drawer opens without moving the camera.' }),
  action('basalt-steer',300,'STUDIO MAC · BASALT LEDGER','Talk to any agent.','Watch its terminal. Steer it from the office.',{ evidence:'Same Basalt codex terminal at native 24px and 960px drawer. Actual instruction Check for duplicate IDs first. Result fully visible from local6.883 through10, 3.117 seconds; native UI at 1x.' }),
  action('basalt-star',60,'BOOKMARKS','Save it for later.','',{ evidence:'Same continuous Basalt shot and completed terminal; actual native star creates saved Main shortcut.' }),
  action('needs-input',90,'STUDIO MAC · NEEDS INPUT','Standing means it needs you.','Click to see what it needs.',{ evidence:'Standing Northstar human clicked at local1s to show its real question. Does not claim an answer was submitted.' }),
  action('search-release',120,'STUDIO MAC · SEARCH','Find an agent.','Search this floor by task.',{ cardBeats:[
    { at:0,eyebrow:'STUDIO MAC · SEARCH',title:'Find an agent.',subtitle:'Search this floor by task.' },
    { at:1.9,eyebrow:'STUDIO MAC · ORBIT STUDIO',title:'Check release notes',subtitle:'' },
  ], evidence:'Old terminal closed. 57 frames of actual release query/result press, then 63 frames settled Orbit agent. Arrival label changes exactly on real destination cut1.9; native search is floor scoped.' }),
  action('build-floor',90,'BUILD NODE · CINDER CI','Jump to another machine.','Its agents, its own floor.',{ animation:{enterDelaySeconds:1.1,enterSeconds:.25,endSeconds:3,exitSeconds:.2,textExitSeconds:.2,staggerSeconds:0}, evidence:'Actual Floor press, settled compact Cinder CI from1.0. Destination caption starts1.1, never on Studio. Native18m compact floor shows1company2departments4agents.' }),
  action('bookmark-return',153,'STUDIO MAC · BASALT LEDGER','One click back to your agent.','Right where you left it.',{ animation:{enterDelaySeconds:1.1,enterSeconds:.25,endSeconds:5.1,exitSeconds:.2,textExitSeconds:.2,staggerSeconds:0}, cardBeats:[
    {at:0,eyebrow:'STUDIO MAC · BASALT LEDGER',title:'One click back to your agent.',subtitle:'Right where you left it.'},
    {at:2,eyebrow:'STUDIO MAC · BASALT LEDGER',title:'One click back to your agent.',subtitle:'The Map shows every company on the floor.'},
    {at:2.9,eyebrow:'STUDIO MAC · BASALT LEDGER',title:'One click back to your agent.',subtitle:'Hover for the task and status.'},
  ], evidence:'Actual saved Main press on Cinder, direct motivated cut at.9 to SAME Studio Basalt hero/task/completed result. Large Studio18-company map opens2.0; native saved Basalt dot hover2.9 shows task/provider/Done.' }),
  action('outro',120,'HERDR OFFICE','Your agents, in 3D.','github.com/technologylab-ai/herdr-office',{ evidence:'Same returned Basalt front, completed terminal and native Studio map continue without another aerial cut.' }),
];
for (const scene of sequence) if (scene.kind === 'card') glassDesign.placementsByScene[scene.id] = [112,762,780,170];
export const chapterDissolves = [];
export const totalFrames = sequence.reduce((sum, scene) => sum + Math.round(scene.duration * 30), 0);
export const totalDuration = totalFrames / 30;
export const sourceDuration = totalDuration;
export const musicSourceStart = 15;
export const musicSourceEnd = musicSourceStart + totalDuration;
export const demoLayout = 'social';
export const floorInventory = { 'Studio Mac':{companies:18,departments:30,rows:6,agents:72,desks:78}, 'Build Node':{companies:1,departments:2,agents:4,company:'Cinder CI'} };
export const heroIdentity = { machine:'Studio Mac',company:'Basalt Ledger',provider:'codex',pane:'demo-w11:p1',task:'Reconcile nightly settlement files' };
export const cursor = structuredClone(accepted.cursor);
export const disclosure = { text:'Simulated demo · fictional data', implementation:'Root final assembly applies exactly one global overlay; never bake a duplicate into cards.', fontSize:20,lineHeight:24,fontWeight:500,fill:'#F8F9FA',background:'#101113',backgroundOpacity:.96,radius:8,paddingX:14,
  right:[1440,1008,440,40],left:[16,940,440,32],searchRight:[1440,928,440,32],
  actualStateModes:{'opener-floors':'right',descent:'right','run-to-basalt':'right','basalt-open':[{at:0,mode:'right'},{at:.3,mode:'left'}],'basalt-steer':'left','basalt-star':'left','needs-input':[{at:0,mode:'right'},{at:1,mode:'left'}],'search-release':[{at:0,mode:'searchRight'},{at:1.9,mode:'left'}],'build-floor':[{at:0,mode:'left'},{at:1,mode:'right'}],'bookmark-return':[{at:0,mode:'right'},{at:.9,mode:'left'}],outro:'left'},
  verification:'Gate mode changes on actual drawer visibility frames, not presumed polling delay. New sources hide old editorial disclosure. Right replacement covers old V5 disclosure on reused navigation; no two labels.',
};
export const navigationCue = { text:'Navigation sped up',scenes:['descent','run-to-basalt'],rect:[1536,966,344,36],fontSize:20,lineHeight:24,fontWeight:700,fill:'#F8F9FA',background:'#101113',backgroundOpacity:.96,radius:8,verification:'Above disclosure with6px gap and right of native footer; fail on overlap rather than silently relocate.' };
export const motionReviewContract = { reviewMethod:'Actual timestamped ordered final frames and critical 960x540 delivery frames; honest sampled temporal review, not claims of continuous movie or audio audition.',firstPersonStarts:8.8,terminalStarts:18.9333333333,requiredChecks:['Two native selector causes and distinct Cinder floor','Moving descent immediately after single opener','Occupied aisle/corner route preserved','Same Basalt pose through talk/terminal/star','Standing explanation concurrent with actual question click','Search old drawer closed and arrival identity changes at1.9','Cinder caption gated until1.1','Saved Main returns SAME Basalt result with nativeStudio map','Actual map hover full task/provider/Done readable','No duplicate disclosure or native UI overlap','Scope/body readable at960 delivery'] };
if (totalFrames !== 1501) throw new Error('V10 frame ledger changed.');
