import type { HerdrSnapshot, HerdrLayout, HerdrPane, HerdrAgent } from '../types';

export interface Department {
  id: string; workspaceId: string; name: string;
  x: number; z: number; width: number; depth: number; color: string;
}
export interface Company {
  id: string; name: string; x: number; z: number; width: number; depth: number;
  departments: Department[]; color: string;
}
export interface Desk {
  pane: HerdrPane; agent?: HerdrAgent; workspaceId: string; tabId: string;
  x: number; z: number; area: {x:number;z:number;width:number;depth:number};
}
export interface FloorPlan {
  companies: Company[]; departments: Department[]; desks: Desk[];
  width: number; depth: number; spawn: {x:number;z:number};
}
const colors = ['#829f8c','#bca27c','#7a98a5','#b3918e','#a2a378','#8f8faf'];

/** Preserve cell proportions for ordinary layouts. When a tiny terminal strip
 * would expand a whole room, stretch only the intervals needed for a desk.
 * Shared terminal edges still map to shared physical edges, preserving tiling. */
function physicalAxis(size:number, spans:{start:number;length:number}[], base:number, minimum:number, roomyLimit:number){
  const positive=spans.filter(s=>s.length>0&&Number.isFinite(s.start)&&Number.isFinite(s.length));
  const scale=Math.max(base/size,minimum/Math.min(...positive.map(s=>s.length)));
  if(size*scale<=roomyLimit)return {length:size*scale,scale,project:(cell:number)=>cell*scale};
  const clamp=(cell:number)=>Math.max(0,Math.min(size,cell));
  const edges=[...new Set([0,size,...positive.flatMap(s=>[clamp(s.start),clamp(s.start+s.length)])])].sort((a,b)=>a-b);
  const lengths=edges.slice(1).map((end,i)=>(end-edges[i])*base/size);
  // Grow the narrowest panes first. Later growth cannot undo their minimums.
  for(const span of [...positive].sort((a,b)=>a.length-b.length)){
    const from=edges.indexOf(clamp(span.start)),to=edges.indexOf(clamp(span.start+span.length));
    if(from===to)continue;
    const current=lengths.slice(from,to).reduce((a,b)=>a+b,0),deficit=minimum-current;
    if(deficit>0)for(let i=from;i<to;i++)lengths[i]+=deficit*(edges[i+1]-edges[i])/(edges[to]-edges[from]);
  }
  const mapped=[0];for(const length of lengths)mapped.push(mapped.at(-1)!+length);
  const project=(cell:number)=>{
    const value=clamp(cell);let i=edges.findIndex((end,index)=>index>0&&value<=end)-1;
    if(i<0)i=edges.length-2;
    return mapped[i]+(value-edges[i])/(edges[i+1]-edges[i])*lengths[i];
  };
  return {length:mapped.at(-1)!,scale:mapped.at(-1)!/size,project};
}

export function departmentDimensions(layout?: HerdrLayout) {
  if (!layout || !layout.panes.length || layout.area.width <= 0 || layout.area.height <= 0)
    return {width:10,depth:8,scaleX:1,scaleZ:1,projectX:(n:number)=>n,projectZ:(n:number)=>n};
  const x=physicalAxis(layout.area.width,layout.panes.map(p=>({start:p.rect.x-layout.area.x,length:p.rect.width})),10,4.4,32);
  const z=physicalAxis(layout.area.height,layout.panes.map(p=>({start:p.rect.y-layout.area.y,length:p.rect.height})),8,4.6,24);
  return {width:x.length,depth:z.length,scaleX:x.scale,scaleZ:z.scale,projectX:x.project,projectZ:z.project};
}

export function deriveFloor(snapshot: HerdrSnapshot): FloorPlan {
  const sorted=[...snapshot.workspaces].sort((a,b)=>a.number-b.number);
  const companies:Company[]=sorted.map((w,index)=>{
    const tabs=snapshot.tabs.filter(t=>t.workspace_id===w.workspace_id).sort((a,b)=>a.number-b.number);
    let offset=0;
    const departments=tabs.map(t=>{
      const size=departmentDimensions(snapshot.layouts.find(l=>l.tab_id===t.tab_id));
      const d:Department={id:t.tab_id,workspaceId:w.workspace_id,name:t.label||`Department ${t.number}`,
        x:offset,z:0,width:size.width,depth:size.depth,color:colors[index%colors.length]};
      offset+=size.width+1.6; return d;
    });
    return {id:w.workspace_id,name:w.label||`Company ${w.number}`,x:0,z:0,
      width:Math.max(10,offset-1.6)+2,depth:Math.max(8,...departments.map(d=>d.depth))+5,
      departments,color:colors[index%colors.length]};
  });
  const columns=Math.min(3,Math.max(1,companies.length));
  const colWidths=Array.from({length:columns},(_,col)=>Math.max(18,...companies.filter((_,i)=>i%columns===col).map(c=>c.width)));
  const width=colWidths.reduce((a,b)=>a+b,0)+(columns+1)*5;
  let rowZ=14;
  for(let start=0;start<companies.length;start+=columns){
    let colX=-width/2+5;
    const row=companies.slice(start,start+columns);
    const rowDepth=Math.max(...row.map(c=>c.depth));
    row.forEach((c,col)=>{
      c.x=colX; c.z=rowZ;
      c.departments.forEach(d=>{d.x+=c.x+1;d.z+=c.z+4;});
      colX+=colWidths[col]+5;
    });
    rowZ+=rowDepth+5;
  }
  const desks:Desk[]=[];
  const agentByPane=new Map(snapshot.agents.map(a=>[a.pane_id,a]));
  const paneById=new Map(snapshot.panes.map(p=>[p.pane_id,p]));
  const departments=companies.flatMap(c=>c.departments);
  for(const department of departments){
    const layout=snapshot.layouts.find(l=>l.tab_id===department.id);
    const size=departmentDimensions(layout);
    if(layout && layout.area.width>0 && layout.area.height>0){
      for(const p of layout.panes){
        const pane=paneById.get(p.pane_id); if(!pane)continue;
        const x=department.x+size.projectX(p.rect.x-layout.area.x);
        const z=department.z+size.projectZ(p.rect.y-layout.area.y);
        const area={x,z,width:size.projectX(p.rect.x-layout.area.x+p.rect.width)-(x-department.x),
          depth:size.projectZ(p.rect.y-layout.area.y+p.rect.height)-(z-department.z)};
        desks.push({pane,agent:agentByPane.get(p.pane_id),workspaceId:department.workspaceId,tabId:department.id,
          x:x+area.width/2,z:z+Math.min(area.depth/2,3),area});
      }
    } else {
      const panes=snapshot.panes.filter(p=>p.tab_id===department.id);
      panes.forEach((pane,i)=>desks.push({pane,agent:agentByPane.get(pane.pane_id),
        workspaceId:department.workspaceId,tabId:department.id,
        x:department.x+department.width*(i+.5)/Math.max(1,panes.length),z:department.z+3,
        area:{x:department.x+department.width*i/Math.max(1,panes.length),z:department.z,
          width:department.width/Math.max(1,panes.length),depth:department.depth}}));
    }
  }
  return {companies,departments,desks,width,depth:rowZ+4,spawn:{x:0,z:7}};
}
