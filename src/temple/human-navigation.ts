import type {TempleDefinition, Vec3} from './types.ts';

export const HUMAN_HEIGHT=2.32, HUMAN_REVEAL_MS=440;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
interface Motion {
 kind:'walk'|'pause'|'turn';start:number;end:number;from:Vec3;to:Vec3;yaw:number;endYaw:number;
 curve?:Vec3; distances?:number[];length:number;distance:number;run:number;runStart:number;runEnd:number;runLength:number;speed:number;ramp:number;
}
export interface HumanSite {id:string;chamber?:string;revealDelay?:number;from:Vec3;yaw:number;scale:number;delay:number;shirt:string;motion:Motion[];duration:number;loop:'concealed'|'circuit';initialTime:number;}
const distance=(a:Vec3,b:Vec3)=>Math.hypot(b[0]-a[0],b[2]-a[2]);
const mix=(a:Vec3,b:Vec3,t:number)=>a.map((v,i)=>v+(b[i]-v)*t) as Vec3;
const empty={length:0,distance:0,run:-1,runStart:0,runEnd:0,runLength:0,speed:0,ramp:0};

/** Arc-length parameterisation keeps the same walking pace through rounded
 * corners. Tables are built once, never tessellated or allocated while walking. */
function point(m:Motion,d:number){
 let u=clamp(d/m.length);
 if(m.curve){const a=m.distances!,target=u*m.length;let i=1;while(i<a.length-1&&a[i]<target)i++;u=(i-1+(target-a[i-1])/(a[i]-a[i-1]))/(a.length-1);}
 const a=m.from,b=m.to,c=m.curve;
 const x=c?(1-u)**2*a[0]+2*(1-u)*u*c[0]+u*u*b[0]:a[0]+(b[0]-a[0])*u;
 const z=c?(1-u)**2*a[2]+2*(1-u)*u*c[2]+u*u*b[2]:a[2]+(b[2]-a[2])*u;
 const dx=c?2*((1-u)*(c[0]-a[0])+u*(b[0]-c[0])):b[0]-a[0],dz=c?2*((1-u)*(c[2]-a[2])+u*(b[2]-c[2])):b[2]-a[2];
 return{x,y:a[1]+(b[1]-a[1])*u,z,yaw:Math.atan2(dx,dz)};
}
function travel(t:number,duration:number,speed:number,ramp:number){
 const edge=(v:number)=>speed*(v/2-ramp*Math.sin(Math.PI*v/ramp)/(2*Math.PI));
 const length=speed*(duration-ramp);
 return t<ramp?edge(Math.max(0,t)):t>duration-ramp?length-edge(Math.max(0,duration-t)):speed*(t-ramp/2);
}
function travelTime(d:number,duration:number,speed:number,ramp:number){if(d===0)return 0;let lo=0,hi=duration;for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(travel(mid,duration,speed,ramp)<d)lo=mid;else hi=mid;}return(lo+hi)/2;}

