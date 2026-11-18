import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const luminance=hex=>hex.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
test('main location retains its approved typography and meets contrast on the actual page colour',()=>{
 const css=read('src/style.css'),location=css.match(/\.location\s*\{([^}]+)\}/)[1];
 assert.ok((luminance('F3EFE8')+.05)/(luminance('76695C')+.05)>=4.5);
 assert.match(css,/:root\s*\{[^}]*background:\s*#f3efe8/i);
 assert.match(location,/color:\s*#76695C/i);assert.match(location,/font-size:\s*14px/);assert.match(location,/font-weight:\s*500/);assert.match(location,/line-height:\s*21px/);assert.match(location,/text-align:\s*right/);
});
test('postcard metadata meets normal-text contrast with matching preview/export colours',()=>{
 for(const colour of ['583622','77716B','807060']){assert.ok((luminance('FAF9F6')+.05)/(luminance(colour)+.05)>=4.5);for(const p of ['src/postcard.css','src/postcard-export.ts'])assert.ok(read(p).includes('#'+colour));}
});
test('release serves approved coast/plan at the root and keeps debug APIs development-only',()=>{
 assert.match(read('src/main.ts'),/const planModule = fullPreview \?/);assert.match(read('src/main.ts'),/const coastalPreview = fullPreview;/);
 assert.match(read('src/temple/render.ts'),/const planView = planFactory\?\.\(definition\);/);assert.match(read('src/temple/render.ts'),/const coast = coastalRevealAt !== undefined/);
 assert.match(read('src/main.ts'),/if \(import.meta.env.DEV && prototype\) Object.assign/);
 const config=JSON.parse(read('vercel.json'));assert.equal(config.buildCommand,'npm run build');assert.equal(config.outputDirectory,'dist');assert.equal(config.installCommand,'npm ci');assert.equal(config.framework,'vite');
});
test('preview sharing artwork uses the preview host while canonical metadata retains the configured public origin',async()=>{
 const {loadConfigFromFile}=await import('vite');
 const {config}=await loadConfigFromFile({command:'build',mode:'production'});
 const transform=config.plugins.find(p=>p.name==='release-metadata').transformIndexHtml;
 const keys=['SITE_URL','VERCEL_ENV','VERCEL_URL'],saved=keys.map(k=>process.env[k]);
 try{process.env.SITE_URL='https://brickit.example';process.env.VERCEL_ENV='preview';process.env.VERCEL_URL='brickit-review.example';
  const preview=transform(read('index.html'));assert.ok(preview.includes('content="https://brickit-review.example/social-preview.png"'));assert.ok(preview.includes('rel="canonical" href="https://brickit.example/"'));assert.ok(!preview.includes('__SITE_ORIGIN__'));
  process.env.VERCEL_ENV='production';assert.ok(transform(read('index.html')).includes('content="https://brickit.example/social-preview.png"'));
  process.env.SITE_URL='http://brickit.example';assert.throws(()=>transform(read('index.html')),/HTTPS/);
 }finally{keys.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i]})}
});
