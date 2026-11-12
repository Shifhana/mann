import{test}from'node:test';import assert from'node:assert/strict';import{planBatches}from'../src/temple/batching.ts';import{createTempleDefinition}from'../src/temple/model.ts';import{refineCollectible}from'../src/temple/refine-collectible.ts';import{geometryKey}from'../src/temple/geometry.ts';
const piece=(id,material,x,width=2)=>({id,material,position:[x,.2,0],size:[width,.4,2],rotationY:0,shape:'box',studs:true,catalogueId:'3022',group:'test',structuralRole:'detail',assemblyStage:0,section:'near-side'});
test('equal geometries share draws across colours without changing original part records',()=>{
 const parts=[piece('dark','toasted',10),piece('light','sandstone',0)],snapshot=JSON.stringify(parts),plan=planBatches(parts);
 assert.equal(plan.batches.size,1);assert.deepEqual([...plan.batches.values()][0].map(p=>p.id),['light','dark']);assert.equal(JSON.stringify(parts),snapshot);
});
test('coincident instances preserve original material priority inside a merged draw',()=>{
 const parts=[piece('dark','toasted',0),piece('light','sandstone',0)],plan=planBatches(parts);assert.deepEqual([...plan.batches.values()][0].map(p=>p.id),['light','dark']);
});
test('cyclic geometry precedence splits batches to retain both coplanar face colours',()=>{
 const parts=[piece('a-light','sandstone',0,2),piece('b-honey','honey',0,4),piece('b-light','sandstone',20,4),piece('a-dark','toasted',20,2)],plan=planBatches(parts);
 assert.equal(plan.split.size,2);assert.equal(plan.batches.size,4);
 const batch=id=>[...plan.batches].find(([,ps])=>ps.some(p=>p.id===id))[0];
 assert.ok(plan.order.get(batch('a-light'))<plan.order.get(batch('b-honey')));assert.ok(plan.order.get(batch('b-light'))<plan.order.get(batch('a-dark')));
});
test('production batch plan retains all 1911 identities and transforms with fewer draw submissions',()=>{
 const parts=refineCollectible(createTempleDefinition()).pieces,snapshot=JSON.stringify(parts),plan=planBatches(parts),flat=[...plan.batches.values()].flat();
 assert.equal(flat.length,1911);assert.equal(new Set(flat).size,1911);assert.ok(flat.every(p=>parts.includes(p)));assert.equal(JSON.stringify(parts),snapshot);
 assert.ok(plan.batches.size<new Set(parts.map(p=>geometryKey(p)+p.material)).size);assert.equal(new Set(plan.order.values()).size,plan.batches.size);
});
