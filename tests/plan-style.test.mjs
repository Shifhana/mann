import {test} from 'node:test';import assert from 'node:assert/strict';import {Color} from 'three';
import {createTempleDefinition} from '../src/temple/model.ts';import {refineCollectible} from '../src/temple/refine-collectible.ts';
import {CUT_FILL,CUT_EDGE,CUT_BASE,MAX_PLAN_CONTACT,createPlanDepthZones,planFloorContact,planEmphasis} from '../src/temple/plan-style.ts';
import {createCoastalLandscape} from '../src/temple/coastal-preview.ts';import {createPlanView} from '../src/temple/plan-view.ts';import {PLAN_CUT_HEIGHT} from '../src/temple/plan-timeline.ts';
const definition=refineCollectible(createTempleDefinition()),zones=createPlanDepthZones(definition);

test('cut-face palette is a distinct warm brown between sandstone and restrained edge ink',()=>{
 const lum=hex=>{const c=new Color(hex);return .2126*c.r+.7152*c.g+.0722*c.b;};assert.ok(lum(CUT_EDGE)>.06);assert.ok(lum(CUT_EDGE)<lum(CUT_FILL));assert.ok(lum(CUT_FILL)<lum(CUT_BASE)*.8);assert.ok(lum(CUT_FILL)>.12);
});
test('contact depth is limited to existing chamber floors and fades towards the middle',()=>{
 const z=zones.find(z=>z.name==='main'),near=planFloorContact(z,3.1,4,-2.9),middle=planFloorContact(z,8,4,2);assert.ok(near>.1&&near<=MAX_PLAN_CONTACT);assert.ok(middle<.001);assert.equal(planFloorContact(z,2.9,4,2),0);assert.equal(planFloorContact(z,3.1,4.5,-2.9),0);
});
test('real entrance axes and both passage ends remain open and unmarked by artificial floor shadow lines',()=>{
 for(const name of ['main','secondary','vishnu']){const z=zones.find(z=>z.name===name),doorX=z.door==='west'?z.x0+.05:z.x1-.05,other=z.door==='west'?z.x1-.05:z.x0+.05,depth=(z.doorMin+z.doorMax)/2;assert.ok(planFloorContact(z,doorX,z.floor,depth)<.01,name+' doorway shadow');assert.ok(planFloorContact(z,other,z.floor,depth)>.08,name+' closed wall');}
 const p=zones.find(z=>z.name==='main-porch');assert.ok(Math.abs(p.x0-17)<1e-8&&Math.abs(p.x1-25)<1e-8);assert.equal(p.z0,0);assert.equal(p.z1,4);assert.equal(planFloorContact(p,p.x0+.02,p.floor,2),planFloorContact(p,(p.x0+p.x1)/2,p.floor,2));
});
test('section mode quietens foliage without touching placement, reveal opacity or sand and restores exact colours',()=>{
 const c=createCoastalLandscape();c.setReveal(1);const pose=c.group.children.map(m=>({p:m.position.toArray(),s:m.scale.toArray(),visible:m.visible,opacity:m.material.opacity})),colors=c.group.children.map(m=>m.material.color.toArray());c.setPlanEmphasis(1);assert.deepEqual(c.group.children.map(m=>({p:m.position.toArray(),s:m.scale.toArray(),visible:m.visible,opacity:m.material.opacity})),pose);assert.deepEqual(c.group.children[0].material.color.toArray(),colors[0]);assert.notDeepEqual(c.group.children.find(m=>m.name==='foliage').material.color.toArray(),colors[c.group.children.findIndex(m=>m.name==='foliage')]);c.setPlanEmphasis(0);assert.deepEqual(c.group.children.map(m=>m.material.color.toArray()),colors);c.dispose();
});
test('depth and surrounding emphasis share the existing hover clock and reset to exact exterior values',()=>{
 const p=createPlanView(definition),s={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>\n#include <color_fragment>'};p.patchShader(s);assert.equal(s.uniforms.planDepthStrength.value,0);p.setRevealed(true,0,true);p.update(0);assert.equal(p.emphasis,1);assert.equal(s.uniforms.planDepthStrength.value,1);assert.ok(s.fragmentShader.includes('if(planDepthStrength>0.0)'));assert.ok(s.fragmentShader.includes('doorway'));const g=p.group.children[0].geometry;assert.ok([...g.getAttribute('cutImportance').array].includes(.44999998807907104));for(let i=0;i<g.getAttribute('position').count;i++)assert.equal(g.getAttribute('position').getY(i),PLAN_CUT_HEIGHT);p.reset();p.update(1);assert.equal(p.emphasis,0);assert.equal(s.uniforms.planDepthStrength.value,0);for(const v of [-1,0,.25,.5,.75,1,2])assert.ok(planEmphasis(v)>=0&&planEmphasis(v)<=1);p.dispose();
});
