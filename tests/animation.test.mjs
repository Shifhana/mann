import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTempleDefinition} from '../src/temple/model.ts';
import {BUILD_DURATION,createMotionPlan,remaining,turnAngle,entryOpacity} from '../src/temple/animation.ts';
const pieces=createTempleDefinition().pieces, motions=createMotionPlan(pieces);
test('all 2145 pieces seat before the 3.9-second finish without a final-frame snap',()=>{
 assert.equal(pieces.length,2145);assert.equal(BUILD_DURATION,3900);assert.ok(BUILD_DURATION<=4000);
 for(const m of motions){assert.ok(m.delay>=0);assert.ok(m.delay+m.duration<=3750.001);assert.equal(remaining(m,BUILD_DURATION),0);assert.equal(remaining(m,10000),0);assert.equal(entryOpacity(m,BUILD_DURATION),1);assert.equal(entryOpacity(m,0),0);}
 assert.equal(turnAngle(BUILD_DURATION),0);assert.equal(turnAngle(10000),0);
});
test('replay is deterministic; descent and sub-stud seating are continuous and monotone',()=>{
 assert.deepEqual(motions,createMotionPlan(pieces));
 for(const m of motions){let last=1;for(let t=0;t<=BUILD_DURATION;t+=10){const r=remaining(m,t);assert.ok(r<=last+.000001&&r>=0);last=r;}
 const split=m.delay+m.duration*.94;assert.ok(Math.abs(remaining(m,split-0.001)-remaining(m,split+0.001))<.00001);assert.ok(Math.abs(remaining(m,split)*m.drop-.055)<.00001);}
});
test('foundation, walls, towers and crowns arrive in overlapping architectural waves',()=>{
 const mean=(lo,hi)=>{const ids=pieces.map((p,i)=>p.assemblyStage>=lo&&p.assemblyStage<=hi?i:-1).filter(i=>i>=0);return ids.reduce((s,i)=>s+motions[i].delay+motions[i].duration,0)/ids.length;};
 assert.ok(mean(0,16)<mean(20,35));assert.ok(mean(20,35)<mean(50,103));assert.ok(mean(50,103)<mean(110,117));
 // No long quiet interval between the first and last rain waves.
 for(let t=120;t<3300;t+=50)assert.ok(motions.some(m=>t>=m.delay&&t<=m.delay+m.duration),`gap at ${t}`);
});
test('rotation keeps one direction and cruises at constant speed before easing to zero',()=>{
 let previous=turnAngle(0);for(let t=10;t<=BUILD_DURATION;t+=10){const angle=turnAngle(t);assert.ok(angle>=previous);previous=angle;}
 assert.ok(Math.abs((turnAngle(1500)-turnAngle(1400))-(turnAngle(500)-turnAngle(400)))<1e-10);
 assert.ok(Math.abs(turnAngle(BUILD_DURATION-1))<.000001);
});
test('small sacred assemblies share a rigid trajectory without changing individual transforms',()=>{
 for(const group of ['main.lingam','secondary.lingam','vishnu.interior']){
 const indices=pieces.map((p,i)=>p.group===group?i:-1).filter(i=>i>=0);
 for(const i of indices)assert.deepEqual(motions[i],motions[indices[0]]);
 }
});


test('readable rain retains large standard pieces and reduces independent falling events',()=>{
 const groups=new Map(); motions.forEach(m=>groups.set(m,(groups.get(m)??0)+1));
 assert.equal(groups.size,531);assert.equal([...groups.values()].filter(n=>n===1).length,305);
 pieces.forEach((p,i)=>{const area=p.size[0]*p.size[2];if(p.structuralRole!=='sacred'&&p.catalogueId&&p.shape==='box'&&((area>=12&&p.size[1]>=1.2)||area>=48))assert.equal(groups.get(motions[i]),1);});
 assert.equal(Math.min(...motions.map(m=>m.delay)),0);
 for(const m of motions)assert.ok(m.drop>=22);
});
