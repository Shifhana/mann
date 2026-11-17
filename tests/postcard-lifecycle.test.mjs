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
}

async function fixture(run){
  const saved={document:globalThis.document,HTMLElement:globalThis.HTMLElement,matchMedia:globalThis.matchMedia};
  const dialog=new Element();dialog.nodes=new Map(['.postcard-sheet','#postcard-title','.postcard-coordinates','.postcard-location','.postcard-close','.postcard-art'].map(s=>[s,new Element()]));
  const button=new Element(),container=new Element(),captures=[];
  globalThis.HTMLElement=Element;globalThis.matchMedia=()=>({matches:true});
  globalThis.document={activeElement:button,createElement:()=>dialog,body:{append(){}}};
  const preview=installPostcard(button,container,{capturePostcard(){const canvas=new Element();captures.push(canvas);return canvas;}},{name:'Another Hall',latitude:-33.8568,longitude:151.2153,location:'Sydney'});
  try{await run({button,container,dialog,captures,preview});}
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
  const tab=new Event('keydown',{cancelable:true});Object.defineProperty(tab,'key',{value:'Tab'});dialog.dispatchEvent(tab);assert.equal(tab.defaultPrevented,true);
  const cancel=new Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(cancel.defaultPrevented,true);assert.equal(dialog.open,false);assert.equal(document.activeElement,button);
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
