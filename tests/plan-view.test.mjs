import {test} from 'node:test';import assert from 'node:assert/strict';
import {OrthographicCamera} from 'three';
import {createTempleDefinition,LAYOUT} from '../src/temple/model.ts';
import {refineCollectible} from '../src/temple/refine-collectible.ts';
import {createPlanSolids,planFaces,planEligible,createPlanView} from '../src/temple/plan-view.ts';
import {PLAN_CUT_HEIGHT,PLAN_START_HEIGHT,PLAN_DURATION_MS,PlanTimeline,planCutHeight} from '../src/temple/plan-timeline.ts';
import {createHoverRegion,createTempleHoverRegion} from '../src/temple/plan-hover.ts';
const model=refineCollectible(createTempleDefinition()),before=JSON.stringify(model),solids=createPlanSolids(model.pieces),byId=new Map(model.pieces.map(p=>[p.id,p]));

test('hover plan preserves all 1911 pieces, three chambers and opposing actual entrances',()=>{
 assert.equal(model.pieces.length,1911);assert.deepEqual(model.chambers.map(c=>c.entrance),['east','west','east']);assert.equal(JSON.stringify(model),before);
 for(const p of model.pieces)assert.equal(planEligible(p),p.structuralRole!=='sacred');
 for(const name of ['main','secondary','vishnu'])assert.ok(solids.some(s=>s.pieceId.startsWith(name+'.wall')));
});
test('lower fixed-camera cut retains real lower walls, floors and every doorway opening',()=>{
 assert.equal(PLAN_CUT_HEIGHT,5.0);
 for(const[name,s]of Object.entries(LAYOUT)){
  assert.ok(PLAN_CUT_HEIGHT>s.floor+.5);assert.ok(PLAN_CUT_HEIGHT<s.ceiling);assert.ok(PLAN_CUT_HEIGHT<s.floor+(name==='vishnu'?3.6:4.8));
  const doorX=name==='secondary'?s.x-s.width/2:s.x+s.width/2;
  for(const p of model.pieces.filter(p=>p.group===name+'.wall')){
   if(p.position[1]-p.size[1]/2>=PLAN_CUT_HEIGHT)continue;
   const c=Math.abs(Math.cos(p.rotationY)),sn=Math.abs(Math.sin(p.rotationY)),hw=(p.size[0]*c+p.size[2]*sn)/2,hd=(p.size[2]*c+p.size[0]*sn)/2;
   assert.ok(!(doorX>p.position[0]-hw&&doorX<p.position[0]+hw&&s.z>p.position[2]-hd&&s.z<p.position[2]+hd),p.id+' blocks door');
  }
 }
});
test('500 ms hover transitions are deterministic; repeated hover does not restart the clock',()=>{
 const t=new PlanTimeline();assert.equal(PLAN_DURATION_MS,500);assert.equal(t.setRevealed(true,100),true);assert.equal(t.setRevealed(true,200),false);
 let previous=PLAN_START_HEIGHT;for(let at=200;at<=600;at++){t.update(at);const h=planCutHeight(t.progress);assert.ok(h<=previous&&h>=PLAN_CUT_HEIGHT);previous=h;}
 assert.equal(t.progress,1);assert.equal(t.animating,false);assert.equal(planCutHeight(t.progress),PLAN_CUT_HEIGHT);
 t.setRevealed(false,1000);t.update(1500);assert.equal(t.progress,0);assert.equal(planCutHeight(t.progress),PLAN_START_HEIGHT);
});
test('leaving/re-entering during a transition reverses continuously without jumps or overlapping clocks',()=>{
 const t=new PlanTimeline();t.setRevealed(true,0);t.update(200);const cut=planCutHeight(t.progress);assert.equal(t.progress,.4);
 t.setRevealed(false,200);assert.equal(planCutHeight(t.progress),cut);t.update(250);assert.ok(t.progress<.4&&t.progress>0);
 const partial=planCutHeight(t.progress);t.setRevealed(true,250);assert.equal(planCutHeight(t.progress),partial);t.update(1000);assert.equal(t.progress,1);
 t.setRevealed(false,1100,true);assert.equal(t.progress,0);assert.equal(t.animating,false);t.setRevealed(true,1200);t.reset();assert.equal(t.progress,0);assert.equal(t.target,0);assert.equal(t.animating,false);
});
test('immutable interaction envelope includes seams/voids and uses only a small exit hysteresis',()=>{
 const r=createHoverRegion([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100},{x:40,y:40},{x:60,y:60}],12);
 for(const[x,y]of [[1,1],[50,50],[99,50],[25,75]])assert.equal(r.contains(x,y),true);
 assert.equal(r.contains(106,50,false),false);assert.equal(r.contains(106,50,true),true);assert.equal(r.contains(113,50,true),false);assert.equal(r.contains(0,-13,true),false);
});
test('camera, projection and model remain bit-identical for every hover animation sample',()=>{
 const camera=new OrthographicCamera(-75,75,45,-45,.1,400);camera.position.set(51.4575546192,71.4940637026,79.5959243653);camera.lookAt(5.1,8.4,2.3);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
 const state=()=>JSON.stringify({world:camera.matrixWorld.toArray(),inverse:camera.matrixWorldInverse.toArray(),projection:camera.projectionMatrix.toArray(),position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),zoom:camera.zoom});const original=state();
 const r=createTempleHoverRegion(model,camera,1600,1000),p=createPlanView(model);p.fitInteraction(camera,1600,1000);const center={x:r.polygon.reduce((s,v)=>s+v.x,0)/r.polygon.length,y:r.polygon.reduce((s,v)=>s+v.y,0)/r.polygon.length};
 p.setRevealed(true,0,false);for(let t=0;t<=500;t+=20){p.update(t);assert.equal(p.containsPointer(center.x,center.y,true),true);assert.equal(state(),original);}
 p.setRevealed(false,600,false);for(let t=600;t<=1100;t+=20){p.update(t);assert.equal(state(),original);}assert.equal(JSON.stringify(model),before);p.dispose();
});
test('poche caps are upward, coplanar, closed polygons and preserve all three chamber voids',()=>{
 assert.equal(planFaces(solids,PLAN_START_HEIGHT).length,0);
 for(const height of [PLAN_CUT_HEIGHT,7.13,8.27,12.35,18.91,32.17]){
  const faces=planFaces(solids,height);assert.ok(faces.length);
  for(const f of faces){assert.ok(planEligible(byId.get(f.pieceId)));assert.ok(f.polygon.length>=3);for(const v of f.polygon){assert.ok(v.every(Number.isFinite));assert.equal(v[1],height);}
   const[a,b,c]=f.polygon,ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);assert.ok(ny>0,f.pieceId+' downward cap');
   const x=f.polygon.reduce((s,v)=>s+v[0],0)/f.polygon.length,z=f.polygon.reduce((s,v)=>s+v[2],0)/f.polygon.length;
   for(const chamber of model.chambers)if(height>chamber.floorY&&height<chamber.ceilingY)assert.ok(!(Math.abs(x-chamber.center[0])<chamber.clearSize[0]/2-.05&&Math.abs(z-chamber.center[1])<chamber.clearSize[1]/2-.05),f.pieceId+' fills '+chamber.name);
  }
  if(height===PLAN_CUT_HEIGHT)for(const name of ['main','secondary','vishnu'])assert.ok(faces.some(f=>f.pieceId.startsWith(name+'.wall')));
 }
});
test('only actual cut caps receive the dark poche; colour/depth masks agree and reset restores exterior',()=>{
 const p=createPlanView(model),shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};p.patchShader(shader);assert.ok(shader.fragmentShader.includes('vPlanY > planHeight'));assert.ok(!shader.fragmentShader.includes('cutZ'));
 p.setRevealed(true,10,true);p.update(10);assert.equal(shader.uniforms.planActive.value,1);assert.equal(shader.uniforms.planHeight.value,PLAN_CUT_HEIGHT);
 const cap=p.group.children[0];assert.equal(cap.material.color.getHexString(),'9c7350');assert.equal(p.group.children.length,1);assert.equal(cap.name,'section-poche');assert.ok([...cap.geometry.getAttribute('normal').array].every((n,i)=>n===(i%3===1?1:0)));
 p.reset();p.update(20);assert.equal(shader.uniforms.planActive.value,0);assert.equal(p.group.visible,false);assert.equal(JSON.stringify(model),before);p.dispose();
});
