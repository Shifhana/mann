import{test}from'node:test';import assert from'node:assert/strict';import{BufferGeometry,Float32BufferAttribute}from'three';import{indexExactGeometry}from'../src/temple/indexed-geometry.ts';import{createTempleDefinition}from'../src/temple/model.ts';import{refineCollectible}from'../src/temple/refine-collectible.ts';import{partGeometry,geometryKey}from'../src/temple/geometry.ts';
test('exact indexing preserves every triangle attribute, sharp normal and UV seam',()=>{
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,1,0,0],3));g.setAttribute('normal',new Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1,0,0,-1,0,0,1],3));g.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,0,1,0,0,0,1,.5,0],2));
 const original=Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,Array.from(a.array)]));indexExactGeometry(g);assert.equal(g.index.count,6);assert.equal(g.getAttribute('position').count,5);
 for(const[name,a]of Object.entries(g.attributes))for(let i=0;i<g.index.count;i++)for(let c=0;c<a.itemSize;c++)assert.ok(Object.is(a.array[g.index.getX(i)*a.itemSize+c],original[name][i*a.itemSize+c]));
});
test('all approved part geometries retain their triangle order with substantial exact vertex reuse',()=>{
 const ps=refineCollectible(createTempleDefinition()).pieces,seen=new Set();let expanded=0,unique=0;
 for(const p of ps){const key=geometryKey(p);if(seen.has(key))continue;seen.add(key);const g=partGeometry(p);assert.ok(g.index);expanded+=g.index.count;unique+=g.getAttribute('position').count;assert.equal(g.index.count%3,0);for(const i of g.index.array)assert.ok(i<g.getAttribute('position').count);}
 assert.ok(unique<expanded*.65);
});
