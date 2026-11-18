import { test } from 'node:test';
import assert from 'node:assert/strict';
import { borderPath, borderProgress, retractionOffset, RETRACTION_DURATION } from '../src/progress-border.ts';
import { createTempleDefinition } from '../src/temple/model.ts';
import { refineCollectible } from '../src/temple/refine-collectible.ts';
import { createFullConstruction, prominentLandings } from '../src/temple/full-construction.ts';

test('border path traverses top, right, bottom and left, closing four clockwise corners', () => {
  const d = borderPath(1200, 740);
  assert.equal(d, 'M 10 .5 H 1190 A 9.5 9.5 0 0 1 1199.5 10 V 730 A 9.5 9.5 0 0 1 1190 739.5 H 10 A 9.5 9.5 0 0 1 .5 730 V 10 A 9.5 9.5 0 0 1 10 .5 Z');
});

test('border completes on the approved final lock and resets deterministically on replay', () => {
  const events = createFullConstruction(refineCollectible(createTempleDefinition()).pieces);
  const lastLock = Math.max(...prominentLandings(events).map(m => m.settled));
  assert.equal(lastLock, Math.max(...events.map(m => m.settled)));
  assert.ok(lastLock < 5000);
  assert.equal(borderProgress(0, lastLock), 0);
  assert.equal(borderProgress(lastLock / 2, lastLock), .5);
  assert.ok(borderProgress(lastLock - 1, lastLock) < 1);
  assert.equal(borderProgress(lastLock, lastLock), 1);
  assert.equal(borderProgress(5000, lastLock), 1);
  assert.equal(borderProgress(0, lastLock), 0);
});

test('connected segments form precise bottom-edge detours, right to left, without entering the render area',()=>{
  const segments=[{left:16,right:254,bottom:654},{left:790,right:984,bottom:654}],before=JSON.stringify(segments);
  const d=borderPath(1000,618,segments);
  assert.ok(d.includes('H 983.5 V 653.5 H 790.5 V 617.5 H 253.5 V 653.5 H 16.5 V 617.5 H 10'));
  assert.equal((d.match(/ M /g)||[]).length,0);assert.equal(d.endsWith(' Z'),true);
  assert.equal(JSON.stringify(segments),before);
  assert.throws(()=>borderPath(1000,618,[{left:16,right:300,bottom:654},{left:250,right:500,bottom:654}]),/overlap/);
  assert.equal(borderPath(1000,618,[{left:16,right:254,bottom:618}]),borderPath(1000,618));
});

test('retraction erases from the clockwise endpoint back to the start in 300 ms', () => {
  assert.equal(RETRACTION_DURATION, 300);
  assert.equal(retractionOffset(0), 0);
  assert.equal(retractionOffset(150), .5);
  assert.equal(retractionOffset(300), 1);
  assert.equal(retractionOffset(1000), 1);
  let previous = 0;
  for (let t = 0; t <= 300; t++) {
    const offset = retractionOffset(t);
    assert.ok(offset >= previous && offset <= 1);
    previous = offset;
  }
  assert.ok(retractionOffset(1) < .001);
  assert.ok(retractionOffset(299) > .999);
});

test('three upward control cutouts interlock separately with the lower edge',()=>{
 const d=borderPath(1000,618,[{left:16,right:142,top:582,bottom:618},{left:154,right:266,top:582,bottom:618},{left:790,right:984,top:582,bottom:618}]);
 assert.ok(d.includes('H 983.5 V 582.5 H 790.5 V 617.5 H 265.5 V 582.5 H 154.5 V 617.5 H 141.5 V 582.5 H 16.5 V 617.5'));
 assert.equal((d.match(/M/g)||[]).length,1);assert.ok(d.endsWith('Z'));
});

test('rounded control shoulders retain one continuous closed border without changing its clock',()=>{
 const segments=[{left:28,right:114.6,top:582,bottom:618,topRadius:3.5},{left:126.6,right:226.2,top:582,bottom:618,topRadius:3.5}];
 const d=borderPath(1000,618,segments);
 assert.ok(d.includes('H 225.7 V 586 A 3.5 3.5 0 0 0 222.2 582.5 H 130.6 A 3.5 3.5 0 0 0 127.1 586 V 617.5'));
 assert.equal((d.match(/M/g)||[]).length,1);assert.ok(d.endsWith('Z'));
 assert.ok(!borderPath(1000,618,[{left:28,right:32,top:616,bottom:618,topRadius:20}]).includes('NaN'));
 assert.equal(borderProgress(5000,4900),1);
});
