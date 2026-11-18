import type { BrickRecord } from './types.ts';
import type { Motion } from './animation.ts';
export const PROTOTYPE_DURATION = 3000;
export const FLIGHT_MS = 600;
export const SEAT_MS = 120;
export const BOUNCE_HEIGHT = .48;
export interface LandingMotion extends Motion { pieceId:string; contact:number; settled:number; volume:number; bounceHeight?:number; prominent?:boolean; entryFadeMs?:number; bounceDamping?:number; visibility?:number; impactSpeed?:number; }
// Larger original standard cornice plates: 6–10 studs, two exposed main-tower courses.
export const SAMPLE_IDS = [
 'main.tier-2.coping.0000','main.tier-2.coping.0002',
 'main.tier-2.coping.0001','main.tier-2.coping.0003',
 'main.tier-2.coping.0004','main.tier-2.coping.0005',
 'main.tier-2.coping.0006','main.tier-2.coping.0007',
 'main.tier-4.coping.0000.merged-2','main.tier-4.coping.0002',
 'main.tier-4.coping.0003','main.tier-4.coping.0004.merged-2',
];
export function createLandingPrototype(pieces:BrickRecord[]):LandingMotion[] {
 return SAMPLE_IDS.map((id,i)=>{
  const p=pieces.find(p=>p.id===id);if(!p)throw new Error('Missing prototype piece: '+id);
  const contact=620+i*190;
  return {pieceId:id,contact,settled:contact+SEAT_MS,delay:contact-FLIGHT_MS,duration:FLIGHT_MS+SEAT_MS,
   x:0,z:0,drop:48,volume:p.size[0]*p.size[1]*p.size[2]};
 });
}
/** Ballistic descent; one readable parabolic rebound; exact original transform at rest. */
export function landingOffset(m:LandingMotion,time:number){
 if(time<=m.delay)return m.drop;
 if(time<m.contact){const t=(time-m.delay)/(m.contact-m.delay);return m.drop*(1-t*t);}
 if(time<m.settled){const t=(time-m.contact)/(m.settled-m.contact);return 4*(m.bounceHeight??BOUNCE_HEIGHT)*t*(1-t)*Math.exp(-(m.bounceDamping??0)*t);}
 return 0;
}
/** Soft coverage only at the start of short approaches; final materials are unchanged. */
export function landingVisibility(m:LandingMotion,time:number){
 if(time<m.delay)return 0;if(!m.entryFadeMs)return 1;
 const t=Math.max(0,Math.min(1,(time-m.delay)/m.entryFadeMs));return t*t*(3-2*t);
}
export const LANDING_GLSL = `float flight=clamp((buildTime-buildMotion.x)/buildMotion.z,0.0,1.0);
 float seatProgress=clamp((buildTime-buildMotion.x-buildMotion.z)/buildMotion.w,0.0,1.0);
 float offset=buildTime<buildMotion.x+buildMotion.z ? buildDrop*(1.0-flight*flight) : (4.0*buildBounce)*seatProgress*(1.0-seatProgress)*exp(-buildDamping*seatProgress);
 buildOpacity=buildDrop==0.0 ? 1.0 : buildTime<buildMotion.x ? 0.0 : buildEntry>0.0 ? smoothstep(0.0,buildEntry,buildTime-buildMotion.x) : 1.0;
 transformed.y+=buildDrop==0.0 ? 0.0 : offset;`;
export function prototypeAngle(time:number,duration=PROTOTYPE_DURATION){
 if(time>=duration)return 0;
 const t=Math.max(0,Math.min(duration,time)),brake=250,cruise=duration-brake;
 const travel=t<=cruise?t:cruise+(t-cruise)-(t-cruise)**2/(2*brake);
 return -Math.PI/14*(1-travel/(duration-brake/2));
}
