import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTempleDefinition} from '../src/temple/model.ts';
import {createLandingPrototype,landingOffset,prototypeAngle,BOUNCE_HEIGHT,PROTOTYPE_DURATION,SEAT_MS,FLIGHT_MS} from '../src/temple/landing-prototype.ts';
import {LandingAudio} from '../src/temple/landing-audio.ts';
const definition=createTempleDefinition(),before=JSON.stringify(definition),events=createLandingPrototype(definition.pieces);
test('prototype selects 12 original independent pieces without modifying geometry',()=>{
 assert.equal(events.length,12);assert.equal(new Set(events).size,12);assert.equal(new Set(events.map(e=>e.pieceId)).size,12);
 assert.ok(events.every(e=>{const p=definition.pieces.find(p=>p.id===e.pieceId);return p.catalogueId && p.size[0]*p.size[2]>=6;}));
 assert.equal(JSON.stringify(definition),before);assert.deepEqual(events,createLandingPrototype(definition.pieces));
 assert.equal(definition.pieces.length,2145);
});
test('ballistic acceleration, continuous contact, readable rebound, exact seating and bounded airborne count',()=>{
 for(const m of events){
  const a=landingOffset(m,m.delay+FLIGHT_MS/4),b=landingOffset(m,m.delay+FLIGHT_MS/2),c=landingOffset(m,m.delay+FLIGHT_MS*3/4);
  assert.ok(b-c>a-b);assert.ok(landingOffset(m,m.contact-.0001)<.0001);
  assert.equal(landingOffset(m,m.contact),0);assert.equal(landingOffset(m,m.contact+SEAT_MS/2),BOUNCE_HEIGHT);
  assert.equal(landingOffset(m,m.settled),0);assert.equal(landingOffset(m,3000),0);
  assert.ok(m.settled<PROTOTYPE_DURATION);
 }
 let peak=0;for(let t=0;t<=3000;t++)peak=Math.max(peak,events.filter(m=>t>=m.delay&&t<m.settled).length);
 assert.equal(peak,4);
});
function half(p){const c=Math.abs(Math.cos(p.rotationY)),s=Math.abs(Math.sin(p.rotationY));return [(p.size[0]*c+p.size[2]*s)/2,(p.size[0]*s+p.size[2]*c)/2];}
test('no completed overlying bounding volumes block vertical paths; supports seat first',()=>{
 const selected=new Map(events.map(e=>[e.pieceId,e]));
 for(const m of events){const p=definition.pieces.find(p=>p.id===m.pieceId),a=half(p);
  for(const q of definition.pieces){
   if(q.id===p.id||q.position[1]-q.size[1]/2<p.position[1]+p.size[1]/2-.001)continue;
   const b=half(q);if(Math.abs(p.position[0]-q.position[0])>=a[0]+b[0]-.045||Math.abs(p.position[2]-q.position[2])>=a[1]+b[1]-.045)continue;
   const upper=selected.get(q.id);assert.ok(upper,`${p.id} obstructed by ${q.id}`);
   assert.ok(upper.contact>m.settled,`${q.id} must follow ${p.id}`);
  }
 }
});
test('rotation is continuous, unidirectional and stationary at the hero angle by 3000ms',()=>{
 let previous=prototypeAngle(0);for(let t=1;t<=3000;t++){const a=prototypeAngle(t);assert.ok(a>=previous);previous=a;}
 assert.equal(prototypeAngle(3000),0);assert.equal(prototypeAngle(4000),0);
 assert.ok(Math.abs(prototypeAngle(2999))<.000001);
});
class Context{
 state='running';currentTime=0;destination={};sources=[];
 async resume(){} async close(){this.state='closed';}
 createGain(){return {gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
 createBufferSource(){const voice={playbackRate:{value:1},connect(){},disconnect(){},start(t){this.started=true;this.when=t;},stop(when){assert.ok(this.started,'Web Audio requires start before stop');if(when===undefined)this.stopped=true;else this.stopAt=when;}};this.sources.push(voice);return voice;}
 live(){return this.sources.filter(s=>!s.stopped);}
}
const loader=async()=>[{duration:.08}, {duration:.08}, {duration:.08}];
test('all 12 recorded clicks are scheduled exactly at contact and lock, with no rattle or extra finish click',async()=>{
 const c=new Context(),audio=new LandingAudio(events,()=>c,loader);
 audio.update(0,true);assert.equal(c.sources.length,0);await audio.setMuted(false);
 assert.deepEqual(c.sources.map(s=>s.when),events.flatMap(e=>[e.contact/1000,e.settled/1000]));
 audio.update(3000,false);assert.equal(c.live().length,0);assert.equal(c.sources.length,24);audio.dispose();
});
test('mute, mid-build unmute, replay, hidden state and reduced motion cancel scheduled voices',async()=>{
 const c=new Context(),audio=new LandingAudio(events,()=>c,loader);
 audio.update(0,true);await audio.setMuted(false);await audio.setMuted(true);assert.equal(c.live().length,0);
 c.currentTime=1.5;audio.update(1500,true);await audio.setMuted(false);
 assert.deepEqual(c.live().map(s=>Number(s.when.toFixed(9))),events.flatMap(e=>[e.contact,e.settled]).filter(t=>t>=1500).map(t=>t/1000));
 audio.update(0,true);assert.equal(c.live().length,24);audio.setHidden(true);assert.equal(c.live().length,0);
 audio.setHidden(false);assert.equal(c.live().length,24);audio.update(3000,false);assert.equal(c.live().length,0);audio.dispose();
});
test('stale loading cannot turn sound on after mute',async()=>{
 const c=new Context();let resolve;const audio=new LandingAudio(events,()=>c,()=>new Promise(r=>resolve=r));
 audio.update(0,true);const pending=audio.setMuted(false);await audio.setMuted(true);resolve([{}]);await pending;
 assert.equal(c.sources.length,0);audio.dispose();
});



test('rolling audio schedules only near-future clicks and skips missed contacts after a stall',async()=>{
 const c=new Context(),audio=new LandingAudio(events,()=>c,loader,220);
 audio.update(0,true);await audio.setMuted(false);assert.equal(c.sources.length,0);
 c.currentTime=.5;audio.update(500,true);assert.equal(c.sources.length,1);assert.equal(c.sources[0].when,.62);
 audio.update(510,true);assert.equal(c.sources.length,1);
 const previous=c.sources.length;c.currentTime=2;audio.update(2000,true);
 assert.ok(c.sources.slice(previous).every(s=>s.when>=2&&s.when<=2.22));
 assert.ok(c.sources.length<8);await audio.setMuted(true);assert.equal(c.live().length,0);audio.dispose();
});

test('frame-locked audio waits for rendered contact and seating, and never anticipates a landing',async()=>{
 const c=new Context(),audio=new LandingAudio(events,()=>c,loader,220,true);
 audio.update(0,true);await audio.setMuted(false);c.currentTime=.619;audio.update(619,true);assert.equal(c.sources.length,0);
 c.currentTime=.63;audio.update(630,true);assert.equal(c.sources.length,1);assert.equal(c.sources[0].when,.63);
 c.currentTime=.70;audio.update(700,true);assert.equal(c.sources.length,1);
 c.currentTime=.75;audio.update(750,true);assert.equal(c.sources.length,2);assert.equal(c.sources[1].when,.75);
 await audio.setMuted(true);assert.equal(c.live().length,0);audio.dispose();
});
