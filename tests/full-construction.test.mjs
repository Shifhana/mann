import {test} from 'node:test';import assert from 'node:assert/strict';
import{createTempleDefinition}from'../src/temple/model.ts';
import{createFullConstruction,prominentLandings,CONSTRUCTION_GRAVITY}from'../src/temple/full-construction.ts';
import{landingOffset,prototypeAngle}from'../src/temple/landing-prototype.ts';
const ps=createTempleDefinition().pieces,baseline=JSON.stringify(ps),events=createFullConstruction(ps),byId=new Map(events.map(e=>[e.pieceId,e]));
test('full preview preserves all 2145 independent parts and deterministic transforms',()=>{
 assert.equal(events.length,2145);assert.equal(new Set(events).size,2145);assert.equal(byId.size,2145);assert.equal(JSON.stringify(ps),baseline);assert.deepEqual(events,createFullConstruction(ps));
 for(const m of events){assert.ok(m.delay>=0);assert.ok(m.settled>m.contact&&m.settled-m.contact<=81);assert.equal(landingOffset(m,m.contact),0);assert.equal(landingOffset(m,m.settled),0);assert.ok(Math.abs(2*m.drop/((m.contact-m.delay)/1000)**2-CONSTRUCTION_GRAVITY)<.0001);}
});
test('overlapping footprints arrive lower first; no upper completed part obstructs descent',()=>{
 const half=p=>{let c=Math.abs(Math.cos(p.rotationY)),s=Math.abs(Math.sin(p.rotationY));return[(p.size[0]*c+p.size[2]*s)/2,(p.size[0]*s+p.size[2]*c)/2];};
 for(const p of ps){const a=half(p);for(const q of ps){if(q.position[1]>=p.position[1]-.01)continue;const b=half(q);if(Math.abs(p.position[0]-q.position[0])<a[0]+b[0]-.045&&Math.abs(p.position[2]-q.position[2])<a[1]+b[1]-.045)assert.ok(byId.get(p.id).contact>=byId.get(q.id).settled+7.99);}}
});
test('parallel five-second choreography, exact final pose and sparse actual-landing audio',()=>{
 const duration=Math.ceil(Math.max(...events.map(e=>e.settled))+80);assert.ok(duration>=4700&&duration<=5100);assert.ok(events.every(m=>landingOffset(m,duration)===0));assert.equal(prototypeAngle(duration,duration),0);
 let peak=0;for(let t=0;t<duration;t+=20)peak=Math.max(peak,events.filter(m=>t>=m.delay&&t<m.settled).length);assert.ok(peak<600);assert.ok(events.filter(e=>e.prominent).length>=20);
 const clicks=prominentLandings(events);assert.ok(clicks.length>=25&&clicks.length<=50);assert.ok(clicks.every(e=>byId.get(e.pieceId)===e));
});

test('simultaneous independent regions replace the global serial cursor',()=>{
 const firstSecond=events.filter(e=>e.contact<1200);assert.ok(firstSecond.length>100);
 const positions=new Map(ps.map(p=>[p.id,p.position]));assert.ok(firstSecond.some(e=>positions.get(e.pieceId)[0]<-10));assert.ok(firstSecond.some(e=>positions.get(e.pieceId)[0]>5));
 for(const m of events){const flight=(m.contact-m.delay)/1000,seat=(m.settled-m.contact)/1000;assert.ok(Math.abs(m.bounceHeight-CONSTRUCTION_GRAVITY*seat*seat/8)<.00001);assert.ok(m.entryFadeMs ? flight>=.10&&flight<.23 : flight>.3);}
});
