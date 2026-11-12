import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createTempleDefinition,sectionMembership} from '../src/temple/model.ts';
import {consolidatePieces,pieceBounds} from '../src/temple/consolidate.ts';
const baseline=createTempleDefinition('benchmark');
const result=consolidatePieces(baseline.pieces,'balanced',sectionMembership);
const byId=new Map(baseline.pieces.map(p=>[p.id,p]));
const finalById=new Map(result.pieces.map(p=>[p.id,p]));
const volume=p=>p.size.reduce((v,n)=>v*n,1);
test('consolidation preserves exact occupied rectangular unions and colour/stage identity',()=>{
  assert.ok(result.pieces.length<baseline.pieces.length);
  for(const merge of result.merges){
    const replacement=finalById.get(merge.replacement), bounds=pieceBounds(replacement);
    const sources=merge.sources.map(id=>byId.get(id));
    assert.ok(Math.abs(volume(replacement)-sources.reduce((v,p)=>v+volume(p),0))<.001);
    for(const p of sources){
      assert.equal(p.material,replacement.material);
      assert.equal(p.assemblyStage,replacement.assemblyStage);
      assert.equal(p.group,replacement.group);
      const b=pieceBounds(p);
      b.min.forEach((v,i)=>assert.ok(v>=bounds.min[i]-.001&&b.max[i]<=bounds.max[i]+.001));
    }
    for(let i=0;i<sources.length;i++)for(let j=i+1;j<sources.length;j++){
      const a=pieceBounds(sources[i]),b=pieceBounds(sources[j]);
      assert.ok(!a.min.every((v,k)=>v<b.max[k]-.001&&a.max[k]>b.min[k]+.001),'overlap could hide a hole');
    }
  }
});
test('sculptural details, slopes, sacred interiors and camera bounds remain unchanged',()=>{
  for(const p of baseline.pieces.filter(p=>p.shape!=='box'||p.structuralRole==='sacred'))assert.deepEqual(finalById.get(p.id),p);
  assert.deepEqual(createTempleDefinition().chambers,baseline.chambers);
  const extents=pieces=>pieces.reduce((all,p)=>{const b=pieceBounds(p);return {min:all.min.map((v,i)=>Math.min(v,b.min[i])),max:all.max.map((v,i)=>Math.max(v,b.max[i]))};},{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
  assert.deepEqual(extents(result.pieces),extents(baseline.pieces));
});
