import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {createTempleDefinition} from '../src/temple/model.ts';
import {CONSOLIDATION_PARTS} from '../src/temple/consolidation-catalogue.ts';
import {CATALOGUE} from '../src/temple/catalogue.ts';
const evidence=JSON.parse(fs.readFileSync(new URL('../docs/ldraw-verification.json',import.meta.url)));
test('every claimed standard element has official catalogue evidence and standard dimensions',()=>{
  for(const p of createTempleDefinition().pieces) {
    if(!p.catalogueId) {assert.ok(['main.octagonal-cap','secondary.octagonal-cap','main.lingam','secondary.lingam','enclosure.nandi'].includes(p.group));continue;}
    assert.ok(evidence.some(e=>e.id===p.catalogueId&&e.ok&&e.header.includes('!LDRAW_ORG')),p.catalogueId);
    if(p.shape==='box') {
      const c=[...CATALOGUE,...CONSOLIDATION_PARTS].find(c=>c.id===p.catalogueId);
      assert.ok(c);
      p.size.forEach((v,i)=>assert.ok(Math.abs(v-c.size[i])<.001,`${p.id} dimension ${i}`));
      assert.equal(p.studs,c.studs);
    }
  }
});
