import { test } from 'node:test';
import assert from 'node:assert/strict';
import { borderPath, borderProgress } from '../src/progress-border.ts';
import { createTempleDefinition } from '../src/temple/model.ts';
import { refineCollectible } from '../src/temple/refine-collectible.ts';
import { createFullConstruction, prominentLandings } from '../src/temple/full-construction.ts';

test('border path traverses top, right, bottom and left, closing four clockwise corners', () => {
  const d = borderPath(1200, 740);
  assert.equal(d, 'M 9.5 .5 H 1190.5 A 9 9 0 0 1 1199.5 9.5 V 730.5 A 9 9 0 0 1 1190.5 739.5 H 9.5 A 9 9 0 0 1 .5 730.5 V 9.5 A 9 9 0 0 1 9.5 .5 Z');
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
