import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COAST_START_MS, COAST_REVEAL_MS, COAST_TREE_SITES, coastReveal, coastTreeGrowth, coastAppearance, createCoastalLandscape } from '../src/temple/coastal-preview.ts';

test('landscape growth has a deterministic 4.5-second clock with no overshoot', () => {
  assert.equal(COAST_START_MS, 2000);
  assert.equal(COAST_REVEAL_MS, 4500);
  assert.equal(coastReveal(-20), 0);
  assert.equal(coastReveal(0), 0);
  assert.equal(coastReveal(2250), .5);
  assert.equal(coastReveal(4500), 1);
  assert.equal(coastReveal(5000), 1);
  let previous = 0;
  for (let t = 0; t <= 4500; t++) {
    const value = coastReveal(t);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
});

test('low coastal trees share the temple sun while the ground never casts shadows', () => {
  const coast = createCoastalLandscape();
  assert.equal(coast.group.name, 'coastal-preview');
  for (const mesh of coast.group.children) {
    assert.equal(mesh.castShadow, mesh.name !== 'sand');
    assert.equal(mesh.receiveShadow, true);
    assert.equal(mesh.material.opacity, 0);
    assert.equal(mesh.material.depthWrite, false);
    assert.ok([...mesh.geometry.getAttribute('position').array].every(Number.isFinite));
    mesh.geometry.computeBoundingBox();
    assert.ok(mesh.geometry.boundingBox.max.y * mesh.scale.y + mesh.position.y < 5.4);
  }
  coast.dispose();
});

test('continuous ground covers the view and only trees remain at the approved planting sites', () => {
  const coast = createCoastalLandscape();
  const meshes = coast.group.children;
  assert.equal(meshes.length,21);
  assert.deepEqual([...new Set(meshes.map(m=>m.name))], ['sand','tree-trunk','foliage','foliage-light']);
  const ground = meshes[0]; ground.geometry.computeBoundingBox();
  assert.ok(ground.geometry.boundingBox.min.x < -500 && ground.geometry.boundingBox.max.x > 500);
  assert.ok(ground.geometry.boundingBox.min.z < -500 && ground.geometry.boundingBox.max.z > 500);
  assert.deepEqual(COAST_TREE_SITES, [[-30,-27],[-22,-25.5],[24,-27],[33,-21]]);
  const c=1/Math.hypot(1,.6),s=.6/Math.hypot(1,.6);
  assert.deepEqual(coast.group.userData.treeAnchors,COAST_TREE_SITES.map(([x,z])=>[c*x+s*z,-s*x+c*z]));
  coast.setReveal(.05);
  assert.ok(meshes.slice(1).every(m=>!m.visible));
  coast.setReveal(.5);
  assert.ok(meshes.some(m=>m.name==='tree-trunk'&&m.visible&&m.scale.y<1));
  assert.ok(meshes[0].material.opacity>0&&meshes[0].material.opacity<1);
  coast.dispose();
});

test('coastal reveal resets completely and disposes each shared resource once', () => {
  const coast = createCoastalLandscape();
  const geometries = new Set(coast.group.children.map(m => m.geometry));
  const materials = new Set(coast.group.children.map(m => m.material));
  let disposed = 0;
  for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => disposed++);
  coast.setReveal(1);
  assert.equal(coast.group.visible, true);
  assert.ok([...materials].every(m => m.opacity === 1));
  coast.setReveal(0);
  assert.equal(coast.group.visible, false);
  assert.ok(coast.group.children.slice(1).every(m=>!m.visible));
  assert.equal(coast.group.children[0].material.opacity,0);
  coast.dispose();
  assert.equal(disposed, geometries.size + materials.size);
});

test('sand fades continuously before the sea and the final shoreline is unchanged', () => {
  assert.deepEqual(coastAppearance(0),{sand:0,sea:0,shoreWidth:24});
  assert.ok(coastAppearance(500).sand>0);assert.equal(coastAppearance(500).sea,0);
  assert.ok(Math.abs(coastAppearance(4500).shoreWidth-2.4)<1e-12);
  assert.equal(coastAppearance(4500).sand,1);assert.equal(coastAppearance(4500).sea,1);
  let previous=coastAppearance(0);
  for(let t=1;t<=4500;t++){
    const next=coastAppearance(t);assert.ok(next.sand>=previous.sand&&next.sea>=previous.sea);
    assert.ok(next.sand-previous.sand<.001&&next.sea-previous.sea<.001);
    assert.ok(next.shoreWidth<=previous.shoreWidth);previous=next;
  }
});

test('trees stagger independent upward growth, with supports preceding canopies and studs', () => {
  assert.notDeepEqual(coastTreeGrowth(0,2000),coastTreeGrowth(2,2000));
  for(let i=0;i<4;i++)for(let t=0;t<=4500;t+=10){
    const q=coastTreeGrowth(i,t),next=coastTreeGrowth(i,t+.01);
    for(const key of Object.keys(q)){assert.ok(Number.isFinite(q[key])&&q[key]>=0&&q[key]<=1);assert.ok(next[key]>=q[key]);assert.ok(next[key]-q[key]<.0001);}
    if(q.lower>0)assert.ok(q.trunk>0);
    if(q.upper>0)assert.ok(q.lower>0);
    if(q.studs>0)assert.ok(q.upper>0);
  }
  for(let i=0;i<4;i++)assert.deepEqual(coastTreeGrowth(i,4500),{trunk:1,lower:1,upper:1,studs:1});
});

test('tree parts grow from connected bases and restore exact final transforms on replay', () => {
  const coast=createCoastalLandscape();coast.setReveal(1);
  const final=coast.group.children.map(m=>[...m.position.toArray(),...m.scale.toArray()]);
  for(let i=0;i<4;i++){
    const parts=coast.group.children.slice(1+i*5,6+i*5);
    assert.deepEqual(parts.map(m=>m.position.y),[.6,1.35,1.98,2.38,2.38]);
  }
  for(let t=0;t<=4500;t+=30){
    coast.setReveal(coastReveal(t));
    for(let i=0;i<4;i++){
      const [stem,lower,upper,stud]=coast.group.children.slice(1+i*5,6+i*5);
      if(lower.visible)assert.ok(lower.position.y-.4*lower.scale.y<=stem.position.y+.6*stem.scale.y);
      if(upper.visible)assert.ok(upper.position.y-.325*upper.scale.y<=lower.position.y+.4*lower.scale.y);
      if(stud.visible)assert.ok(stud.position.y-.08*stud.scale.y<=upper.position.y+.325*upper.scale.y);
    }
  }
  coast.setReveal(0);coast.setReveal(1);
  assert.deepEqual(coast.group.children.map(m=>[...m.position.toArray(),...m.scale.toArray()]),final);
  coast.dispose();
});
