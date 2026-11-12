import{test}from'node:test';import assert from'node:assert/strict';import{createTempleDefinition}from'../src/temple/model.ts';import{refineCollectible}from'../src/temple/refine-collectible.ts';import{createFullConstruction}from'../src/temple/full-construction.ts';import{landingOffset,landingVisibility}from'../src/temple/landing-prototype.ts';
const definition=refineCollectible(createTempleDefinition()),snapshot=JSON.stringify(definition),events=createFullConstruction(definition.pieces);
test('short decorative approaches preserve every model record and reduce airborne load',()=>{
 assert.equal(definition.pieces.length,1911);assert.equal(JSON.stringify(definition),snapshot);
 const details=events.filter(e=>e.entryFadeMs);assert.ok(details.length>600);
 assert.ok(details.every(e=>e.contact-e.delay<230));assert.ok(events.filter(e=>!e.entryFadeMs&&e.volume>=8).every(e=>e.contact-e.delay>300));
 let peak=0;for(let t=0;t<5000;t+=10)peak=Math.max(peak,events.filter(e=>t>=e.delay&&t<e.settled).length);assert.ok(peak<360);
 assert.ok(Math.min(...events.map(e=>e.contact))<550);assert.ok(events.every(e=>landingOffset(e,5000)===0));
});
test('short approach coverage enters continuously and is fully opaque before contact',()=>{
 for(const e of events.filter(e=>e.entryFadeMs)){
  assert.equal(landingVisibility(e,e.delay),0);assert.ok(landingVisibility(e,e.delay+.001)<.001);
  assert.ok(Math.abs(landingVisibility(e,e.delay+e.entryFadeMs/2)-.5)<1e-8);
  assert.equal(landingVisibility(e,e.contact),1);assert.equal(landingVisibility(e,5000),1);
 }
});
test('short approach entry starts above every overlapping falling support',()=>{
 const byId=new Map(definition.pieces.map(p=>[p.id,p]));const half=p=>{let c=Math.abs(Math.cos(p.rotationY)),s=Math.abs(Math.sin(p.rotationY));return[(p.size[0]*c+p.size[2]*s)/2,(p.size[0]*s+p.size[2]*c)/2];};
 for(const upper of events.filter(e=>e.entryFadeMs)){
  const p=byId.get(upper.pieceId),a=half(p);for(const lower of events){
   const q=byId.get(lower.pieceId);if(q.position[1]>=p.position[1]-.01)continue;const b=half(q);
   if(Math.abs(p.position[0]-q.position[0])>=a[0]+b[0]-.045||Math.abs(p.position[2]-q.position[2])>=a[1]+b[1]-.045)continue;
   const gap=Math.max(0,p.position[1]-q.position[1]-(p.size[1]+q.size[1])/2);
   const entry=Math.max(upper.delay,lower.delay);
   assert.ok(landingOffset(lower,entry)-landingOffset(upper,entry)<=gap+.0001,upper.pieceId+' / '+lower.pieceId);
  }
 }
});
