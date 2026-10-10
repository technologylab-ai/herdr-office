import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import type { SceneHandle, SceneProps, AgentStatus } from '../types';
import { deriveFloor, type FloorPlan, type Desk } from './layout';
import { avatarAppearance, agentPose, allocateAvatarStyles, avatarIdentityKey, type AvatarStyle } from './appearance';
import { agentIndicator } from './agentIndicators';
import { agentTaskLabel, agentType } from './taskLabel';
import { createAgentBadge, createDepartmentBoard, departmentScheme } from './departmentArt';
import { WALK_SPEED, RUN_SPEED, canStandAt, moveOnFloor, wheelTravel } from './navigation';
import { gazePane, paneAlongRay } from './targeting';
import { createRenderLoop } from './renderLoop';
import { createWallPlaque, DEPARTMENT_WALL_THICKNESS } from './signage';

// Matches the UI chrome so status reads the same in the drawer, directory and office.
const statusColors:Record<AgentStatus,string>={working:'#ebb45e',idle:'#cfc6ad',blocked:'#ee6c55',done:'#92c78c',unknown:'#7f8d87'};
const lightRendering=import.meta.env.VITE_OFFICE_RENDER_QUALITY==='low';
const serif="'Iowan Old Style',Charter,'Bitstream Charter',Georgia,serif",mono="ui-monospace,'SF Mono',Menlo,monospace";
const kitNames=['desk','chair','person-seated','person-standing','person-seated-1','person-standing-1','person-seated-2','person-standing-2','person-seated-3','person-standing-3','plant','coffee-station','water-cooler','bookshelf','sofa','floor-lamp','meeting-table','wall-clock'] as const;
type Kit=Record<typeof kitNames[number],THREE.Group>;
let kitPromise:Promise<Kit>|undefined;
function loadKit(){
  return kitPromise??=Promise.all(kitNames.map(async name=>[name,(await new GLTFLoader().loadAsync(`/models/${name}.glb`)).scene] as const))
    .then(items=>Object.fromEntries(items) as Kit).catch(error=>{kitPromise=undefined;throw error;});
}
function hash(s:string){let h=0;for(const c of s)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;return h;}
function woodTexture(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
  const ctx=canvas.getContext('2d')!;
  const tones=['#b88b5e','#bc9269','#ae8057','#c09a72','#b78f69'];
  for(let row=0;row<24;row++){
    const y=row*1024/24;ctx.fillStyle=tones[row%tones.length];ctx.fillRect(0,y,1024,44);
    for(let i=0;i<8;i++){
      ctx.strokeStyle='rgba(74,43,22,.06)';ctx.lineWidth=.7;ctx.beginPath();
      ctx.moveTo(0,y+4+i*4.7);ctx.bezierCurveTo(250,y+5+i*4.7,780,y+2+i*4.7,1024,y+4+i*4.7);ctx.stroke();
    }
    ctx.fillStyle='rgba(70,48,30,.19)';ctx.fillRect(0,y,1024,1);
    for(let x=(row%3)*120;x<1024;x+=340)ctx.fillRect(x,y,1,43);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;return texture;
}
function canvasTexture(text:string,subtitle='',color='#c4d5bd',width=768,height=192){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#182820';ctx.fillRect(0,0,width,height);
  ctx.fillStyle=color;ctx.fillRect(0,0,7,height);ctx.font=`600 46px ${serif}`;ctx.textBaseline='middle';
  let title=text;while(ctx.measureText(title).width>width-64&&title.length>1)title=title.slice(0,-2)+'…';
  ctx.fillStyle='#faf5ea';ctx.fillText(title,30,subtitle?height*.40:height*.5);ctx.fillStyle=color;ctx.font=`22px ${mono}`;
  if(subtitle)ctx.fillText(subtitle.slice(0,58),30,height*.74);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function artTexture(canvas:HTMLCanvasElement){
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
type Box={x:number;z:number;w:number;d:number};
interface Human {seated:THREE.Group;standing:THREE.Group;desk:Desk;avatarStyle:AvatarStyle;phase:number;arms:{object:THREE.Object3D;base:number}[];head?:THREE.Object3D;ring:THREE.Mesh;badge:THREE.Sprite;status?:string;indicatorKey?:string;materials:THREE.Material[]}
interface Runtime {
  controls:PointerLockControls;camera:THREE.PerspectiveCamera;plan:FloorPlan;
  teleport(workspaceId:string,tabId?:string):void;focusPane(paneId:string):void;
  setViewMode(mode:'overview'|'walk'):void;frameRow():void;raiseView(delta:number):void;
  updateScreen(paneId:string,text:string):void;invalidate():void;dispose():void;
}

const OfficeScene=forwardRef<SceneHandle,SceneProps>(function OfficeScene(props,ref){
  const host=useRef<HTMLDivElement>(null),hint=useRef<HTMLDivElement>(null);
  const runtime=useRef<Runtime|null>(null),latest=useRef(props);latest.current=props;
  const savedCamera=useRef<{id:string;position:THREE.Vector3;quaternion:THREE.Quaternion}|null>(null);
  const avatarHistory=useRef(new Map<string,AvatarStyle>());
  const topology=JSON.stringify(props.connection?.snapshot&&{
    id:props.connection.id,
    workspaces:props.connection.snapshot.workspaces.map(w=>[w.workspace_id,w.label,w.number]),
    tabs:props.connection.snapshot.tabs.map(t=>[t.tab_id,t.workspace_id,t.label,t.number]),
    layouts:props.connection.snapshot.layouts.map(l=>[l.tab_id,l.area,l.panes.map(p=>[p.pane_id,p.rect])]),
    panes:props.connection.snapshot.panes.map(p=>[p.pane_id,p.tab_id,p.terminal_id]),
    agents:props.connection.snapshot.agents.map(a=>[a.pane_id,a.agent]),
  });
  useImperativeHandle(ref,()=>({
    enter(){runtime.current?.controls.lock();},
    exit(){runtime.current?.controls.unlock();},
    teleport(w,t){runtime.current?.teleport(w,t);},
    focusPane(p){runtime.current?.focusPane(p);},
    frameRow(){runtime.current?.frameRow();},
    raiseView(delta){runtime.current?.raiseView(delta);},
  }),[]);

  useEffect(()=>{
    const el=host.current,connection=latest.current.connection;if(!el||!connection?.snapshot)return;
    let cancelled=false;
    const previous=savedCamera.current?.id===connection.id?savedCamera.current:null;
    runtime.current?.dispose();runtime.current=null;
    async function build(){
      try{
        const kit=await loadKit();if(cancelled||!el||!connection?.snapshot)return;
        const plan=deriveFloor(connection.snapshot);
        const avatarIdentity=(desk:Desk)=>({connectionId:connection.id,paneId:desk.pane.pane_id,terminalId:desk.pane.terminal_id});
        const avatarStyles=allocateAvatarStyles(plan.desks.filter(d=>d.agent).map(avatarIdentity),avatarHistory.current);
        for(const [identity,style] of avatarStyles)avatarHistory.current.set(identity,style);
        const scene=new THREE.Scene();scene.background=new THREE.Color('#172b46');
        scene.fog=new THREE.Fog('#526269',70,260);
        const renderer=new THREE.WebGLRenderer({antialias:!lightRendering,powerPreference:'high-performance'});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio,lightRendering ? .65 : 1.75));renderer.setSize(el.clientWidth,el.clientHeight);
        renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=!lightRendering;renderer.shadowMap.type=THREE.PCFShadowMap;
        renderer.domElement.setAttribute('aria-label','First-person Herdr office. WASD to move, Shift to run, scroll to approach or retreat, drag to look, E to interact with a desk.');
        renderer.domElement.tabIndex=0;el.appendChild(renderer.domElement);
        let overview=latest.current.viewMode==='overview',overviewRowZ:number|null=null;
        const camera=new THREE.PerspectiveCamera(68,el.clientWidth/el.clientHeight,.07,350);
        const firstDesk=plan.desks.find(d=>d.agent);
        const arrival=firstDesk?plan.departments.find(d=>d.id===firstDesk.tabId):undefined;
        camera.position.set(previous?.position.x??(arrival?arrival.x+arrival.width/2:plan.spawn.x),overview?(previous?.position.y??18):1.68,
          previous?.position.z??(arrival?arrival.z+.65:plan.spawn.z));
        if(previous)camera.quaternion.copy(previous.quaternion);
        else camera.lookAt(firstDesk?.x??camera.position.x,1.45,firstDesk?.z??camera.position.z+10);
        const controls=new PointerLockControls(camera,renderer.domElement);
        const ambient=new THREE.HemisphereLight('#e5edf1','#b3a084',2.0);scene.add(ambient);
        const sun=new THREE.DirectionalLight('#ffe7c1',2.5);sun.position.set(-25,34,-14);sun.castShadow=!lightRendering;
        sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;
        sun.shadow.camera.top=90;sun.shadow.camera.bottom=-40;sun.shadow.camera.far=140;
        sun.shadow.bias=-.0005;sun.shadow.normalBias=.035;scene.add(sun);scene.add(sun.target);
        sun.target.position.set(0,0,35);
        const collisions:Box[]=[],clickables:THREE.Object3D[]=[],textures=new Set<THREE.Texture>(),ownedMaterials:THREE.Material[]=[];
        const materialCache=new Map<string,THREE.MeshStandardMaterial>();
        const mat=(color:string,roughness=.8)=>{
          const k=color+roughness;if(!materialCache.has(k)){
            const m=new THREE.MeshStandardMaterial({color,roughness});materialCache.set(k,m);ownedMaterials.push(m);
          }return materialCache.get(k)!;
        };
        function cube(x:number,y:number,z:number,w:number,h:number,d:number,color:string,collide=false){
          const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));mesh.position.set(x,y,z);
          mesh.castShadow=h>.2;mesh.receiveShadow=true;scene.add(mesh);
          if(collide)collisions.push({x,z,w,d});return mesh;
        }
        function sign(text:string,sub:string,x:number,y:number,z:number,width=3,color?:string){
          const texture=artTexture(createAgentBadge(text,sub,color||'#c4d5bd'));textures.add(texture);
          const m=new THREE.SpriteMaterial({map:texture,depthTest:true,depthWrite:false,transparent:true});ownedMaterials.push(m);
          const obj=new THREE.Sprite(m);obj.position.set(x,y,z);obj.scale.set(width,width*224/768,1);scene.add(obj);return obj;
        }
        function asset(name:typeof kitNames[number],x:number,z:number,rotation=0){
          const group=kit[name].clone(true);group.position.set(x,0,z);group.rotation.y=rotation;
          group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(group);return group;
        }
        function parquetUV(mesh:THREE.Mesh){
          const position=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');
          for(let i=0;i<position.count;i++)uv.setXY(i,
            (position.getX(i)+mesh.position.x+plan.width/2)/plan.width,
            (position.getZ(i)+mesh.position.z)/plan.depth);
          uv.needsUpdate=true;
        }
        // A glass-roofed atrium and original ash parquet throughout the office.
        const parquet=woodTexture();textures.add(parquet);parquet.repeat.set(plan.width/8,plan.depth/8);
        const floor=cube(0,-.12,plan.depth/2,plan.width+.6,.24,plan.depth+2,'#ffffff');
        const floorMaterial=new THREE.MeshStandardMaterial({map:parquet,roughness:.75});ownedMaterials.push(floorMaterial);floor.material=floorMaterial;parquetUV(floor);
        const roofMaterial=new THREE.MeshPhysicalMaterial({color:'#8ba9b7',transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false});
        ownedMaterials.push(roofMaterial);const roof=new THREE.Mesh(new THREE.PlaneGeometry(plan.width,plan.depth),roofMaterial);
        roof.rotation.x=Math.PI/2;roof.position.set(0,4.8,plan.depth/2);scene.add(roof);
        for(let z=3;z<plan.depth;z+=8){
          cube(0,4.66,z,plan.width,.12,.10,'#354c50');
        }
        for(const side of [-1,1]){
          for(let z=4;z<plan.depth;z+=7){
            cube(side*(plan.width/2-.2),2.3,z,.18,4.6,.18,'#354c50',true);
            const glass=new THREE.Mesh(new THREE.PlaneGeometry(7,4.4),new THREE.MeshPhysicalMaterial({
              color:'#afd2c8',transparent:true,opacity:.18,roughness:.2,side:THREE.DoubleSide,depthWrite:false}));
            ownedMaterials.push(glass.material);glass.position.set(side*plan.width/2,2.3,z);glass.rotation.y=Math.PI/2;scene.add(glass);
            // An abstract city outside, deliberately no fictional people.
            cube(side*(plan.width/2+10+hash(String(z))%8),5,z,5,10+(z%5),5,'#2d4054');
          }
          cube(side*plan.width/2,.4,plan.depth/2,.14,.8,plan.depth,'#59686b',true);
        }
        cube(0,2.3,plan.depth,plan.width,4.6,.18,'#dfdfce',true);
        // Reception, a coffee bar, drinking water, and soft seating.
        cube(-7,.55,4,3.8,1.1,.8,'#6a7e65',true);
        cube(-7,1.12,4,4,.08,.93,'#bd936b');
        sign('technologylab','A place for your work',-7,2.15,4,4.2);
        asset('plant',-9.7,4);asset('plant',-4.4,4);
        asset('coffee-station',7,5);asset('water-cooler',9,5);
        sign('THE COMMONS','Coffee · conversation · a little space',7,2.65,5,4);
        for(let i=0;i<2;i++){
          const x=4+i*2.8;asset('sofa',x,9);collisions.push({x,z:9,w:2.05,d:.85});
          cube(x,.3,7.8,1.1,.06,.65,'#bda07a',true);
        }
        asset('floor-lamp',9.7,9.2);asset('bookshelf',-11,4,Math.PI/2);
        asset('meeting-table',-7,9);collisions.push({x:-7,z:9,w:2.4,d:1.1});
        for(const side of [-1,1])for(const x of [-7.6,-6.4])asset('chair',x,9+side*.9,side===1?0:Math.PI);
        const humans:Human[]=[],monitors=new Map<string,THREE.Mesh>(),screenText=new Map<string,string>(),desksById=new Map(plan.desks.map(d=>[d.pane.pane_id,d]));
        const companySigns:{sprite:THREE.Sprite;rowZ:number}[]=[];
        for(const company of plan.companies){
          cube(company.x+company.width/2,.009,company.z+company.depth/2,company.width,.025,company.depth,'#b09c81');
          cube(company.x+company.width/2,.025,company.z+1.35,company.width-1,.025,1.7,company.color);
          const companySign=sign(company.name,`${company.departments.length} department${company.departments.length===1?'':'s'}`,company.x+company.width/2,2.15,company.z+1.4,2.8,company.color);
          companySigns.push({sprite:companySign,rowZ:company.z});
          asset('plant',company.x+.45,company.z+1.1);
          asset('plant',company.x+company.width-.45,company.z+1.1);
          for(const dept of company.departments){
            const scheme=departmentScheme(connection.id+'/'+dept.id);
            const deck=cube(dept.x+dept.width/2,.035,dept.z+dept.depth/2,dept.width,.035,dept.depth,'#ffffff');deck.material=floorMaterial;parquetUV(deck);
            sign(dept.name,'DEPARTMENT',dept.x+dept.width/2,2.8,dept.z+.45,Math.min(2.8,dept.width-.5),dept.color);
            // Low acoustic partitions retain an open office and leave a front circulation route.
            for(const edge of [dept.x-.15,dept.x+dept.width+.15]){
              cube(edge,.30,dept.z+dept.depth/2,.10,.60,dept.depth,'#68787a',true);
              const gm=new THREE.MeshPhysicalMaterial({color:'#c5dcdd',transparent:true,opacity:.13,roughness:.25,depthWrite:false,side:THREE.DoubleSide});ownedMaterials.push(gm);
              const glass=new THREE.Mesh(new THREE.BoxGeometry(.055,.95,dept.depth),gm);glass.position.set(edge,1.1,dept.z+dept.depth/2);scene.add(glass);
              cube(edge,1.6,dept.z+dept.depth/2,.07,.07,dept.depth,'#b3bab2');
              for(let offset=0;offset<dept.depth;offset+=4)cube(edge,.98,dept.z+offset,.07,1.3,.07,'#b3bab2');
            }
            cube(dept.x+dept.width/2,1.55,dept.z+dept.depth,dept.width+.25,3.1,DEPARTMENT_WALL_THICKNESS,scheme.wall,true);
            for(const edge of [dept.x+.5,dept.x+dept.width-1.1]){
              for(let slat=0;slat<5;slat++)cube(edge+slat*.13,1.65,dept.z+dept.depth-.13,.065,2.7,.09,scheme.slat);
            }
            const boardTexture=artTexture(createDepartmentBoard(company.name,dept.name,plan.desks.filter(d=>d.tabId===dept.id&&d.agent).length,connection.id+'/'+dept.id));
            textures.add(boardTexture);const bm=new THREE.MeshBasicMaterial({map:boardTexture});ownedMaterials.push(bm);
            const boardWidth=Math.min(dept.width-2,4.5);
            const board=new THREE.Mesh(new THREE.PlaneGeometry(boardWidth,boardWidth/3),bm);
            board.position.set(dept.x+dept.width/2,1.60,dept.z+dept.depth-.095);board.rotation.y=Math.PI;scene.add(board);
            // Independent wall-aligned capsules identify the room on both faces.
            // A billboard here rotates through the wall and gets sliced by it.
            const plaqueTexture=artTexture(createAgentBadge(company.name,dept.name,scheme.accent));textures.add(plaqueTexture);
            for(const face of ['interior','exterior'] as const){
              const plaque=createWallPlaque(plaqueTexture,Math.min(face==='interior'?3.2:5.4,dept.width-(face==='interior'?2:1)),
                {x:dept.x+dept.width/2,y:face==='interior'?2.70:2.30,z:dept.z+dept.depth},face);
              ownedMaterials.push(plaque.material);scene.add(plaque);
            }
            const shelf=asset('bookshelf',dept.x+dept.width-.9,dept.z+dept.depth-.28);
            shelf.rotation.y=Math.PI;collisions.push({x:dept.x+dept.width-.9,z:dept.z+dept.depth-.4,w:1.25,d:.45});
            const clock=asset('wall-clock',dept.x+1.3,dept.z+dept.depth-.12);clock.position.y=2.3;clock.rotation.y=Math.PI;
            asset('plant',dept.x+.5,dept.z+dept.depth-.6);
            cube(dept.x+dept.width/2,4.55,dept.z+2.5,.018,.4,.018,'#515b51');
            const pendant=new THREE.Mesh(new THREE.CylinderGeometry(.32,.52,.21,16),mat('#dcd4b9'));
            pendant.position.set(dept.x+dept.width/2,4.23,dept.z+2.5);scene.add(pendant);
            const lightPanel=new THREE.Mesh(new THREE.CircleGeometry(.38,16),new THREE.MeshBasicMaterial({color:'#fff2cd'}));
            ownedMaterials.push(lightPanel.material);lightPanel.position.copy(pendant.position);lightPanel.position.y-=.12;
            lightPanel.rotation.x=Math.PI/2;scene.add(lightPanel);
          }
        }
        for(const desk of plan.desks){
          // Pane zones accurately mirror the split tree; every pane has exactly one terminal desk.
          // Thin perimeter inlays outline the pane rectangles without painting over the parquet.
          cube(desk.area.x+desk.area.width/2,.06,desk.area.z+.05,desk.area.width-.1,.015,.025,'#aa8b66');
          cube(desk.area.x+.05,.06,desk.area.z+desk.area.depth/2,.025,.015,desk.area.depth-.1,'#aa8b66');
          const computer=asset('desk',desk.x,desk.z);const chair=asset('chair',desk.x,desk.z+.82);
          computer.userData.paneId=desk.pane.pane_id;chair.userData.paneId=desk.pane.pane_id;
          clickables.push(computer,chair);collisions.push({x:desk.x,z:desk.z+.4,w:2,d:1.9});
          computer.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='Screen'){
            o.visible=false;
            const texture=canvasTexture(desk.agent?.agent||'Terminal',desk.pane.pane_id,'#bbd6c3',768,432);textures.add(texture);
            const material=new THREE.MeshBasicMaterial({map:texture});ownedMaterials.push(material);
            const display=new THREE.Mesh(new THREE.PlaneGeometry(.735,.411),material);
            display.position.set(desk.x,1.22,desk.z-.169);display.userData.paneId=desk.pane.pane_id;
            scene.add(display);clickables.push(display);monitors.set(desk.pane.pane_id,display);
          }});
          if(!desk.agent)continue;
          const peers=plan.desks.filter(d=>d.tabId===desk.tabId&&d.agent).sort((a,b)=>a.pane.pane_id.localeCompare(b.pane.pane_id));
          const slot=peers.findIndex(d=>d.pane.pane_id===desk.pane.pane_id);
          const avatarStyle=avatarStyles.get(avatarIdentityKey(avatarIdentity(desk)))!;
          const appearance={...avatarAppearance(desk.agent.pane_id+desk.agent.agent,slot,desk.tabId),style:avatarStyle};
          const seatedName=(appearance.style?`person-seated-${appearance.style}`:'person-seated') as typeof kitNames[number];
          const standingName=(appearance.style?`person-standing-${appearance.style}`:'person-standing') as typeof kitNames[number];
          const seated=asset(seatedName,desk.x,desk.z+.82),standing=asset(standingName,desk.x+1.2,desk.z+.65);
          const seed=hash(desk.agent.pane_id+desk.agent.agent),materials:THREE.Material[]=[];
          for(const human of [seated,standing]){
            human.userData.paneId=desk.pane.pane_id;clickables.push(human);
            human.traverse(o=>{if(o instanceof THREE.Mesh){
              const recolor=(original:THREE.Material)=>{
                const m=original.clone() as THREE.MeshStandardMaterial;materials.push(m);
                if(m.name==='Skin')m.color.set(appearance.skin);
                if(m.name==='Shirt')m.color.set(appearance.shirt);
                if(m.name==='Hair')m.color.set(appearance.hair);
                return m;
              };
              o.material=Array.isArray(o.material)?o.material.map(recolor):recolor(o.material);
            }});
          }
          const ring=new THREE.Mesh(new THREE.RingGeometry(.42,.48,32),new THREE.MeshBasicMaterial({color:statusColors[desk.agent.agent_status],side:THREE.DoubleSide,transparent:true,opacity:.7}));
          ownedMaterials.push(ring.material);ring.rotation.x=-Math.PI/2;ring.position.set(desk.x,.092,desk.z+.82);scene.add(ring);
          const badge=sign(desk.agent.name||desk.agent.display_agent||desk.agent.agent||'Agent',desk.agent.agent_status,desk.x,2.12,desk.z+.82,1.20);
          const arms:{object:THREE.Object3D;base:number}[]=[];let head:THREE.Object3D|undefined;
          seated.traverse(o=>{if(o.name.startsWith('Forearm'))arms.push({object:o,base:o.rotation.x});if(o.name.startsWith('Head'))head=o;});
          humans.push({seated,standing,desk,avatarStyle,phase:seed%50,arms,head,ring,badge,materials});
        }
        renderer.domElement.dataset.avatarStyles=JSON.stringify(humans.map(h=>({paneId:h.desk.pane.pane_id,style:h.avatarStyle})));
        // Selection ring and genuine terminal content on the chosen monitor.
        const selector=new THREE.Mesh(new THREE.RingGeometry(1.2,1.25,48),new THREE.MeshBasicMaterial({color:'#efcea2',transparent:true,opacity:.85,side:THREE.DoubleSide}));
        selector.rotation.x=-Math.PI/2;selector.position.y=.10;selector.visible=false;scene.add(selector);ownedMaterials.push(selector.material);
        // A changed split layout may put a saved viewpoint inside a new wall.
        // Restore only walkable positions; otherwise arrive through an entrance.
        if(!canOccupy(camera.position.x,camera.position.z)){
          const entrances=plan.departments.map(d=>({x:d.x+d.width/2,z:d.z+.65}));
          const safe=entrances.find(p=>canOccupy(p.x,p.z))??plan.spawn;
          camera.position.set(safe.x,1.68,safe.z);camera.lookAt(safe.x,1.45,safe.z+7);
        }
        const keys=new Set<string>(),raycaster=new THREE.Raycaster();let lastLocation='',gazeTarget:Desk|undefined;
        let renderLoop:ReturnType<typeof createRenderLoop>|undefined;
        const shell=el.closest<HTMLElement>('.app');let lastRenderMode='';
        function publishRenderMode(mode:'idle'|'interactive'){
          if(mode===lastRenderMode)return;
          lastRenderMode=mode;if(shell)shell.dataset.renderMode=mode;
        }
        const gazePosition=new THREE.Vector3(Infinity,Infinity,Infinity),gazeRotation=new THREE.Quaternion();
        let gazeTime=-Infinity;
        let cachedAgents=connection.snapshot.agents,agentsByPane=new Map(cachedAgents.map(a=>[a.pane_id,a]));
        let badgeTime=0,badgeMain=latest.current.mainAgent;
        let wheelRemaining=0,walkSpeed=0,viewTime=-Infinity,lastView='',simulationSeconds=0,renderFrames=0;
        const stopMovement=()=>{keys.clear();wheelRemaining=0;walkSpeed=0;renderLoop?.invalidate();};
        let dragging=false,dragged=false,lastPointer={x:0,y:0},pointerStart={x:0,y:0};
        const moveVector=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3();
        const onLock=()=>{latest.current.onLockChange(true);renderLoop?.wake();},onUnlock=()=>{stopMovement();latest.current.onLockChange(false);};
        const onLook=()=>renderLoop?.wake();
        // Only reachable after onReady, so the UI shows it as a dismissable toast rather than a fatal error.
        const onLockError=()=>latest.current.onError('Mouse capture was denied. You can still drag to look and use the directory.');
        document.addEventListener('pointerlockerror',onLockError);
        controls.addEventListener('lock',onLock);controls.addEventListener('unlock',onUnlock);
        controls.addEventListener('change',onLook);
        function selectDesk(desk:Desk){stopMovement();controls.unlock();latest.current.onSelectPane(desk.pane.pane_id);}
        function refreshGaze(force=false,now=performance.now()){
          if(!force&&(now-gazeTime<100||
            (now-gazeTime<500&&camera.position.equals(gazePosition)&&camera.quaternion.equals(gazeRotation))))return;
          gazeTime=now;gazePosition.copy(camera.position);gazeRotation.copy(camera.quaternion);
          const paneId=gazePane(camera,clickables,raycaster);
          gazeTarget=paneId?desksById.get(paneId):undefined;
        }
        function onKeyDown(e:KeyboardEvent){
          if(e.metaKey||e.ctrlKey||e.altKey||document.querySelector('dialog[open]')||(e.target as HTMLElement)?.closest('.ui,input,textarea,button,select,[contenteditable],[role=button],[role=separator]'))return;
          if(e.code==='KeyE'){
            refreshGaze(true);
            if(gazeTarget){e.preventDefault();selectDesk(gazeTarget);}
            renderLoop?.invalidate();
            return;
          }
          if(e.code==='Escape'){controls.unlock();stopMovement();return;}
          if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){
            e.preventDefault();keys.add(e.code);renderLoop?.wake();
          }
        }
        const onKeyUp=(e:KeyboardEvent)=>keys.delete(e.code);
        const onBlur=()=>{stopMovement();dragging=false;};
        const onVisibility=()=>{if(document.hidden){onBlur();publishRenderMode('idle');}renderLoop?.visibilityChanged();};
        const onFocusIn=(e:FocusEvent)=>{if(e.target!==renderer.domElement)stopMovement();};
        function onWheel(e:WheelEvent){
          if(e.ctrlKey||e.metaKey||document.querySelector('dialog[open]'))return;
          e.preventDefault();
          wheelRemaining=THREE.MathUtils.clamp(wheelRemaining+wheelTravel(e.deltaY,e.deltaMode,el!.clientHeight,e.shiftKey),-12,12);
          renderLoop?.wake();
        }
        function onPointerDown(e:PointerEvent){if(!controls.isLocked&&e.button===0){dragging=true;dragged=false;pointerStart=lastPointer={x:e.clientX,y:e.clientY};renderer.domElement.focus();renderLoop?.wake();}}
        function onPointerMove(e:PointerEvent){
          if(!dragging||controls.isLocked)return;
          const dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;lastPointer={x:e.clientX,y:e.clientY};
          if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>4)dragged=true;
          const euler=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');
          euler.y-=dx*.003;euler.x=THREE.MathUtils.clamp(euler.x-dy*.003,-1.3,1.3);camera.quaternion.setFromEuler(euler);
          renderLoop?.wake();
        }
        function onClick(e:MouseEvent){
          if(dragged){dragged=false;return;}
          if(controls.isLocked)return;
          const bounds=renderer.domElement.getBoundingClientRect();
          camera.updateMatrixWorld();raycaster.far=Infinity;
          raycaster.setFromCamera(new THREE.Vector2((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1),camera);
          const paneId=paneAlongRay(raycaster,clickables);
          if(paneId){const desk=desksById.get(paneId);if(desk)selectDesk(desk);}
        }
        const onPointerUp=()=>{dragging=false;};
        renderer.domElement.style.touchAction='none';
        window.addEventListener('keydown',onKeyDown);window.addEventListener('keyup',onKeyUp);window.addEventListener('blur',onBlur);
        renderer.domElement.addEventListener('pointerdown',onPointerDown);window.addEventListener('pointermove',onPointerMove);window.addEventListener('pointerup',onPointerUp);window.addEventListener('pointercancel',onPointerUp);
        renderer.domElement.addEventListener('click',onClick);
        renderer.domElement.addEventListener('wheel',onWheel,{passive:false});
        document.addEventListener('visibilitychange',onVisibility);
        document.addEventListener('focusin',onFocusIn);
        const observer=new ResizeObserver(()=>{
          if(!el.clientWidth||!el.clientHeight)return;
          camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);
          renderLoop?.wake();
        });observer.observe(el);
        function canOccupy(x:number,z:number){
          // This is a workspace browser: walls and furniture never delay travel.
          if(overview)return x>=-plan.width/2-30&&x<=plan.width/2+30&&z>=-30&&z<=plan.depth+30;
          return canStandAt({x,z},plan,[]);
        }
        function animate(now:number,dt:number){
          simulationSeconds+=dt;renderFrames+=1;
          camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,camera.up).normalize();moveVector.set(0,0,0);
          if(keys.has('KeyW')||keys.has('ArrowUp'))moveVector.add(forward);
          if(keys.has('KeyS')||keys.has('ArrowDown'))moveVector.sub(forward);
          if(keys.has('KeyD')||keys.has('ArrowRight'))moveVector.add(right);
          if(keys.has('KeyA')||keys.has('ArrowLeft'))moveVector.sub(right);
          if(moveVector.lengthSq()>0){
            wheelRemaining=0;
            const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?RUN_SPEED:WALK_SPEED;
            walkSpeed=THREE.MathUtils.lerp(walkSpeed,speed,1-Math.exp(-dt/ .10));
            moveVector.normalize().multiplyScalar(dt*walkSpeed);
          }else{
            walkSpeed=0;
            const travel=THREE.MathUtils.clamp(wheelRemaining*(1-Math.exp(-dt/ .12)),-RUN_SPEED*dt,RUN_SPEED*dt);
            wheelRemaining-=travel;
            if(Math.abs(wheelRemaining)<.005)wheelRemaining=0;
            if(overview){camera.getWorldDirection(moveVector);moveVector.multiplyScalar(travel);}
            else moveVector.copy(forward).multiplyScalar(travel);
          }
          const next=moveOnFloor(camera.position,moveVector,p=>canOccupy(p.x,p.z));
          // Tiny wake-up timesteps and vertical overview travel are valid motion,
          // not evidence that the floor boundary blocked a wheel burst.
          if(Math.hypot(moveVector.x,moveVector.z)>=.0001&&Math.hypot(next.x-camera.position.x,next.z-camera.position.z)<.0001&&(!overview||Math.abs(moveVector.y)<.0001))wheelRemaining=0;
          camera.position.x=next.x;camera.position.z=next.z;
          if(overview)camera.position.y=THREE.MathUtils.clamp(camera.position.y+moveVector.y,3,65);
          const renderMode=renderLoop?.isInteractive()?'interactive':'idle';publishRenderMode(renderMode);
          if(now-viewTime>=100){
            viewTime=now;
            renderer.domElement.dataset.officeTiming=JSON.stringify({simulationSeconds,frames:renderFrames,moving:moveVector.lengthSq()>0||Math.abs(wheelRemaining)>.005,renderMode});
            const yaw=Math.atan2(-forward.x,-forward.z);
            const viewKey=`${camera.position.x.toFixed(2)}/${camera.position.z.toFixed(2)}/${yaw.toFixed(3)}/${camera.position.y.toFixed(2)}`;
            if(viewKey!==lastView){
              lastView=viewKey;
              const view={x:camera.position.x,z:camera.position.z,height:camera.position.y,yaw};
              renderer.domElement.dataset.officeView=JSON.stringify(view);
              latest.current.onViewChange?.(view);
            }
          }
          const time=now/1000,agents=latest.current.connection?.snapshot?.agents??[];
          if(agents!==cachedAgents){cachedAgents=agents;agentsByPane=new Map(agents.map(a=>[a.pane_id,a]));}
          const refreshBadges=now-badgeTime>=1000||badgeMain!==latest.current.mainAgent;
          if(refreshBadges){badgeTime=now;badgeMain=latest.current.mainAgent;}
          const companyPixelScale=240*2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,renderer.domElement.clientHeight);
          for(const marker of companySigns){
            const width=overview&&marker.rowZ===overviewRowZ?Math.max(2.8,camera.position.distanceTo(marker.sprite.position)*companyPixelScale):2.8;
            marker.sprite.scale.set(width,width*224/768,1);
          }
          const badgePixelScale=320*2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,renderer.domElement.clientHeight);
          for(const h of humans){
            const agent=agentsByPane.get(h.desk.pane.pane_id),status=agent?.agent_status??'unknown';
            const pose=agentPose(status);
            h.seated.visible=!!agent&&pose==='seated';h.standing.visible=!!agent&&pose==='standing';
            const body=pose==='standing'?h.standing:h.seated;
            h.badge.position.set(body.position.x,pose==='standing'?2.04:1.91,body.position.z);
            const badgeWidth=Math.min(1.20,camera.position.distanceTo(h.badge.position)*badgePixelScale);
            h.badge.scale.set(badgeWidth,badgeWidth*224/768,1);
            h.ring.position.set(body.position.x,.092,body.position.z);
            h.badge.visible=!!agent;
            h.ring.visible=!!agent;
            h.status=status;
            if(refreshBadges){
            const main=latest.current.mainAgent;
            const isMain=!!agent&&!!main&&main.connectionId===latest.current.connection?.id&&main.paneId===agent.pane_id&&main.terminalId===agent.terminal_id;
            const indicator=agent?agentIndicator(agent,isMain):{label:status,color:statusColors[status]};
            const displayName=agent?agentTaskLabel(agent):'Agent';
            const subLabel=agent?`${agentType(agent)} · ${indicator.label}`:indicator.label;
            const indicatorKey=displayName+'/'+subLabel+'/'+indicator.color;
            if(h.indicatorKey!==indicatorKey){h.indicatorKey=indicatorKey;
              const texture=artTexture(createAgentBadge(displayName,subLabel,indicator.color));
              if(h.badge.material.map){textures.delete(h.badge.material.map);h.badge.material.map.dispose();}
              h.badge.material.map=texture;textures.add(texture);h.badge.material.needsUpdate=true;
              (h.ring.material as THREE.MeshBasicMaterial).color.set(indicator.color);
            }
            }
            h.arms.forEach((arm,i)=>{arm.object.rotation.x=arm.base+(status==='working'?Math.sin(time*7+h.phase+i)*.045:0);});
            if(h.head)h.head.rotation.y=Math.sin(time*.6+h.phase)*.035;
            (h.ring.material as THREE.MeshBasicMaterial).opacity=status==='blocked'?.6+Math.sin(time*5)*.3:status==='working'?.65+Math.sin(time*1.6+h.phase)*.15:.65;
          }
          // Report the actual scene objects for inspecting a missing occupant,
          // including status changes that do not rebuild the floor.
          if(refreshBadges){
          const presence=JSON.stringify(humans.map(h=>({paneId:h.desk.pane.pane_id,
            status:h.status,pose:h.seated.visible?'seated':h.standing.visible?'standing':'absent'})));
          if(renderer.domElement.dataset.agentPresence!==presence)renderer.domElement.dataset.agentPresence=presence;
          }
          const selected=latest.current.selectedPaneId?desksById.get(latest.current.selectedPaneId):undefined;
          selector.visible=!!selected;if(selected)selector.position.set(selected.x,.1,selected.z+.35);
          refreshGaze(false,now);
          const gazeAgent=gazeTarget?agentsByPane.get(gazeTarget.pane.pane_id):undefined;
          if(hint.current){hint.current.textContent=gazeTarget?`E · ${gazeAgent?'Talk to '+agentTaskLabel(gazeAgent):'Open terminal'} · ${gazeTarget.pane.pane_id}`:'';hint.current.style.display=gazeTarget?'block':'none';}
          const department=plan.departments.find(d=>camera.position.x>=d.x&&camera.position.x<=d.x+d.width&&camera.position.z>=d.z&&camera.position.z<=d.z+d.depth);
          const company=department?plan.companies.find(c=>c.id===department.workspaceId):plan.companies.find(c=>camera.position.x>=c.x&&camera.position.x<=c.x+c.width&&camera.position.z>=c.z&&camera.position.z<=c.z+c.depth);
          const location=(company?.id??'')+'/'+(department?.id??'');
          if(lastLocation!==location){lastLocation=location;latest.current.onLocation(company?.id??null,department?.id??null);}
          renderer.render(scene,camera);
        }
        function frameRow(){
          stopMovement();
          const company=plan.companies.find(c=>camera.position.x>=c.x&&camera.position.x<=c.x+c.width&&camera.position.z>=c.z-1&&camera.position.z<=c.z+c.depth);
          // Frame the nearest actual row, rather than fitting the whole floor into tiny dots.
          const rowZ=company?.z??plan.companies.reduce((best,c)=>Math.abs(c.z-camera.position.z)<Math.abs(best-camera.position.z)?c.z:best,plan.companies[0]?.z??14);
          overviewRowZ=rowZ;
          const row=plan.companies.filter(c=>Math.abs(c.z-rowZ)<.01);
          if(!row.length)return;
          const minX=Math.min(...row.map(c=>c.x)),maxX=Math.max(...row.map(c=>c.x+c.width));
          const targetX=(minX+maxX)/2,targetZ=rowZ+Math.max(...row.map(c=>c.depth))*.42;
          const eyeZ=Math.max(.8,rowZ-13),distance=(maxX-minX)*1.12/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect);
          const height=THREE.MathUtils.clamp(Math.sqrt(Math.max(18*18,distance*distance-(targetZ-eyeZ)**2)),18,65);
          camera.position.set(targetX,height,eyeZ);camera.lookAt(targetX,0,targetZ);
          renderLoop?.wake();
        }
        function setViewMode(mode:'overview'|'walk'){
          stopMovement();overview=mode==='overview';roof.visible=!overview;
          if(overview)frameRow();
          else if(camera.position.y>=3){
            camera.position.x=THREE.MathUtils.clamp(camera.position.x,-plan.width/2+.5,plan.width/2-.5);
            camera.position.z=THREE.MathUtils.clamp(camera.position.z,.8,plan.depth-.7);
            camera.position.y=1.68;
            const euler=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');euler.x=-.03;camera.quaternion.setFromEuler(euler);
          }
          renderLoop?.wake();
        }
        if(overview){roof.visible=false;if(!previous||previous.position.y<3)frameRow();}
        runtime.current={controls,camera,plan,setViewMode,frameRow,
          invalidate(){renderLoop?.invalidate();},
          raiseView(delta){if(!overview||!Number.isFinite(delta))return;stopMovement();camera.position.y=THREE.MathUtils.clamp(camera.position.y+delta,3,65);renderLoop?.wake();},
          teleport(workspaceId,tabId){
            const company=plan.companies.find(c=>c.id===workspaceId);const dept=company?.departments.find(d=>d.id===tabId)??company?.departments[0];
            if(!company)return;
            camera.position.set(dept?dept.x+dept.width/2:company.x+company.width/2,1.68,dept?dept.z+.6:company.z+1);
            camera.lookAt(camera.position.x,1.35,camera.position.z+7);stopMovement();
            if(overview)frameRow();
            renderLoop?.wake();
          },
          focusPane(paneId){const d=desksById.get(paneId);if(!d)return;
            controls.unlock();overview=false;roof.visible=true;camera.position.set(d.x+1.35,1.55,d.z+1.7);camera.lookAt(d.x,1.20,d.z+.15);
            latest.current.onSelectPane(paneId);stopMovement();
            renderLoop?.wake();
          },
          updateScreen(paneId,text){
            if(screenText.get(paneId)===text)return;screenText.set(paneId,text);
            const monitor=monitors.get(paneId);if(!monitor)return;
            const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=576;
            const ctx=canvas.getContext('2d')!;ctx.fillStyle='#14221c';ctx.fillRect(0,0,1024,576);
            ctx.fillStyle='#a3bb9f';ctx.font=`16px ${mono}`;
            text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g,'').split('\n').slice(-29).forEach((line,i)=>ctx.fillText(line.slice(0,100),22,25+i*18));
            const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
            const material=monitor.material as THREE.MeshBasicMaterial;
            if(material.map){textures.delete(material.map);material.map.dispose();}
            material.map=texture;material.needsUpdate=true;textures.add(texture);
            renderLoop?.invalidate();
          },
          dispose(){
            savedCamera.current={id:connection!.id,position:camera.position.clone(),quaternion:camera.quaternion.clone()};
            renderLoop?.dispose();observer.disconnect();stopMovement();controls.unlock();latest.current.onLockChange(false);controls.dispose();
            window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);window.removeEventListener('blur',onBlur);
            window.removeEventListener('pointermove',onPointerMove);window.removeEventListener('pointerup',onPointerUp);window.removeEventListener('pointercancel',onPointerUp);
            renderer.domElement.removeEventListener('pointerdown',onPointerDown);renderer.domElement.removeEventListener('click',onClick);
            renderer.domElement.removeEventListener('wheel',onWheel);document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('focusin',onFocusIn);
            controls.removeEventListener('lock',onLock);controls.removeEventListener('unlock',onUnlock);controls.removeEventListener('change',onLook);document.removeEventListener('pointerlockerror',onLockError);
            // GLB geometry/materials remain shared with the reusable kit. Dispose only owned resources.
            const kitGeometry=new Set<THREE.BufferGeometry>();Object.values(kit).forEach(g=>g.traverse(o=>{if(o instanceof THREE.Mesh)kitGeometry.add(o.geometry);}));
            scene.traverse(o=>{if(o instanceof THREE.Mesh&&!kitGeometry.has(o.geometry))o.geometry.dispose();});
            textures.forEach(t=>t.dispose());ownedMaterials.forEach(m=>m.dispose());humans.forEach(h=>h.materials.forEach(m=>m.dispose()));
            renderer.dispose();renderer.domElement.remove();if(shell)delete shell.dataset.renderMode;if(hint.current)hint.current.style.display='none';
          },
        };
        renderLoop=createRenderLoop({draw:animate,isVisible:()=>!document.hidden,
          isActive:()=>dragging||Math.abs(wheelRemaining)>.005||['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some(key=>keys.has(key))});
        renderLoop.wake();latest.current.onReady();
      }catch(error){if(!cancelled)latest.current.onError(error instanceof Error?error.message:'Unable to initialize the office.');}
    }
    void build();return()=>{cancelled=true;runtime.current?.dispose();runtime.current=null;};
  },[topology]);

  useEffect(()=>{runtime.current?.setViewMode(props.viewMode??'walk');},[props.viewMode]);

  useEffect(()=>{runtime.current?.invalidate();},[props.selectedPaneId,props.mainAgent]);

  useEffect(()=>{
    const paneId=props.selectedPaneId,connectionId=props.connection?.id;if(!paneId||!connectionId)return;
    let stopped=false;let controller:AbortController|undefined;let timer:ReturnType<typeof setTimeout>;
    async function refresh(){
      controller=new AbortController();
      try{
        const result=await fetch(`/api/panes/${encodeURIComponent(paneId!)}/terminal?connectionId=${encodeURIComponent(connectionId!)}&lines=50&source=visible`,{signal:controller.signal});
        if(result.ok){const data=await result.json();if(!stopped)runtime.current?.updateScreen(paneId!,data.text);}
      }catch{/* The actual terminal drawer reports connectivity and errors. */}
      if(!stopped)timer=setTimeout(refresh,2000);
    }
    void refresh();return()=>{stopped=true;controller?.abort();clearTimeout(timer);};
  },[props.selectedPaneId,props.connection?.id]);
  return <div ref={host} className="office-scene" style={{position:'absolute',inset:0}}>
    <div ref={hint} className="scene-interaction" style={{display:'none',position:'absolute',left:'50%',transform:'translateX(-50%)',zIndex:2,pointerEvents:'none',whiteSpace:'nowrap'}} />
  </div>;
});
export default OfficeScene;
