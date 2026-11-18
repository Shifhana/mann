import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Color} from 'three';
import {createTempleDefinition} from '../src/temple/model.ts';
import {refineCollectible} from '../src/temple/refine-collectible.ts';
import {createPlanView} from '../src/temple/plan-view.ts';
import {CUT_FILL} from '../src/temple/plan-style.ts';
import {PLAN_CUT_HEIGHT,PLAN_DURATION_MS} from '../src/temple/plan-timeline.ts';
import {INTERIOR_FLOOR,INTERIOR_THRESHOLD,createPlanInteriorRegions,interiorFloorWeight} from '../src/temple/plan-interiors.ts';
const model=refineCollectible(createTempleDefinition()),before=JSON.stringify(model),regions=createPlanInteriorRegions(model);

test('interior hierarchy follows the three original chambers and exact opposing threshold footprints',()=>{
 assert.equal(regions.filter(r=>r.kind==='chamber').length,3);
 const bounds=name=>{const r=regions.find(r=>r.name===name);return[r.x0,r.x1,r.z0,r.z1];};
 assert.deepEqual(bounds('main-threshold'),[13,17,0,4]);
 assert.deepEqual(bounds('secondary-threshold'),[-27,-24,-6,-2]);
 assert.deepEqual(bounds('vishnu-threshold'),[-11,-9,1,5]);
 assert.deepEqual(bounds('main-porch'),[17,25,0,4]);
 assert.ok(regions.every(r=>!(-5>r.x0&&-5<r.x1&&3>r.z0&&3<r.z1)),'no invented link across the closed junction/court');
 assert.equal(JSON.stringify(model),before);assert.equal(model.pieces.length,1911);
});

test('floor emphasis is confined to upward existing surfaces; real level changes remain distinct',()=>{
 for(const r of regions){
  const x=(r.x0+r.x1)/2,z=(r.z0+r.z1)/2;
  assert.ok(r.levels.length>0,r.name);
  for(const y of r.levels){assert.equal(interiorFloorWeight(r,x,y-.0125,z,1),1);assert.equal(interiorFloorWeight(r,x,y,z,0),0);assert.equal(interiorFloorWeight(r,x,y,z,-1),0);assert.equal(interiorFloorWeight(r,r.x1+.1,y,z,1),0);}
  assert.equal(interiorFloorWeight(r,x,PLAN_CUT_HEIGHT,z,1),0);
 }
 const v=regions.find(r=>r.name==='vishnu');assert.deepEqual(v.levels,[2.8,3.6]);assert.equal(interiorFloorWeight(v,-14.5,3.2,4,1),0);
});

test('chamber floors, sandstone thresholds and brown cut masonry retain distinct tonal hierarchy',()=>{
 const lum=s=>{const c=new Color(s);return .2126*c.r+.7152*c.g+.0722*c.b;};
 assert.ok(lum(INTERIOR_FLOOR)>lum(INTERIOR_THRESHOLD));assert.ok(lum(INTERIOR_THRESHOLD)>lum(CUT_FILL));
 assert.equal(PLAN_CUT_HEIGHT,5);assert.equal(PLAN_DURATION_MS,500);
});

test('interior colour and fill share hover strength, exclude furnishings, and reset without changing source materials or geometry',()=>{
 const p=createPlanView(model),s={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>\n#include <color_fragment>\n#include <lights_fragment_end>'};
 p.patchShader(s);assert.equal(s.uniforms.planDepthStrength.value,0);
 assert.ok(s.vertexShader.includes('mat3(instanceMatrix)*normal'));assert.ok(!s.vertexShader.includes('objectNormal);'));
 assert.ok(s.fragmentShader.includes('if(vPlanEligible>.5 && edge>=0.0)'));assert.ok(s.fragmentShader.includes('reflectedLight.indirectDiffuse+=diffuseColor.rgb*planInteriorFill'));
 const cap=p.group.children[0],material=cap.material,originalColour=material.color.toArray();p.setRevealed(true,0,true);p.update(0);
 const positions=Array.from(cap.geometry.getAttribute('position').array);assert.equal(s.uniforms.planDepthStrength.value,1);
 p.reset();p.update(1);assert.equal(s.uniforms.planDepthStrength.value,0);assert.deepEqual(material.color.toArray(),originalColour);
 p.setRevealed(true,2,true);p.update(2);assert.deepEqual(Array.from(cap.geometry.getAttribute('position').array),positions);
 assert.equal(JSON.stringify(model),before);p.dispose();
});