function route(site:Omit<HumanSite,'motion'|'duration'|'initialTime'>,legs:{to:Vec3;duration:number;pause?:number}[]):HumanSite{
 const motion:Motion[]=[];let at=site.from,yaw=site.yaw,time=site.delay;
 const speed=legs.reduce((n,l,i)=>n+distance(i?legs[i-1].to:site.from,l.to),0)/(legs.reduce((n,l)=>n+l.duration,0)/1000);
 const turn=(target:number)=>{const endYaw=yaw+angleDelta(yaw,target),delta=Math.abs(endYaw-yaw);if(delta>.02){const duration=350+delta*210;motion.push({...empty,kind:'turn',start:time,end:time+duration,from:at,to:at,yaw,endYaw});time+=duration;yaw=endYaw;}};
 const walk=(to:Vec3,curve?:Vec3)=>{
  if(distance(at,to)<1e-6)return;
  const m:Motion={...empty,kind:'walk',start:0,end:0,from:at,to,curve,yaw:0,endYaw:0,length:distance(at,to)};
  if(curve){const a=[0];let previous=at;for(let i=1;i<=32;i++){const u=i/32,p=at.map((v,j)=>(1-u)**2*v+2*(1-u)*u*curve[j]+u*u*to[j]) as Vec3;a.push(a.at(-1)!+distance(previous,p));previous=p;}m.distances=a;m.length=a.at(-1)!;}
  motion.push(m);at=to;yaw=point(m,m.length).yaw;
 };
 for(let i=0;i<legs.length;i++){
  const l=legs[i],next=legs[i+1],incoming=distance(i?legs[i-1].to:site.from,l.to),outgoing=next?distance(l.to,next.to):0;
  const radius=!l.pause&&outgoing?Math.min(.52,incoming*.44,outgoing*.44):0;
  const entry=radius?mix(l.to,at,radius/distance(at,l.to)):l.to;
  if(motion.at(-1)?.kind!=='walk')turn(Math.atan2(entry[0]-at[0],entry[2]-at[2]));
  walk(entry);
  if(radius)walk(mix(l.to,next.to,radius/outgoing),l.to);
  if(l.pause){motion.push({...empty,kind:'pause',start:0,end:l.pause,from:at,to:at,yaw:0,endYaw:0});}
 }
 // Assign one distance clock to each uninterrupted walk, including its corners.
 // Only the departure/arrival accelerates; each brick-length is not eased anew.
 time=site.delay;yaw=site.yaw;
 for(let i=0;i<motion.length;){
  const m=motion[i];
  if(m.kind==='walk'){
   let j=i;while(j<motion.length&&motion[j].kind==='walk')j++;
   const length=motion.slice(i,j).reduce((n,m)=>n+m.length,0),v=speed/1000,ramp=Math.min(480,length/v*.12),duration=length/v+ramp;let d=0;
   for(let k=i;k<j;k++){const w=motion[k];w.run=i;w.runStart=time;w.runEnd=time+duration;w.runLength=length;w.speed=v;w.ramp=ramp;w.distance=d;w.start=time+travelTime(d,duration,v,ramp);d+=w.length;w.end=k===j-1?time+duration:time+travelTime(d,duration,v,ramp);w.yaw=point(w,0).yaw;w.endYaw=point(w,w.length).yaw;}
   time+=duration;yaw=motion[j-1].endYaw;i=j;
  }else{const duration=m.end-m.start;m.start=time;m.end=time+duration;if(m.kind==='turn'){m.yaw=yaw;m.endYaw=yaw+angleDelta(yaw,m.endYaw);yaw=m.endYaw;}else m.yaw=m.endYaw=yaw;time=m.end;i++;}
 }
 if(site.loop==='circuit')turn(site.yaw);
 motion.push({...empty,kind:'pause',start:time,end:time+(site.chamber?1900:1800),from:at,to:at,yaw,endYaw:yaw});time=motion.at(-1)!.end;
 return{...site,motion,duration:time,initialTime:0};
}

/** Follow the actual room perimeters, leaving the sacred fittings untouched.
 * The three chambers remain separate: no new inter-shrine corridor is implied.
 * Vishnu's narrow east aisle is open; its west side meets the secondary plinth. */
