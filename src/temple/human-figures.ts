import { Color, CylinderGeometry, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Raycaster, ShaderMaterial, Vector3, type OrthographicCamera } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { TempleDefinition, Vec3 } from './types.ts';
export const HUMAN_HEIGHT=2.32,HUMAN_REVEAL_MS=440;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
interface Motion {kind:'walk'|'pause'|'turn';start:number;end:number;from:Vec3;to:Vec3;yaw:number;endYaw:number;}
export interface HumanSite {id:string;chamber?:string;from:Vec3;yaw:number;scale:number;delay:number;shirt:string;motion:Motion[];duration:number;loop:'concealed'|'circuit';initialTime:number;}
function route(site:Omit<HumanSite,'motion'|'duration'|'initialTime'>,legs:{to:Vec3;duration:number;pause?:number}[]):HumanSite{
 const motion:Motion[]=[];let at=site.from,yaw=site.yaw,time=site.delay;
 const turn=(target:number)=>{const endYaw=yaw+angleDelta(yaw,target);if(Math.abs(endYaw-yaw)>.02){motion.push({kind:'turn',start:time,end:time+800,from:at,to:at,yaw,endYaw});time+=800;yaw=endYaw;}};
 for(const leg of legs){turn(Math.atan2(leg.to[0]-at[0],leg.to[2]-at[2]));motion.push({kind:'walk',start:time,end:time+leg.duration,from:at,to:leg.to,yaw,endYaw:yaw});time+=leg.duration;at=leg.to;if(leg.pause){motion.push({kind:'pause',start:time,end:time+leg.pause,from:at,to:at,yaw,endYaw:yaw});time+=leg.pause;}}
 if(site.loop==='circuit')turn(site.yaw);
 motion.push({kind:'pause',start:time,end:time+(site.chamber?1800:2600),from:at,to:at,yaw,endYaw:yaw});time=motion.at(-1)!.end;
 return {...site,motion,duration:time,initialTime:site.delay+motion.find(m=>m.kind==='walk')!.end*.7};
}
/** Three one-way exterior lanes begin behind the porch wall and finish under its
 * roof. Interior circuits follow the actual free aisles around sacred fittings. */
