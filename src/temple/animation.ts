import type { BrickRecord } from './types.ts';
export const BUILD_DURATION = 3900;
export const ENTRY_DURATION = 1;
export interface Motion { delay: number; duration: number; x: number; z: number; drop: number }
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>v*v*(3-2*v);
function seed(key:string) { let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296; }
function arrival(stage:number) {
  if(stage<=16)return 620+stage*27;
  if(stage<=35)return 1120+(stage-20)*30;
  if(stage<=43)return 1670+(stage-37)*28;
  if(stage<=103)return 1900+(stage-50)*20;
  if(stage<=110)return 2960+(stage-105)*32;
  return 3220+(stage-115)*70;
}
export function pieceMotion(p:BrickRecord):Motion {
  const a=seed(p.id),b=seed(`${p.id}:height`);
  const landing=arrival(p.assemblyStage)+a*90;
  const duration=620+b*55;
  return {delay:Math.max(0,landing-duration),duration,x:0,z:0,drop:15+b*4};
}
function assemblyKey(p:BrickRecord) {
  if(p.structuralRole==='sacred')return p.group;
  // Recognisable standard bricks and large plates always fall individually.
  const area=p.size[0]*p.size[2];
  if(p.catalogueId&&p.shape==='box'&&((area>=12&&p.size[1]>=1.2)||area>=48))return p.id;
  if(/finial|octagonal-cap/.test(p.group))return p.group;
  if(p.group.endsWith('.nandi'))return p.group+':'+Math.round(p.position[0]/6)+':'+Math.round(p.position[2]/6);
  const region=p.group.match(/^(main|secondary)\.tier-\d+/)?.[0]??p.group.split('.')[0];
  return [region,Math.floor(p.position[0]/8),Math.floor(p.position[2]/8),Math.floor(p.position[1]/3.6)].join(':');
}
/** Choreograph once; each instance retains its immutable approved final matrix. */
export function createMotionPlan(pieces:BrickRecord[]):Motion[] {
  const groups=new Map<string,number[]>();
  pieces.forEach((p,i)=>{const key=assemblyKey(p),members=groups.get(key)??[];members.push(i);groups.set(key,members);});
  const units=[...groups].map(([key,indices])=>{
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    let landing=0;
    for(const i of indices) {
      const p=pieces[i],c=Math.abs(Math.cos(p.rotationY)),s=Math.abs(Math.sin(p.rotationY));
      const half=[(p.size[0]*c+p.size[2]*s)/2,p.size[1]/2,(p.size[2]*c+p.size[0]*s)/2];
      for(let j=0;j<3;j++){min[j]=Math.min(min[j],p.position[j]-half[j]);max[j]=Math.max(max[j],p.position[j]+half[j]);}
      landing=Math.max(landing,arrival(p.assemblyStage));
    }
    return {indices,min,max,landing:landing+seed(key)*480,drop:Math.max(22,52-min[1])+seed(`${key}:height`)*3};
  }).sort((a,b)=>a.min[1]-b.min[1]);
  // A vertical descent must not cross an already seated overlying part.
  // Existing intentional intersections in the approved model are not changed.
  for(let i=0;i<units.length;i++)for(let j=0;j<i;j++) {
    const upper=units[i],lower=units[j];
    if(lower.max[1]<=upper.min[1]+.001 && lower.max[0]>upper.min[0]+.01 && lower.min[0]<upper.max[0]-.01 && lower.max[2]>upper.min[2]+.01 && lower.min[2]<upper.max[2]-.01)
      upper.landing=Math.max(upper.landing,lower.landing+24);
  }
  const latest=Math.max(...units.map(u=>u.landing));
  const earliest=Math.min(...units.map(u=>u.landing));
  const motions:Motion[]=new Array(pieces.length);
  for(const u of units) {
    const landing=560+(u.landing-earliest)/(latest-earliest)*3190,duration=560;
    const m={delay:landing-duration,duration,x:0,z:0,drop:u.drop};
    for(const i of u.indices)motions[i]=m;
  }
  return motions;
}
/** Visible travel with a brief acceleration and short seating stop. */
export function remaining(m:Motion,time:number):number {
  const t=clamp((time-m.delay)/m.duration),seat=.055/m.drop;
  if(t<.94){
    const u=t/.94;
    const distance=u<.1?5*u*u:u<.8?u-.05:.75+(u-.8)-(u-.8)*(u-.8)/.4;
    return seat+(1-seat)*(1-distance/.85);
  }
  return seat*(1-smooth((t-.94)/.06));
}
export function entryOpacity(m:Motion,time:number) {return time>m.delay?1:0;}
/** Constant angular speed for most of the build; C1 ease to rest over the final 400ms. */
export function turnAngle(time:number):number {
  if(time>=BUILD_DURATION)return 0;
  const t=Math.max(0,time),brake=400,cruise=BUILD_DURATION-brake;
  const travelled=t<=cruise?t:cruise+(t-cruise)-(t-cruise)*(t-cruise)/(2*brake);
  return -Math.PI/7*(1-travelled/(BUILD_DURATION-brake/2));
}



