import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTempleDefinition} from '../src/temple/model.ts';
import {refineCollectible} from '../src/temple/refine-collectible.ts';
import {humanSites,humanPose,humanWalkPoint} from '../src/temple/human-navigation.ts';
const definition=refineCollectible(createTempleDefinition()),sites=humanSites(definition);
const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

test('rounded walking corners preserve position, tangent, pace and the shared distance/foot clock',()=>{
 for(const site of sites){
  assert.ok(site.motion.some(m=>m.curve),'each route has a real rounded corner');
  for(let i=0;i<site.motion.length;i++){
   const m=site.motion[i],next=site.motion[i+1];if(m.kind!=='walk')continue;
   if(next?.kind==='walk'){
    const a=humanWalkPoint(site,m.run,m.distance+m.length),b=humanWalkPoint(site,next.run,next.distance+.000001);
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.00001);assert.ok(Math.abs(angle(a.yaw,b.yaw))<.0001);
    const before=humanPose(site,0,m.end-8),after=humanPose(site,0,m.end+8);
    assert.ok(before.walk>.99&&after.walk>.99,'no braking/restarting at a continuous corner');
    assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.8*m.speed*16);
   }
   for(let t=m.start+16;t<m.end;t+=16){const p=humanPose(site,0,t),q=humanPose(site,0,t-16),delta=Math.hypot(p.x-q.x,p.z-q.z);assert.ok(delta<.022);assert.ok(Math.abs(angle(q.yaw,p.yaw))<.10,`${site.id} ${i} at ${t}: ${q.yaw} → ${p.yaw}`);assert.ok((p.x-q.x)*Math.sin(p.yaw)+(p.z-q.z)*Math.cos(p.yaw)>=-1e-7,'always faces forward');}
  }
 }
});

test('visitors reach genuine shrine-room perimeter space and arrivals continue deeper through the east portal',()=>{
 for(const site of sites.filter(s=>s.chamber&&s.chamber!=='main')){
  const c=definition.chambers.find(c=>c.name===site.chamber),points=[];
  for(let t=0;t<=site.duration;t+=32){const p=humanPose(site,0,t);if(p.x>c.center[0]-c.clearSize[0]/2&&p.x<c.center[0]+c.clearSize[0]/2&&p.z>c.center[1]-c.clearSize[1]/2&&p.z<c.center[1]+c.clearSize[1]/2)points.push(p);}
  assert.ok(points.length>100,`${site.id} must spend meaningful time beyond its doorway`);
  assert.ok(Math.max(...points.map(p=>p.z))-Math.min(...points.map(p=>p.z))>2.8,`${site.id} reaches along the real room rather than circling only the threshold`);
 }
 const main=sites.find(s=>s.chamber==='main');for(let t=0;t<main.duration;t+=32){const p=humanPose(main,3,t);assert.ok(p.y===4&&p.z>=8.45&&p.z<=14&&p.x>=3.2&&p.x<=20.3,'main observer stays on the existing open south/east court');}
 const ends=sites.slice(0,3).map((s,i)=>humanPose(s,i,s.duration));assert.ok(ends.every(p=>p.x<20&&p.z>0&&p.z<4),'arrivals cross the real studded porch strip, well beyond the east portal');
 assert.equal(new Set(ends.map(p=>p.z)).size,3,'separate lanes inside the porch');
 assert.ok(sites[2].motion.some(m=>m.to[0]>30&&m.to[1]===3.6),'one arrival explores the real entrance steps');
 for(const site of sites.slice(3))assert.ok(site.motion.some(m=>m.kind==='pause'&&m.end-m.start>=2000),'observation pauses before the shrines');
});

test('figures retain approved appearance data and independent, deterministic routes',()=>{
 const again=humanSites(definition);assert.deepEqual(again,sites);
 assert.deepEqual(sites.map(s=>[s.scale,s.shirt]),[[.96,'#9B7C64'],[.94,'#758B8B'],[.95,'#8E9478'],[.94,'#A18A6E'],[.90,'#7C8B78'],[.90,'#958374']]);
 assert.equal(new Set(sites.map(s=>Math.round(s.duration))).size,6);
});