export function humanSites(definition:TempleDefinition):HumanSite[]{
 const floor=(name:string)=>definition.chambers.find(c=>c.name===name)!.floorY;
 const sites=[
 route({id:'north-arrival',from:[22.45,4,-4.55],yaw:Math.PI/2,scale:.96,delay:400,shirt:'#9B7C64',loop:'concealed'},[
  {to:[27.5,4,-4.55],duration:6200},{to:[27.5,4,1.1],duration:7100,pause:1000},{to:[25.5,4,1.1],duration:3000,pause:1000},{to:[22.45,4,1.1],duration:4000,pause:1600}]),
 route({id:'court-arrival',from:[23.4,4,-3.65],yaw:-Math.PI/2,scale:.94,delay:4600,shirt:'#758B8B',loop:'concealed'},[
  {to:[22.45,4,-3.65],duration:1700},{to:[22.45,4,-4.55],duration:1700},{to:[27.5,4,-4.55],duration:6400},{to:[27.5,4,7.5],duration:13900},{to:[25.65,4,7.5],duration:2700,pause:800},{to:[25.65,4,3.2],duration:5700,pause:1300},{to:[25.5,4,3.2],duration:900,pause:800},{to:[22.45,4,3.2],duration:3900}]),
 route({id:'east-arrival',from:[22.45,4,-3.65],yaw:Math.PI,scale:.95,delay:8800,shirt:'#8E9478',loop:'concealed'},[
  {to:[22.45,4,-4.55],duration:1700},{to:[27.5,4,-4.55],duration:6400},{to:[27.5,4,2],duration:7100,pause:1400},{to:[25.5,4,2],duration:3100,pause:1000},{to:[22.85,4,2],duration:3700}]),
 route({id:'main-visitor',chamber:'main',from:[11.3,floor('main'),5.3],yaw:Math.PI,scale:.94,delay:900,shirt:'#A18A6E',loop:'circuit'},[
  {to:[11.3,4,2],duration:5700,pause:2400},{to:[11.3,4,-1.3],duration:5400},{to:[4.7,4,-1.3],duration:10500,pause:1600},{to:[4.7,4,5.3],duration:10500},{to:[11.3,4,5.3],duration:10600}]),
 route({id:'secondary-visitor',chamber:'secondary',from:[-23.5,floor('secondary'),-2.5],yaw:Math.PI,scale:.90,delay:2100,shirt:'#7C8B78',loop:'circuit'},[
  {to:[-23.5,3.6,-4],duration:3700,pause:2700},{to:[-23.5,3.6,-5.5],duration:3700},{to:[-20.5,3.6,-5.5],duration:6900,pause:1900},{to:[-20.5,3.6,-2.5],duration:7100},{to:[-23.5,3.6,-2.5],duration:7100}]),
 route({id:'vishnu-visitor',chamber:'vishnu',from:[-11.5,floor('vishnu'),4],yaw:Math.PI,scale:.90,delay:1500,shirt:'#958374',loop:'circuit'},[
  {to:[-11.5,2.8,2],duration:4500,pause:2300},{to:[-8.5,2.8,2],duration:6500},{to:[-8.5,2.8,4],duration:4500,pause:1400},{to:[-11.5,2.8,4],duration:6500,pause:1800}]),
 ];
 const phase=(site:HumanSite,pick:(m:Motion)=>boolean,u:number)=>{const m=site.motion.find(pick)!;site.initialTime=m.start+(m.end-m.start)*u;};
 phase(sites[0],m=>m.kind==='walk'&&m.from[0]===27.5&&m.to[2]===1.1,.35);
 phase(sites[1],m=>m.kind==='walk'&&m.from[0]===25.65&&m.to[2]===3.2,.20);
 phase(sites[2],m=>m.kind==='walk'&&m.to[0]===25.5,.35);
 return sites;
}
export interface HumanPose{x:number;y:number;z:number;yaw:number;walk:number;reveal:number;moving:boolean;state:Motion['kind']|'waiting'|'standing';segment:number;along:number;length:number;cycle:number;}
export function humanPose(site:HumanSite,index:number,time:number,reduced=false,revealTime=time):HumanPose{
 const cycle=site.loop==='circuit'?Math.floor(time/site.duration):0,t=site.loop==='circuit'?time%site.duration:Math.min(time,site.duration);
 const p:HumanPose={x:site.from[0],y:site.from[1],z:site.from[2],yaw:site.yaw,walk:0,reveal:reduced?1:smooth((revealTime-index*150)/HUMAN_REVEAL_MS),moving:false,state:'waiting',segment:-1,along:0,length:0,cycle};
 for(const [i,m]of site.motion.entries()){if(t<m.start)break;const u=clamp((t-m.start)/(m.end-m.start)),q=smooth(u);p.x=m.from[0]+(m.to[0]-m.from[0])*q;p.z=m.from[2]+(m.to[2]-m.from[2])*q;p.yaw=m.yaw+(m.endYaw-m.yaw)*q;p.segment=i;p.state=u===1?'standing':m.kind;p.moving=!reduced&&u<1&&m.kind!=='pause';p.length=Math.hypot(m.to[0]-m.from[0],m.to[2]-m.from[2]);p.along=p.length*q;p.walk=m.kind==='walk'&&!reduced&&u<1?smooth(Math.min(u,1-u)/.12):0;if(u<1)break;}
 return p;
}
export function humanNextActivity(site:HumanSite,time:number){
 const cycle=site.loop==='circuit'?Math.floor(time/site.duration):0,t=site.loop==='circuit'?time%site.duration:time;
 const m=site.motion.find(m=>m.kind!=='pause'&&m.start>t);if(m)return cycle*site.duration+m.start;
 return site.loop==='circuit'?(cycle+1)*site.duration+site.motion.find(m=>m.kind!=='pause')!.start:time<site.duration?site.duration:undefined;
}
/** A stance foot is fixed in world distance for 56% of each stride. */
export function plantedFoot(distance:number,length:number,side:number){
 const stride=length/Math.max(1,Math.ceil(length/.84)),shift=side<0?0:stride/2,d=distance+shift,cycle=Math.floor(d/stride),phase=d/stride-cycle;
 const from=(cycle+.25)*stride-shift,to=from+stride,u=clamp((phase-.56)/.44);
 return {from,to,u,at:from+(to-from)*smooth(u),lift:Math.sin(Math.PI*u),stride};
}
function supportField(definition:TempleDefinition){
 const blocks=definition.pieces.filter(p=>p.shape==='box'&&(p.structuralRole==='floor'||p.structuralRole==='foundation'||p.group==='main.plinth-studs')).map(p=>({p,c:Math.cos(p.rotationY),s:Math.sin(p.rotationY),top:p.position[1]+p.size[1]/2})),cache=new Map<string,number>();
 return (x:number,z:number,base:number,yaw:number)=>{
  const key=[x,z,base,yaw].map(n=>n.toFixed(4)).join(',');const found=cache.get(key);if(found!==undefined)return found;
  let top=base;const c=Math.cos(yaw),s=Math.sin(yaw);
  for(const [ox,oz]of [[0,0],[-.10,-.17],[.10,-.17],[-.10,.17],[.10,.17]]){const wx=x+ox*c+oz*s,wz=z-ox*s+oz*c;
   for(const b of blocks){if(b.top<base-.01||b.top>base+.82)continue;const dx=wx-b.p.position[0],dz=wz-b.p.position[2],lx=dx*b.c-dz*b.s,lz=dx*b.s+dz*b.c;if(Math.abs(lx)>b.p.size[0]/2-.001||Math.abs(lz)>b.p.size[2]/2-.001)continue;top=Math.max(top,b.top);if(b.p.studs){const sx=lx+b.p.size[0]/2-.5,sz=lz+b.p.size[2]/2-.5;if(Math.hypot(sx-Math.round(sx),sz-Math.round(sz))<.3)top=Math.max(top,b.top+.18);}}
  }
  if(cache.size>4096)cache.clear();cache.set(key,top);return top;
 };
}
type Part={name:string;kind:'body'|'round';color:string};
function parts(site:HumanSite,index:number):Part[]{const skin=index%2?'#C0A178':'#CFB187',pants=index%2?'#777063':'#687770';const a:Part[]=[{name:'torso',kind:'body',color:site.shirt},{name:'pelvis',kind:'body',color:pants},{name:'neck',kind:'round',color:skin},{name:'head',kind:'round',color:skin},{name:'stud',kind:'round',color:skin}];for(const side of ['left','right'])a.push({name:side+'-thigh',kind:'body',color:pants},{name:side+'-shin',kind:'body',color:pants},{name:side+'-foot',kind:'body',color:'#655D4F'},{name:side+'-upper-arm',kind:'body',color:site.shirt},{name:side+'-forearm',kind:'body',color:site.shirt},{name:side+'-hand',kind:'round',color:skin});return a;}

