import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveFloor, departmentDimensions } from './layout';
import type { HerdrSnapshot } from '../types';
const snapshot:HerdrSnapshot={version:'0.9.0',protocol:22,
  workspaces:[{workspace_id:'w1',label:'Company',number:1,active_tab_id:'w1:t1',agent_status:'idle',pane_count:2,tab_count:1,focused:false}],
  tabs:[{tab_id:'w1:t1',workspace_id:'w1',label:'Department',number:1,agent_status:'idle',pane_count:2,focused:false}],
  panes:['w1:p1','w1:p2'].map(pane_id=>({pane_id,workspace_id:'w1',tab_id:'w1:t1',terminal_id:pane_id,agent_status:'idle' as const,revision:1,focused:false})),
  agents:[{pane_id:'w1:p1',workspace_id:'w1',tab_id:'w1:t1',terminal_id:'w1:p1',agent_status:'idle',agent:'codex',revision:1,focused:false}],
  layouts:[{workspace_id:'w1',tab_id:'w1:t1',area:{x:3,y:4,width:100,height:40},panes:[
    {pane_id:'w1:p1',focused:false,rect:{x:3,y:4,width:25,height:40}},
    {pane_id:'w1:p2',focused:false,rect:{x:28,y:4,width:75,height:40}}],splits:[],zoomed:false,focused_pane_id:'w1:p1'}]};
test('physical pane zones preserve ratios and only detected agents become humans',()=>{
  const plan=deriveFloor(snapshot);
  assert.equal(plan.desks.length,2); assert.equal(plan.desks.filter(d=>d.agent).length,1);
  assert.equal(plan.desks[1].area.width/plan.desks[0].area.width,3);
  assert.equal(plan.desks[0].area.x+plan.desks[0].area.width,plan.desks[1].area.x);
  assert.ok(plan.desks[0].area.width>=4.4);
});
test('companies do not overlap and missing layouts still render real panes',()=>{
  const changed={...snapshot,layouts:[]};const p=deriveFloor(changed);
  assert.equal(p.desks.length,2);assert.ok(p.width>0&&p.depth>0);
  assert.equal(deriveFloor({...snapshot,workspaces:[],tabs:[],panes:[],agents:[],layouts:[]}).desks.length,0);
});
test('multi-row company packing keeps independent departments and companies disjoint',()=>{
  const workspaces=Array.from({length:8},(_,i)=>({...snapshot.workspaces[0],workspace_id:`w${i+1}`,number:i+1,active_tab_id:`w${i+1}:t1`}));
  const tabs=workspaces.flatMap(w=>[1,2].map(number=>({...snapshot.tabs[0],workspace_id:w.workspace_id,tab_id:`${w.workspace_id}:t${number}`,number})));
  const plan=deriveFloor({...snapshot,workspaces,tabs,panes:[],agents:[],layouts:[]});
  assert.equal(plan.companies.length,8);assert.equal(plan.departments.length,16);
  for(let i=0;i<plan.companies.length;i++)for(let j=i+1;j<plan.companies.length;j++){
    const a=plan.companies[i],b=plan.companies[j];
    assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.z+a.depth<=b.z||b.z+b.depth<=a.z,`${a.id} overlaps ${b.id}`);
  }
});
test('a zoomed pane layout does not hide neighbors',()=>{
  const p=deriveFloor({...snapshot,layouts:[{...snapshot.layouts[0],zoomed:true}]});
  assert.equal(p.desks.length,2);
});
test('invalid empty layout dimensions have a finite fallback',()=>{
  const d=departmentDimensions({...snapshot.layouts[0],area:{x:0,y:0,width:0,height:0}});
  assert.ok(Number.isFinite(d.width)&&d.width>0);
});

test('tiny footer pane does not inflate the whole room and shared edges still meet',()=>{
  const layout={...snapshot.layouts[0],area:{x:3,y:4,width:259,height:74},panes:[
    {pane_id:'w1:p1',focused:false,rect:{x:3,y:4,width:160,height:67}},
    {pane_id:'w1:p2',focused:false,rect:{x:3,y:71,width:160,height:7}},
    {pane_id:'w1:p3',focused:false,rect:{x:163,y:4,width:99,height:37}},
    {pane_id:'w1:p4',focused:false,rect:{x:163,y:41,width:99,height:37}},
  ]};
  const dims=departmentDimensions(layout);
  assert.ok(dims.depth<14,'Expected compact department, got '+dims.depth+'m');
  const panes=layout.panes.map(p=>({...snapshot.panes[0],pane_id:p.pane_id}));
  const plan=deriveFloor({...snapshot,panes,layouts:[layout]});
  const [top,bottom,rightTop,rightBottom]=plan.desks;
  assert.ok(bottom.area.depth>=4.6-1e-10);
  assert.ok(Math.abs(top.area.z+top.area.depth-bottom.area.z)<1e-10);
  assert.ok(Math.abs(rightTop.area.z+rightTop.area.depth-rightBottom.area.z)<1e-10);
  assert.ok(Math.abs(bottom.area.z+bottom.area.depth-rightBottom.area.z-rightBottom.area.depth)<1e-10);
  assert.ok(Math.abs(top.area.x+top.area.width-rightTop.area.x)<1e-10);
});
