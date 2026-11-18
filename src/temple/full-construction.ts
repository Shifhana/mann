import type { BrickRecord } from './types.ts';
import type { LandingMotion } from './landing-prototype.ts';
export const CONSTRUCTION_GRAVITY=550;
const bounds=(p:BrickRecord)=>{const c=Math.abs(Math.cos(p.rotationY)),s=Math.abs(Math.sin(p.rotationY));return [(p.size[0]*c+p.size[2]*s)/2,(p.size[0]*s+p.size[2]*c)/2];};
function seed(id:string){let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296;}
function structuralArrival(y:number){
 if(y<=4)return 280+Math.max(0,y)/4*1070;
 if(y<=12)return 1350+(y-4)/8*950;
 if(y<=32)return 2300+(y-12)/20*1600;
 return 4000+(y-32)/7*500;
}
/** Spatially parallel structural waves, with independent ballistic parts throughout. */
export function createFullConstruction(pieces:BrickRecord[]):LandingMotion[]{
 const ordered=pieces.map(p=>({p,half:bounds(p)})).sort((a,b)=>a.p.position[1]-b.p.position[1]||a.p.assemblyStage-b.p.assemblyStage||a.p.id.localeCompare(b.p.id));
 const events:LandingMotion[]=[];
 for(let i=0;i<ordered.length;i++){
  const {p,half}=ordered[i],area=p.size[0]*p.size[2];
  const hero=area>=8&&p.position[2]>2&&seed(p.id+':hero')<.085;
  const small=area<=4&&!hero&&p.structuralRole==='detail';
  const medium=area<8&&!hero&&!small&&p.structuralRole==='detail';
  const seat=hero?80:small?26:32;
  const drop=small?3.2+seed(p.id+':approach')*1.4:medium?9+seed(p.id+':approach')*3:70-p.position[1];
  const flight=Math.sqrt(2*drop/CONSTRUCTION_GRAVITY)*1000;
  // Offset neighbouring regions and individual bricks, never a rigid layer or a shared event.
  let contact=Math.max(flight+15,structuralArrival(p.position[1])+seed(p.id)*(area<4?220:90)+Math.max(0,Math.min(1,(p.position[0]+35)/72))*260+Math.max(0,Math.min(1,(p.position[2]+20)/48))*90);
  for(let j=0;j<i;j++){
   const q=ordered[j];if(q.p.position[1]>=p.position[1]-.01)continue;
   if(Math.abs(p.position[0]-q.p.position[0])<half[0]+q.half[0]-.045&&Math.abs(p.position[2]-q.p.position[2])<half[1]+q.half[1]-.045)
    {
    const lower=events[j],gap=Math.max(0,p.position[1]-q.p.position[1]-(p.size[1]+q.p.size[1])/2);
    const available=drop+gap-lower.drop;
    // Keep approach paths vertically separated even when a small part starts lower.
    const clearContact=available<0
      ? lower.delay+Math.sqrt(-2*available/CONSTRUCTION_GRAVITY)*1000+flight
      : lower.delay+flight-Math.sqrt(2*available/CONSTRUCTION_GRAVITY)*1000;
    contact=Math.max(contact,lower.settled+8,(small||medium)?clearContact:0);
   }
  }
  events.push({pieceId:p.id,delay:contact-flight,contact,settled:contact+seat,duration:flight+seat,x:0,z:0,drop,volume:area*p.size[1],bounceHeight:CONSTRUCTION_GRAVITY*(seat/1000)**2/8,bounceDamping:1.8,impactSpeed:CONSTRUCTION_GRAVITY*flight/1000,visibility:p.group.includes('.core')?.18:p.structuralRole==='sacred'?.25:p.section==='near-side'?1:p.section==='crossing'?.75:.4,prominent:hero,entryFadeMs:small?40:medium?45:0});
 }
 return events;
}
/** Emphasise substantial visible landings at a readable audio cadence. */
export function prominentLandings(events:LandingMotion[]){
 const ordered=[...events].sort((a,b)=>a.contact-b.contact);const selected:LandingMotion[]=[];
 for(let start=0;start<ordered.length;){
  const time=ordered[start].contact;let end=start+1;while(end<ordered.length&&ordered[end].contact-time<95)end++;
  const candidates=ordered.slice(start,end).filter(e=>e.volume>=4);
  candidates.sort((a,b)=>(Number(b.prominent)*2+(b.visibility??1))-(Number(a.prominent)*2+(a.visibility??1))||b.volume-a.volume);
  if(candidates.length)selected.push(candidates[0]);start=end;
 }
 const final=ordered.at(-1);if(final&&!selected.includes(final)&&final.contact-(selected.at(-1)?.contact??0)>60)selected.push(final);
 return selected;
}