export function humanSites(definition:TempleDefinition):HumanSite[]{
 const floor=(name:string)=>definition.chambers.find(c=>c.name===name)!.floorY;
 const sites=[
 route({id:'north-arrival',from:[22.45,4,-4.55],yaw:Math.PI/2,scale:.96,delay:400,shirt:'#9B7C64',loop:'concealed'},[
  {to:[27.5,4,-4.55],duration:6200},{to:[27.5,4,1.1],duration:7100,pause:1100},{to:[25.5,4,1.1],duration:3000},{to:[19.4,4,1.1],duration:8400},{to:[12,4,1.1],duration:10200,pause:2200}]),
 route({id:'court-arrival',from:[22.45,4,-4.55],yaw:Math.PI/2,scale:.94,delay:4600,shirt:'#758B8B',loop:'concealed'},[
  {to:[27.5,4,-4.55],duration:6400},{to:[27.5,4,7.4],duration:13900,pause:1700},{to:[25.65,4,7.4],duration:2700},{to:[25.65,4,3.2],duration:5200},{to:[19.4,4,3.2],duration:8400}]),
 route({id:'east-arrival',from:[22.45,4,-4.55],yaw:Math.PI/2,scale:.95,delay:8800,shirt:'#8E9478',loop:'concealed'},[
  {to:[27.5,4,-4.55],duration:6400},{to:[27.5,4,.6],duration:6700},{to:[30.2,3.6,.6],duration:3900},{to:[30.2,3.6,3.1],duration:3800,pause:1800},{to:[27.5,4,3.1],duration:3900},{to:[25.5,4,2],duration:3000},{to:[19.4,4,2],duration:8600}]),
 // Start beside the sacred fitting, in the existing clear perimeter aisle.
 // The circuit leaves both the fitting and the east doorway approach clear.
 route({id:'main-visitor',chamber:'main',revealDelay:0,from:[10.8,floor('main'),4.8],yaw:-Math.PI/2,scale:.94,delay:3200,shirt:'#A18A6E',loop:'circuit'},[
  {to:[4.8,4,4.8],duration:12000},{to:[4.8,4,-.8],duration:11200,pause:2300},{to:[10.8,4,-.8],duration:12000},{to:[10.8,4,4.8],duration:11200}]),
 route({id:'secondary-visitor',chamber:'secondary',from:[-23.5,floor('secondary'),-2.5],yaw:Math.PI,scale:.90,delay:2100,shirt:'#7C8B78',loop:'circuit'},[
  {to:[-23.5,3.6,-5.5],duration:6200,pause:2600},{to:[-20.5,3.6,-5.5],duration:6200},{to:[-20.5,3.6,-2.5],duration:6400},{to:[-23.5,3.6,-2.5],duration:6200}]),
 route({id:'vishnu-visitor',chamber:'vishnu',from:[-8.5,floor('vishnu'),4.1],yaw:-Math.PI/2,scale:.90,delay:1500,shirt:'#958374',loop:'circuit'},[
  {to:[-11.45,2.8,4.1],duration:6300},{to:[-11.45,2.8,7.25],duration:6800,pause:2500},{to:[-11.45,2.8,1.9],duration:11300},{to:[-8.5,2.8,1.9],duration:6200},{to:[-8.5,2.8,4.1],duration:4800}]),
 ];
 const phase=(site:HumanSite,x:number,z:number)=>{const m=site.motion.find(m=>m.kind==='walk'&&Math.hypot(m.to[0]-x,m.to[2]-z)<.8)!;site.initialTime=m.start+(m.end-m.start)*.5;};
 phase(sites[0],27.5,1.1);phase(sites[1],25.65,3.2);phase(sites[2],30.2,3.1);
 return sites;
}
export interface HumanPose{x:number;y:number;z:number;yaw:number;walk:number;reveal:number;moving:boolean;state:Motion['kind']|'waiting'|'standing';segment:number;along:number;length:number;cycle:number;}
export function humanWalkPoint(site:HumanSite,run:number,distance:number){
 const first=site.motion[run],d=Math.max(0,Math.min(first.runLength,distance));
 const m=site.motion.find(m=>m.run===run&&d<=m.distance+m.length+1e-8)??site.motion.filter(m=>m.run===run).at(-1)!;
 return point(m,d-m.distance);
}
export function humanPose(site:HumanSite,index:number,time:number,reduced=false,revealTime=time):HumanPose{
 const cycle=site.loop==='circuit'?Math.floor(time/site.duration):0,t=site.loop==='circuit'?time%site.duration:Math.min(time,site.duration);
 const p:HumanPose={x:site.from[0],y:site.from[1],z:site.from[2],yaw:site.yaw,walk:0,reveal:reduced?1:smooth((revealTime-(site.revealDelay??index*150))/HUMAN_REVEAL_MS),moving:false,state:'waiting',segment:-1,along:0,length:0,cycle};
 for(const [i,m]of site.motion.entries()){
  if(t<m.start)break;const u=clamp((t-m.start)/(m.end-m.start)),q=smooth(u);
  if(m.kind==='walk'){
   const elapsed=Math.max(0,Math.min(m.runEnd-m.runStart,t-m.runStart)),d=travel(elapsed,m.runEnd-m.runStart,m.speed,m.ramp),v=point(m,Math.max(0,Math.min(m.length,d-m.distance)));
   p.x=v.x;p.y=v.y;p.z=v.z;p.yaw=v.yaw;p.along=d;p.length=m.runLength;
   p.walk=reduced||u===1?0:smooth(Math.min(elapsed,m.runEnd-m.runStart-elapsed)/m.ramp);
  }else{p.x=m.from[0];p.y=m.from[1];p.z=m.from[2];p.yaw=m.yaw+(m.endYaw-m.yaw)*q;p.walk=0;p.along=p.length=0;}
  p.segment=i;p.state=u===1?'standing':m.kind;p.moving=!reduced&&u<1&&m.kind!=='pause';if(u<1)break;
 }
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
 return{from,to,u,at:from+(to-from)*smooth(u),lift:Math.sin(Math.PI*u),stride};
}
