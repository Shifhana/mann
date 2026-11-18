import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OrthographicCamera,Vector3,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {seaCoverage,SeaWaveTimeline,WAVE_SETTLE_MS,createSeaWaves} from '../src/temple/sea-waves.ts';
import {createCoastalLandscape} from '../src/temple/coastal-preview.ts';

test('sea hover follows the curved water boundary and excludes sand',()=>{
  assert.equal(seaCoverage(0,-100),1);assert.equal(seaCoverage(0,0),0);
  for(let x=-70;x<=70;x+=5)for(let z=-100;z<=30;z+=5)assert.ok(seaCoverage(x,z)>=0&&seaCoverage(x,z)<=1);
});
test('wave envelope reverses continuously, settles at 800ms, freezes phase at rest and resets',()=>{
  const t=new SeaWaveTimeline();assert.equal(WAVE_SETTLE_MS,800);
  assert.equal(t.update(0),false);assert.equal(t.setHovered(true,10),true);assert.equal(t.strength,0);
  t.update(310);assert.ok(t.strength>.9&&t.strength<1);
  const atExit={strength:t.strength,velocity:t.velocity,phase:t.phase};t.setHovered(false,310);
  assert.equal(t.strength,atExit.strength);assert.equal(t.velocity,atExit.velocity);assert.equal(t.phase,atExit.phase);
  t.update(510);const before={strength:t.strength,velocity:t.velocity,phase:t.phase};t.setHovered(true,510);
  assert.equal(t.strength,before.strength);assert.equal(t.velocity,before.velocity);assert.equal(t.phase,before.phase);
  const old={...t};t.update(508);assert.deepEqual({...t},old);
  for(let now=526;now<1800;now+=16){t.update(now);assert.ok(t.strength>=0&&t.strength<=1);}
  assert.equal(t.strength,1);t.setHovered(false,1800);assert.equal(t.update(2599),true);assert.equal(t.update(2600),false);assert.equal(t.strength,0);
  const phase=t.phase;t.update(5000);assert.equal(t.phase,phase);
  t.setHovered(true,5000);assert.equal(t.phase,phase);t.update(5100);assert.ok(t.strength>0);
  t.reset();assert.equal(t.strength,0);assert.equal(t.phase,0);assert.equal(t.hovered,false);assert.equal(t.update(5200),false);
  assert.equal(t.setHovered(true,5300,true),false);assert.equal(t.strength,0);
});
test('wave timeline is independent of frame rate and bounded under rapid entry/exit',()=>{
  const a=new SeaWaveTimeline(),b=new SeaWaveTimeline();a.setHovered(true,0);b.setHovered(true,0);
  for(let t=8;t<=400;t+=8)a.update(t);b.update(400);assert.ok(Math.abs(a.strength-b.strength)<1e-12);assert.ok(Math.abs(a.phase-b.phase)<1e-12);
  for(let t=416;t<1500;t+=16){a.setHovered(t%64<32,t);assert.ok(a.strength>=0&&a.strength<=1);}
  a.setHovered(false,1500);a.update(2300);assert.equal(a.strength,0);
});
test('existing lit water shader is extended in place, restores exactly, and raycasting respects occlusion',()=>{
  const coast=createCoastalLandscape();coast.setReveal(1);coast.group.updateMatrixWorld(true);
  const camera=new OrthographicCamera(-90,90,90,-90,.1,400);camera.position.set(50,100,80);camera.lookAt(0,0,-50);camera.updateMatrixWorld(true);
  let blockers=[];const geometry=coast.surface.geometry,material=coast.surface.material,original=material.onBeforeCompile,key=material.customProgramCacheKey;
  const waves=createSeaWaves(coast.surface,camera,()=>blockers,()=>true);
  assert.equal(coast.group.children.length,21);assert.equal(coast.surface.geometry,geometry);assert.equal(coast.surface.material,material);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <normal_fragment_begin>\n#include <normal_fragment_maps>'};
  material.onBeforeCompile(shader);assert.equal(shader.uniforms.seaWaveStrength,waves.uniforms.seaWaveStrength);assert.match(shader.fragmentShader,/seaWaveStrength>0.0/);assert.match(shader.fragmentShader,/coastSeaAppearance/);
  const world=new Vector3(0,-.04,-72),v=world.clone().project(camera),x=(v.x+1)*500,y=(1-v.y)*400;
  assert.equal(waves.hit(x,y,1000,800),true);
  const wall=new Mesh(new BoxGeometry(4,4,4),new MeshBasicMaterial());wall.position.copy(world).addScaledVector(camera.getWorldDirection(new Vector3()),-10);wall.updateMatrixWorld(true);blockers=[wall];assert.equal(waves.hit(x,y,1000,800),false);blockers=[];
  coast.group.visible=false;assert.equal(waves.hit(x,y,1000,800),false);coast.group.visible=true;
  const land=new Vector3(0,-.04,0).project(camera);assert.equal(waves.hit((land.x+1)*500,(1-land.y)*400,1000,800),false);
  waves.hover(true,0,false);waves.update(500);assert.ok(waves.uniforms.seaWaveStrength.value>.99);waves.hover(false,500,false);assert.equal(waves.update(1300),false);assert.equal(waves.uniforms.seaWaveStrength.value,0);
  waves.hover(true,1400,true);assert.equal(waves.update(1500),false);waves.reset();assert.equal(waves.uniforms.seaWaveTime.value,0);
  waves.dispose();assert.equal(material.onBeforeCompile,original);assert.equal(material.customProgramCacheKey,key);wall.geometry.dispose();wall.material.dispose();coast.dispose();
});