export function createHumanFigures(definition:TempleDefinition){
  const sites=humanSites(definition),group=new Group();group.name='human-scale-figures';group.visible=false;group.userData.sites=sites;
  const all=sites.map(parts),bodyGeometry=new RoundedBoxGeometry(1,1,1,1,.055),ovalGeometry=new CylinderGeometry(.5,.5,1,16);
  const material=new MeshStandardMaterial({color:0xffffff,roughness:.48,metalness:0,envMapIntensity:.45});
  material.customProgramCacheKey=()=> 'inhabited-lego-people-v3';
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float figureReveal; varying float humanReveal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhumanReveal=figureReveal;');
    shader.fragmentShader='varying float humanReveal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      if(humanReveal<1.0 && humanReveal<=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))))discard;`);
  };
  const makeMesh=(geometry:typeof bodyGeometry|typeof ovalGeometry,kind:Part['kind'])=>{
    const count=all.flat().filter(p=>p.kind===kind).length,reveal=new InstancedBufferAttribute(new Float32Array(count),1),mesh=new InstancedMesh(geometry,material,count);
    geometry.setAttribute('figureReveal',reveal);reveal.setUsage(DynamicDrawUsage);mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.name='human-'+kind;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.raycast=()=>{};group.add(mesh);return mesh;
  };
  const bodies=makeMesh(bodyGeometry,'body'),ovals=makeMesh(ovalGeometry,'round'),indices={body:0,round:0},offscreen=new Matrix4().makeTranslation(0,10000,0);
  const mapped=all.map(list=>Object.fromEntries(list.map(part=>{const index=indices[part.kind]++,mesh=part.kind==='body'?bodies:ovals;mesh.setColorAt(index,new Color(part.color));mesh.setMatrixAt(index,offscreen);return [part.name,{index,mesh}];})));
  // Retain the existing lightweight contact shadows and cached sun shadow map.
  const shadowGeometry=new PlaneGeometry(1,1);shadowGeometry.rotateX(-Math.PI/2);
  const shadowAlpha=new InstancedBufferAttribute(new Float32Array(sites.length),1);shadowGeometry.setAttribute('figureReveal',shadowAlpha);
  const shadowMaterial=new ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{ink:{value:new Color('#6C523C')}},
    vertexShader:'attribute float figureReveal;varying float opacity;varying vec2 coord;void main(){opacity=figureReveal;coord=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform vec3 ink;varying float opacity;varying vec2 coord;void main(){float edge=1.0-smoothstep(.1,1.0,length(coord));gl_FragColor=vec4(ink,edge*edge*.15*opacity);
      #include <colorspace_fragment>
    }`});
  const shadows=new InstancedMesh(shadowGeometry,shadowMaterial,sites.length);shadows.name='human-contact-shadows';shadows.frustumCulled=false;shadows.renderOrder=-12;shadows.raycast=()=>{};shadows.instanceMatrix.setUsage(DynamicDrawUsage);group.add(shadows);
  const position=new Vector3(),scale=new Vector3(),q=new Quaternion(),body=new Quaternion(),matrix=new Matrix4(),axisY=new Vector3(0,1,0),direction=new Vector3();
  const ground=supportField(definition),clocks=sites.map(()=>0),cycles=sites.map(()=>0),proof=sites.map(()=>false),entryBlocked=sites.map(()=>false),speeds=sites.map(()=>1),poses:HumanPose[]=[],feet:{x:number;y:number;z:number;ground:number;stance:boolean}[][]=[];
  group.userData.poses=poses;group.userData.cycles=cycles;group.userData.feet=feet;group.userData.recycleProof=proof;
  let lastTime:number|undefined,revealTime=0,wasActive=false,lastReduced=false,lastPlan=0,hidden=false,initialized=false;
  function draw(reduced:boolean){
    sites.forEach((site,i)=>{
      const pose=humanPose(site,i,clocks[i],reduced,revealTime);pose.walk*=speeds[i];if(speeds[i]<.001){pose.moving=false;pose.state='pause';}poses[i]=pose;body.setFromAxisAngle(axisY,pose.yaw);const s=site.scale,c=Math.cos(pose.yaw),sn=Math.sin(pose.yaw),m=site.motion[pose.segment];
      const supports=[-1,1].map(sign=>{
        const lateral=sign*.12*s,neutralX=pose.x+c*lateral,neutralZ=pose.z-sn*lateral,base=ground(neutralX,neutralZ,site.from[1],pose.yaw);
        if(!pose.walk||!m||m.kind!=='walk')return {x:neutralX,y:base,z:neutralZ,ground:base,stance:true,offset:0};
        const f=plantedFoot(pose.along,pose.length,sign),target=(distance:number)=>{const at=clamp(distance/pose.length)*pose.length;return{x:m.from[0]+sn*at+c*lateral,z:m.from[2]+c*at-sn*lateral};},a=target(f.from),b=target(f.to),ha=ground(a.x,a.z,site.from[1],pose.yaw),hb=ground(b.x,b.z,site.from[1],pose.yaw);
        let u=smooth(f.u),y=ha+(hb-ha)*u+f.lift*.085*s;
        // Raise before translating across the existing .8-stud level change;
        // lower only after clearing the edge. The other foot remains planted.
        if(Math.abs(hb-ha)>.08&&f.u>0){u=smooth((f.u-.22)/.56);const rise=smooth(f.u/.22),seat=smooth((f.u-.78)/.22);y=ha+(Math.max(ha,hb)+.075*s-ha)*rise-(Math.max(ha,hb)+.075*s-hb)*seat;}
        const at=clamp((f.from+(f.to-f.from)*u)/pose.length)*pose.length,offset=(at-pose.along)*pose.walk,x=neutralX+sn*offset,z=neutralZ+c*offset;
        const sole=base+(y-base)*pose.walk,actual=ground(x,z,site.from[1],pose.yaw);
        return{x,y:f.u===0?actual:Math.max(sole,actual),z,ground:actual,stance:f.u===0&&pose.walk===1,offset};
      });
      feet[i]=supports;
      let hip=(supports[0].y+supports[1].y)/2+(1.08-.02*pose.walk)*s;
      for(const foot of supports)hip=Math.min(hip,foot.y+.14*s+Math.sqrt(Math.max(.01,(.985*s)**2-foot.offset**2)));
      pose.y=hip-1.08*s;
      const put=(name:string,x:number,y:number,z:number,w:number,h:number,d:number)=>{
        const {mesh,index}=mapped[i][name];position.set(x,y,z).multiplyScalar(s).applyQuaternion(body);position.x+=pose.x;position.y+=pose.y;position.z+=pose.z;q.copy(body);scale.set(w*s,h*s,d*s);matrix.compose(position,q,scale);mesh.setMatrixAt(index,matrix);(mesh.geometry.getAttribute('figureReveal') as InstancedBufferAttribute).setX(index,pose.reveal);
      };
      const segment=(name:string,x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,w:number,d:number)=>{
        direction.set(x1-x2,y1-y2,z1-z2);const length=direction.length();direction.divideScalar(length);q.setFromUnitVectors(axisY,direction);const {mesh,index}=mapped[i][name];position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2).multiplyScalar(s).applyQuaternion(body);position.x+=pose.x;position.y+=pose.y;position.z+=pose.z;q.premultiply(body);scale.set(w*s,length*s,d*s);matrix.compose(position,q,scale);mesh.setMatrixAt(index,matrix);(mesh.geometry.getAttribute('figureReveal') as InstancedBufferAttribute).setX(index,pose.reveal);
      };
      put('pelvis',0,1.11,0,.45,.18,.32);put('torso',0,1.44,0,.54,.64,.35);put('neck',0,1.81,0,.22,.14,.22);put('head',0,2.02,0,.44,.44,.44);put('stud',0,2.28,0,.18,.08,.18);
      for(const [j,side,sign]of [[0,'left',-1],[1,'right',1]] as const){
        const foot=supports[j],ankle=(foot.y+.14*s-pose.y)/s,z=foot.offset/s,dy=ankle-1.08,length=Math.hypot(dy,z),bend=Math.sqrt(Math.max(0,.5**2-length**2/4)),kneeY=(1.08+ankle)/2+bend*z/length,kneeZ=z/2-bend*dy/length,x=sign*.12;
        segment(side+'-thigh',x,1.08,0,x,kneeY,kneeZ,.17,.20);segment(side+'-shin',x,kneeY,kneeZ,x,ankle,z,.155,.18);put(side+'-foot',x,(foot.y+.07*s-pose.y)/s,z,.19,.14,.34);
        const phase=pose.length?pose.along/.84*Math.PI*2:0,swing=.065*pose.walk*Math.sin(phase+(j?Math.PI:0));segment(side+'-upper-arm',sign*.34,1.69,0,sign*.35,1.43,swing*.6,.16,.18);segment(side+'-forearm',sign*.35,1.43,swing*.6,sign*.35,1.18,.025+swing,.14,.16);put(side+'-hand',sign*.35,1.13,.025+swing,.17,.17,.17);
      }
      position.set(pose.x,ground(pose.x,pose.z,site.from[1],pose.yaw)+.008,pose.z);q.identity();scale.set(.65*s,1,.65*s);matrix.compose(position,q,scale);shadows.setMatrixAt(i,matrix);shadowAlpha.setX(i,pose.reveal);
    });
    for(const mesh of [bodies,ovals]){mesh.instanceMatrix.needsUpdate=true;(mesh.geometry.getAttribute('figureReveal') as InstancedBufferAttribute).needsUpdate=true;}shadows.instanceMatrix.needsUpdate=true;shadowAlpha.needsUpdate=true;
  }
  return {group,sites,
    /** Conservatively prove the full reset silhouette is behind actual masonry.
     * Done in private warmup, not during a visible landing/visitor frame. */
    prepareVisibility(camera:OrthographicCamera,blockers:InstancedMesh[]){
      const ray=new Raycaster(),dir=camera.getWorldDirection(new Vector3()),point=new Vector3(),hits:import('three').Intersection[]=[];for(const mesh of blockers)mesh.updateWorldMatrix(true,false);
      const concealed=(site:HumanSite,time:number)=>{const p=humanPose(site,0,time);for(const y of [.01,.05,.8,1.5,HUMAN_HEIGHT])for(const x of [-.46,.46])for(const z of [-.35,.35]){point.set(p.x+x*site.scale,ground(p.x,p.z,site.from[1],p.yaw)+y*site.scale,p.z+z*site.scale).addScaledVector(dir,-200);ray.set(point,dir);ray.far=199.995;hits.length=0;ray.intersectObjects(blockers,false,hits);if(!hits.length)return false;}return true;};
      group.userData.visibilityProof=sites.map((site,i)=>{if(site.loop!=='concealed')return null;const start=concealed(site,0),end=concealed(site,site.duration);proof[i]=start&&end;return{start,end};});
    },
    update(now:number,ready:boolean,reduced:boolean,planProgress=0){
      if(!ready){if(lastTime!==undefined)this.reset();return{active:false,wakeAt:undefined};}
      const first=!initialized,dt=first?0:Math.max(0,now-lastTime!);lastTime=Math.max(now,lastTime??now);
      if(hidden)return{active:false,wakeAt:undefined};
      if(first){initialized=true;sites.forEach((site,i)=>{clocks[i]=!site.chamber||reduced?site.initialTime:0;});}
      const planChanged=lastPlan!==planProgress;
      if(!reduced&&!lastReduced){revealTime+=dt;const current=sites.map((site,i)=>humanPose(site,i,clocks[i]));
        for(let i=0;i<sites.length;i++){
          const site=sites[i],step=dt,previous=current[i],candidate=humanPose(site,i,clocks[i]+step);let pace=1;
          current.forEach((other,j)=>{if(j===i||!!sites[j].chamber!==!!site.chamber)return;const dist=Math.hypot(previous.x-other.x,previous.z-other.z);if(Math.hypot(candidate.x-other.x,candidate.z-other.z)<dist)pace=Math.min(pace,smooth((dist-.84)/.62));});
          const entry=site.loop==='concealed'?site.motion.find(m=>m.kind==='walk'&&m.from[0]===25.5&&m.to[0]<25.5):undefined;
          entryBlocked[i]=!!entry&&clocks[i]<entry.start&&clocks[i]+step*pace>=entry.start&&!current.some((other,j)=>j!==i&&!sites[j].chamber&&other.x>=25.5);
          if(entryBlocked[i]){clocks[i]=entry!.start-.001;pace=0;}else clocks[i]+=step*pace;
          speeds[i]=pace;current[i]=humanPose(site,i,clocks[i]);
          if(site.loop==='concealed'&&clocks[i]>=site.duration&&planProgress===0&&proof[i]&&!current.some((other,j)=>j!==i&&!sites[j].chamber&&Math.hypot(site.from[0]-other.x,site.from[2]-other.z)<.85)){clocks[i]=0;cycles[i]++;current[i]=humanPose(site,i,0);}
        }
      }
      lastPlan=planProgress;if(reduced)revealTime=Math.max(revealTime,1190);
      const active=!reduced&&(revealTime<1190||sites.some((site,i)=>humanPose(site,i,clocks[i]).moving&&speeds[i]>.001));
      if(!group.visible||active||wasActive||lastReduced!==reduced||planChanged){draw(reduced);group.visible=true;}
      wasActive=active;lastReduced=reduced;let wait=Infinity;
      if(!reduced)sites.forEach((site,i)=>{if(entryBlocked[i])return;const next=humanNextActivity(site,clocks[i]);if(next!==undefined)wait=Math.min(wait,next-clocks[i]);});
      return{active,wakeAt:Number.isFinite(wait)?now+Math.max(1,wait):undefined};
    },
    setHidden(value:boolean,now:number){hidden=value;lastTime=lastTime===undefined?undefined:now;},
    prepareWarmup(){group.visible=true;},
    reset(){lastTime=undefined;initialized=false;revealTime=0;clocks.fill(0);cycles.fill(0);speeds.fill(1);entryBlocked.fill(false);wasActive=lastReduced=false;lastPlan=0;poses.length=feet.length=0;group.visible=false;},
    dispose(){group.removeFromParent();for(const mesh of [bodies,ovals,shadows]){mesh.geometry.dispose();mesh.dispose();}material.dispose();shadowMaterial.dispose();},
  };
}
