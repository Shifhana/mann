import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installPostcard} from '../src/postcard.ts';

class Element extends EventTarget {
  attributes=new Map();dataset={};disabled=false;open=false;textContent='';children=[];width=16;height=12;
  classList={add(){},remove(){}};
  setAttribute(name,value){this.attributes.set(name,value);}
  getAttribute(name){return this.attributes.get(name);}
  querySelector(selector){return this.nodes.get(selector);}
  replaceChildren(...children){this.children=children;}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  remove(){this.removed=true;}
  animate(){return{finished:Promise.resolve(),cancel(){}};}
  click(){this.dispatchEvent(new Event('click'));}
}

async function fixture(run){
  const saved={document:globalThis.document,HTMLElement:globalThis.HTMLElement,matchMedia:globalThis.matchMedia,URL:globalThis.URL};
  const dialog=new Element();dialog.nodes=new Map(['.postcard-sheet','#postcard-title','.postcard-coordinates','.postcard-location','.postcard-close','.postcard-download','.postcard-status','.postcard-art'].map(s=>[s,new Element()]));
  const button=new Element(),container=new Element(),captures=[],downloads=[],encodings=[],revoked=[];
  const context={scale(){},fillRect(){},save(){},restore(){},beginPath(){},roundRect(){},clip(){},drawImage(){},stroke(){},measureText(){return{fontBoundingBoxAscent:10,fontBoundingBoxDescent:3}},fillText(){}};
  globalThis.HTMLElement=Element;globalThis.matchMedia=()=>({matches:true});
  globalThis.URL={createObjectURL:()=>`blob:${downloads.length}`,revokeObjectURL:url=>revoked.push(url)};
  globalThis.document={activeElement:button,fonts:{load:async()=>[{}],check:()=>true},createElement:tag=>{
    if(tag==='dialog')return dialog;
    const element=new Element();
    if(tag==='canvas'){element.getContext=()=>context;element.toBlob=callback=>encodings.push(callback);}
    if(tag==='a')element.click=()=>downloads.push({href:element.href,name:element.download});
    return element;
  },body:{append(){}}};
  const preview=installPostcard(button,container,{capturePostcard(scale=1){const canvas=new Element();canvas.captureScale=scale;captures.push(canvas);return canvas;}},{name:'Another Hall',latitude:-33.8568,longitude:151.2153,location:'Sydney'});
  try{await run({button,container,dialog,captures,preview,downloads,encodings,revoked});}
  finally{preview.dispose();for(const[key,value]of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}

test('postcard gates capture until scenery is complete and preserves focus and keyboard close',async()=>fixture(async({button,container,dialog,captures})=>{
  assert.equal(button.disabled,true);button.dispatchEvent(new Event('click'));assert.equal(captures.length,0);
  Object.assign(container.dataset,{ready:'true',state:'complete',landscape:'revealing'});container.dispatchEvent(new Event('templeframe'));assert.equal(button.disabled,true);
  container.dataset.landscape='complete';container.dispatchEvent(new Event('templeframe'));assert.equal(button.disabled,false);
  assert.equal(button.getAttribute('aria-label'),'Download Postcard — preview Another Hall');
  assert.equal(dialog.querySelector('#postcard-title').textContent,'Another Hall');
  assert.equal(dialog.querySelector('.postcard-coordinates').textContent,'33°51′24″S 151°12′55″E');
  button.dispatchEvent(new Event('click'));assert.equal(dialog.open,true);assert.equal(captures.length,1);assert.equal(document.activeElement,dialog.querySelector('.postcard-close'));
  assert.equal(dialog.querySelector('.postcard-status').textContent,'Share this little piece of history.');
  const tab=new Event('keydown',{cancelable:true});Object.defineProperty(tab,'key',{value:'Tab'});dialog.dispatchEvent(tab);assert.equal(tab.defaultPrevented,true);
  assert.equal(document.activeElement,dialog.querySelector('.postcard-download'));
  dialog.dispatchEvent(tab);assert.equal(document.activeElement,dialog.querySelector('.postcard-close'));
  const shiftTab=new Event('keydown',{cancelable:true});Object.defineProperties(shiftTab,{key:{value:'Tab'},shiftKey:{value:true}});dialog.dispatchEvent(shiftTab);
  assert.equal(document.activeElement,dialog.querySelector('.postcard-download'));
  const cancel=new Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(cancel.defaultPrevented,true);assert.equal(dialog.open,false);assert.equal(document.activeElement,button);
}));

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const openReady=({button,container})=>{Object.assign(container.dataset,{ready:'true',state:'complete'});container.dispatchEvent(new Event('templeframe'));button.click();};

test('PNG export guards concurrent clicks, uses high-resolution capture and dynamic metadata, and caches only the encoded PNG',async()=>fixture(async f=>{
  openReady(f);const download=f.dialog.querySelector('.postcard-download');
  download.click();download.click();assert.equal(download.disabled,true);await flush();
  assert.equal(f.captures.length,2);assert.equal(f.captures[1].captureScale,2);assert.equal(f.encodings.length,1);
  f.encodings.shift()(new Blob(['png'],{type:'image/png'}));await flush();
  assert.equal(download.disabled,false);assert.equal(f.downloads.length,1);assert.equal(f.downloads[0].name,'mann-another-hall-postcard.png');
  assert.equal(f.dialog.querySelector('.postcard-status').textContent,'Your postcard is downloaded.');
  assert.equal(f.captures[1].width,0);assert.equal(f.captures[0].width,16,'preview canvas must remain intact');
  download.click();await flush();assert.equal(f.downloads.length,2);assert.equal(f.captures.length,2,'reuse the PNG on a repeated download');
  f.preview.reset();await flush();openReady(f);download.click();await flush();assert.equal(f.captures.length,4,'Rebuild invalidates both preview and PNG');
  f.encodings.shift()(new Blob(['new png']));await flush();assert.equal(f.downloads.length,3);
}));

test('closing during PNG encoding cancels late downloads and restores focus; failures allow retry',async()=>fixture(async f=>{
  openReady(f);const download=f.dialog.querySelector('.postcard-download');
  download.click();await flush();f.dialog.dispatchEvent(new Event('cancel',{cancelable:true}));await flush();
  f.encodings.shift()(new Blob(['late']));await flush();assert.equal(f.downloads.length,0);assert.equal(document.activeElement,f.button);
  f.button.click();download.click();await flush();
  const error=console.error;const errors=[];console.error=(...args)=>errors.push(args);
  try{f.encodings.shift()(null);await flush();}finally{console.error=error;}
  assert.equal(errors.length,1);assert.match(f.dialog.querySelector('.postcard-status').textContent,/Please try again/);assert.equal(download.disabled,false);
  download.click();await flush();f.encodings.shift()(new Blob(['retry']));await flush();assert.equal(f.downloads.length,1);
}));

test('closing while fonts load prevents a stale scene capture and download',async()=>fixture(async f=>{
  openReady(f);const pending=[];document.fonts.load=()=>new Promise(resolve=>pending.push(resolve));
  f.dialog.querySelector('.postcard-download').click();f.dialog.querySelector('.postcard-close').click();await flush();
  pending.forEach(resolve=>resolve([{}]));await flush();assert.equal(f.captures.length,1);assert.equal(f.encodings.length,0);assert.equal(f.downloads.length,0);
}));

test('Rebuild invalidates the cached capture and disposal disconnects external listeners',async()=>fixture(async({button,container,dialog,captures,preview})=>{
  Object.assign(container.dataset,{ready:'true',state:'complete'});container.dispatchEvent(new Event('templeframe'));button.dispatchEvent(new Event('click'));assert.equal(captures.length,1);
  dialog.querySelector('.postcard-close').dispatchEvent(new Event('click'));await Promise.resolve();await Promise.resolve();await Promise.resolve();
  button.dispatchEvent(new Event('click'));assert.equal(captures.length,1);
  preview.reset();assert.equal(button.disabled,true);assert.equal(captures[0].width,0);assert.equal(captures[0].height,0);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();container.dataset.state='building';button.dispatchEvent(new Event('click'));assert.equal(captures.length,1);
  container.dataset.state='complete';container.dispatchEvent(new Event('templeframe'));button.dispatchEvent(new Event('click'));assert.equal(captures.length,2);
  preview.dispose();assert.equal(dialog.removed,true);assert.equal(dialog.open,false);button.dispatchEvent(new Event('click'));assert.equal(captures.length,2);
  button.disabled=true;container.dispatchEvent(new Event('templeframe'));assert.equal(button.disabled,true);
}));
