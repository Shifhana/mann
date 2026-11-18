import {test} from 'node:test';import assert from 'node:assert/strict';
import {tickerDuration,TICKER_SPEED} from '../src/facts.ts';
test('ticker runs at 1.75 times the approved old speed for every valid strip length',()=>{
 assert.equal(TICKER_SPEED,12*1.75);for(const width of [240,960,1440,2400,4000])assert.equal(width/(tickerDuration(width)/1000),21);
});
test('ticker duration is bounded for short, empty and invalid measurements',()=>{
 for(const width of [0,-1,NaN,Infinity])assert.equal(tickerDuration(width),60000);
 assert.equal(tickerDuration(1440),1440/21*1000);
});
