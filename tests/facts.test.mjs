import {test} from 'node:test';import assert from 'node:assert/strict';
import {tickerDuration,TICKER_SPEED} from '../src/facts.ts';
import{readFileSync}from'node:fs';
import{createTempleDefinition}from'../src/temple/model.ts';
test('ticker runs at 1.75 times the approved old speed for every valid strip length',()=>{
 assert.equal(TICKER_SPEED,12*1.75);for(const width of [240,960,1440,2400,4000])assert.equal(width/(tickerDuration(width)/1000),21);
});
test('ticker duration is bounded for short, empty and invalid measurements',()=>{
 for(const width of [0,-1,NaN,Infinity])assert.equal(tickerDuration(width),60000);
 assert.equal(tickerDuration(1440),1440/21*1000);
});
test('exactly five approved lines describe the represented three-shrine model',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),lines=[...html.matchAll(/<li class="ticker-fact"[^>]*>(.*?)<\/li>/g)].map(m=>m[1]);
 assert.deepEqual(lines,["We used 1,911 LEGO-like blocks. The original builders used granite!","Over 1,300 years of history, rebuilt here in just 5 seconds.","Two towering shrines, and a third tucked between them. Did you spot it?","The original builders didn't have an Undo button. Luckily, you do. Rebuild it!","Centuries of salty sea breeze, and Shore Temple still stands!"]);
 const model=createTempleDefinition(),[main,secondary,vishnu]=['main','secondary','vishnu'].map(name=>model.chambers.find(c=>c.name===name));assert.equal(model.chambers.length,3);assert.ok(vishnu.center[0]>secondary.center[0]&&vishnu.center[0]<main.center[0]);assert.ok(model.pieces.some(p=>p.group==='vishnu.roof-mass'));
});
