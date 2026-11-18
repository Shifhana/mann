import{test}from'node:test';import assert from'node:assert/strict';import{createTempleDefinition}from'../src/temple/model.ts';import{refineCollectible}from'../src/temple/refine-collectible.ts';import{createFullConstruction}from'../src/temple/full-construction.ts';import{landingOffset}from'../src/temple/landing-prototype.ts';
const original=createTempleDefinition(),snapshot=JSON.stringify(original),refined=refineCollectible(original);
test('selective refinement is deterministic and never mutates the approved original',()=>{
 assert.equal(original.pieces.length,2145);assert.equal(refined.pieces.length,1911);assert.equal(JSON.stringify(original),snapshot);assert.deepEqual(refined,refineCollectible(original));
 assert.deepEqual(refined.chambers,original.chambers);assert.deepEqual(refined.sectionPath,original.sectionPath);
});
test('all changed parts use verified sizes; interiors and tower silhouette-defining parts are retained',()=>{
 const old=new Map(original.pieces.map(p=>[p.id,p]));const verified={'3004':[2,1.2,1],'3037':[4,1.2,2],'3039':[2,1.2,2],'14716':[1,3.6,1]};
 for(const p of refined.pieces)if(!old.has(p.id))assert.deepEqual(p.size,verified[p.catalogueId]);
 const protectedPart=p=>!(/\.aedicules$|\.eaves$|pilasters|porch-pillars/.test(p.group));
 const remaining=new Map(refined.pieces.map(p=>[p.id,p]));for(const p of original.pieces.filter(protectedPart))assert.deepEqual(remaining.get(p.id),p);
 for(const g of ['main.tier-1','main.tier-2','main.tier-3','main.tier-4','main.tier-5','secondary.tier-1','secondary.tier-2','secondary.tier-3']){
  const envelope=pieces=>{const a=pieces.filter(p=>p.group===g+'.eaves');return a.reduce((b,p)=>{const c=Math.abs(Math.cos(p.rotationY)),s=Math.abs(Math.sin(p.rotationY)),w=(p.size[0]*c+p.size[2]*s)/2,d=(p.size[0]*s+p.size[2]*c)/2;return[Math.min(b[0],p.position[0]-w),Math.max(b[1],p.position[0]+w),Math.min(b[2],p.position[2]-d),Math.max(b[3],p.position[2]+d)];},[Infinity,-Infinity,Infinity,-Infinity]);};
  envelope(original.pieces).forEach((v,i)=>assert.ok(Math.abs(v-envelope(refined.pieces)[i])<.001));
 }
});
test('refined preview independently seats all parts in approximately five seconds',()=>{
 const motions=createFullConstruction(refined.pieces),duration=Math.ceil(Math.max(...motions.map(e=>e.settled))+80);
 assert.equal(new Set(motions.map(e=>e.pieceId)).size,1911);assert.ok(duration>=4800&&duration<5300);assert.ok(motions.every(e=>landingOffset(e,duration)===0));
});
