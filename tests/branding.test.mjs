import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Maṇṇ identity and tagline retain the Shore Temple English/Tamil interaction',()=>{
 const html=read('index.html');assert.match(html,/<title>Maṇṇ \(மண்\) — Shore Temple/);assert.ok(html.includes('Architecture rooted in place.'));assert.ok(html.includes('class="product-name">Maṇṇ'));assert.ok(html.includes('lang="ta">(மண்)'));
 assert.match(html,/class="heading-english" lang="en">SHORE TEMPLE/);assert.match(html,/class="heading-tamil" lang="ta">கடற்கரைக் கோயில்/);assert.ok(!html.includes('Brickit'));
 assert.ok(read('src/style.css').includes("@fontsource/dm-sans/latin-ext-500.css"));
});
