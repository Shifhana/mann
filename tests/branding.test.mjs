import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Maṇṇ metadata remains while the visible header contains only the bilingual title and location',()=>{
 const html=read('index.html');assert.match(html,/<title>Maṇṇ \(மண்\) — Shore Temple/);assert.ok(html.includes('Architecture rooted in place.'));assert.ok(!html.includes('class="product-signature"'));assert.ok(!html.includes('class="product-name"'));assert.ok(!html.includes('class="product-tagline"'));
 assert.match(html,/class="heading-english" lang="en">SHORE TEMPLE/);assert.match(html,/class="heading-tamil" lang="ta">கடற்கரைக் கோயில்/);assert.ok(!html.includes('Brickit'));
 assert.ok(read('src/style.css').includes("@fontsource/dm-sans/latin-ext-500.css"));
});
