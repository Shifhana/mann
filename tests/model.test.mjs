import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTempleDefinition, LAYOUT, sectionMembership } from '../src/temple/model.ts';
import { partGeometry, disposeGeometries } from '../src/temple/geometry.ts';

const model = createTempleDefinition();
function bounds(piece) {
  const [w, h, d] = piece.size;
  const c = Math.abs(Math.cos(piece.rotationY)), s = Math.abs(Math.sin(piece.rotationY));
  const half = [(w*c + d*s)/2, h/2, (w*s + d*c)/2];
  return { min: piece.position.map((v,i) => v-half[i]), max: piece.position.map((v,i) => v+half[i]) };
}
const intersects = (a, b) => a.min.every((v,i) => v < b.max[i] - .001 && a.max[i] > b.min[i] + .001);

test('three offset shrine spaces retain the documented entrance directions', () => {
  assert.equal(model.chambers.length, 3);
  assert.deepEqual(model.chambers.map(c => c.entrance), ['east', 'west', 'east']);
  assert.ok(LAYOUT.secondary.x < LAYOUT.vishnu.x && LAYOUT.vishnu.x < LAYOUT.main.x);
  assert.notEqual(LAYOUT.secondary.z, LAYOUT.main.z);
  assert.equal(model.pieces.filter(p => p.group.startsWith('vishnu.tier')).length, 0);
});

test('sanctums and connecting chamber contain real masonry-free interior volumes', () => {
  for (const chamber of model.chambers) {
    const [x,z] = chamber.center, [w,d] = chamber.clearSize;
    const interior = { min: [x-w/2+.05,chamber.floorY+.05,z-d/2+.05], max: [x+w/2-.05,chamber.ceilingY-.05,z+d/2-.05] };
    for (const p of model.pieces.filter(p => p.structuralRole === 'wall' || p.structuralRole === 'roof')) {
      assert.ok(!intersects(bounds(p), interior), `${p.id} blocks ${chamber.name}'s chamber`);
    }
  }
});

test('each doorway provides an uninterrupted passage through the wall thickness', () => {
  for (const chamber of model.chambers) {
    const s = LAYOUT[chamber.name];
    const sign = chamber.entrance === 'east' ? 1 : -1;
    const x0 = s.x + sign * (s.width/2 - s.wall), x1 = s.x + sign * s.width/2;
    const passage = { min: [Math.min(x0,x1),s.floor+.05,s.z-1.25], max: [Math.max(x0,x1),s.floor+3.2,s.z+1.25] };
    for (const p of model.pieces.filter(p => p.structuralRole === 'wall')) {
      assert.ok(!intersects(bounds(p), passage), `${p.id} blocks ${chamber.name}'s entrance`);
    }
  }
});

test('piece identity and final transforms are deterministic, finite, and usable for animation', () => {
  const again = createTempleDefinition();
  assert.deepEqual(model, again);
  assert.equal(new Set(model.pieces.map(p => p.id)).size, model.pieces.length);
  for (const p of model.pieces) {
    assert.ok([...p.position,...p.size,p.rotationY].every(Number.isFinite), p.id);
    assert.ok(p.size.every(v => v > 0), p.id);
    assert.ok(Number.isInteger(p.assemblyStage) && p.assemblyStage >= 0, p.id);
    assert.ok(bounds(p).min[1] >= -.001, p.id);
  }
});

test('stepped section follows all three chambers without realigning their footprints', () => {
  assert.equal(model.sectionPath.length, 3);
  for (const chamber of model.chambers) {
    const path = model.sectionPath.find(p => chamber.center[0] >= p.fromX && chamber.center[0] < p.toX);
    assert.equal(path?.z, chamber.center[1]);
  }
  assert.equal(sectionMembership(8,-1,2,2), 'retained');
  assert.equal(sectionMembership(8,5,2,2), 'near-side');
  assert.equal(sectionMembership(8,2,2,2), 'crossing');
  assert.equal(sectionMembership(-17,0,4,1), 'crossing');
});

test('both towers contain substantial masonry above the chamber ceilings', () => {
  for (const name of ['main','secondary']) {
    const cores = model.pieces.filter(p => p.group.startsWith(`${name}.tier-`) && p.group.endsWith('.core'));
    assert.ok(cores.length > 0);
    assert.ok(cores.every(p => bounds(p).min[1] > LAYOUT[name].ceiling));
  }
  const mainTop = Math.max(...model.pieces.filter(p=>p.group.startsWith('main.')).map(p=>bounds(p).max[1]));
  const secondaryTop = Math.max(...model.pieces.filter(p=>p.group.startsWith('secondary.')).map(p=>bounds(p).max[1]));
  assert.ok(mainTop > secondaryTop * 1.6);
});

test('every unique part generates valid closed-form geometry with finite normals', () => {
  const seen = new Set();
  for (const p of model.pieces) {
    const key = `${p.shape}:${p.size}:${p.studs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const geometry = partGeometry(p);
    assert.ok(geometry.attributes.position.count > 0, p.id);
    for (const a of ['position','normal']) assert.ok(geometry.attributes[a].array.every(Number.isFinite), `${p.id}: ${a}`);
    assert.ok(geometry.boundingSphere?.radius > 0, p.id);
  }
  assert.equal(new Set(model.pieces.map(p=>p.material)).size, 4);
  disposeGeometries();
});
