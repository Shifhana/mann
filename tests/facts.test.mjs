import {test} from 'node:test';import assert from 'node:assert/strict';
import {tickerDuration,TICKER_SPEED} from '../src/facts.ts';
test('ticker preserves a slow constant speed across actual strip lengths',()=>{
 assert.equal(TICKER_SPEED,12);for(const width of [960,1440,2400])assert.equal(width/(tickerDuration(width)/1000),12);
});
test('ticker duration is bounded for short, empty and invalid measurements',()=>{
 for(const width of [0,-1,NaN,Infinity,240])assert.equal(tickerDuration(width),60000);
 assert.equal(tickerDuration(1440),120000);
});
