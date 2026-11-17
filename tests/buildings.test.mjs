import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCoordinates } from '../src/buildings.ts';

test('postcard coordinates format supplied building metadata with consistent DMS and hemispheres', () => {
  assert.equal(formatCoordinates({latitude:12.6170, longitude:80.1998}), '12°37′01″N 80°11′59″E');
  assert.equal(formatCoordinates({latitude:-33.8568, longitude:-151.2153}), '33°51′24″S 151°12′55″W');
  assert.equal(formatCoordinates({latitude:0, longitude:0}), '0°00′00″N 0°00′00″E');
});

test('whole-second rounding carries through minutes and degrees without invalid 60 values', () => {
  assert.equal(formatCoordinates({latitude:12.999999, longitude:-179.999999}), '13°00′00″N 180°00′00″W');
  assert.equal(formatCoordinates({latitude:-90, longitude:180}), '90°00′00″S 180°00′00″E');
});

test('invalid geographic metadata is rejected instead of printing misleading coordinates', () => {
  for (const latitude of [NaN, Infinity, -91, 91]) assert.throws(() => formatCoordinates({latitude,longitude:0}), RangeError);
  for (const longitude of [NaN, -Infinity, -181, 181]) assert.throws(() => formatCoordinates({latitude:0,longitude}), RangeError);
});
