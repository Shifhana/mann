import {test} from 'node:test';import assert from 'node:assert/strict';
import {installLocationDissolve} from '../src/location-dissolve.ts';
import {formatCoordinates,shoreTemple} from '../src/buildings.ts';
class Element {
 attributes=new Map();children=[];className='';id='';textContent='';
 replaceChildren(...els){this.children=els;}setAttribute(k,v){this.attributes.set(k,v);}getAttribute(k){return this.attributes.get(k)??null;}removeAttribute(k){this.attributes.delete(k);}
}
test('location reuses the approved title dissolve, verified coordinates and accessible description without auto intent',async()=>{
 const saved=globalThis.document;globalThis.document={createElement:()=>new Element()};
 try{const root=new Element();root.textContent='Mahabalipuram, Tamil Nadu';root.setAttribute('aria-describedby','prior');let options,disposed=false;
 const t=installLocationDissolve(root,shoreTemple,(element,opt,...extra)=>{assert.equal(element,root);assert.equal(extra.length,0);options=opt;return{dispose(){disposed=true}}});
 assert.equal(root.children[0].textContent,'Mahabalipuram, Tamil Nadu');assert.equal(root.children[1].textContent,formatCoordinates(shoreTemple));assert.equal(root.children[1].getAttribute('aria-hidden'),'true');assert.equal(root.children[2].textContent,formatCoordinates(shoreTemple));assert.equal(root.children[2].className,'sr-only');assert.equal(root.getAttribute('aria-describedby'),'prior location-coordinates');assert.equal(options.align,'right');assert.equal(options.from,'.location-place');assert.equal(options.to,'.location-position');
 assert.equal(await options.load({load:async()=>[{}]}),true);assert.equal(await options.load({load:async()=>{throw Error()} }),false);t.dispose();assert.equal(disposed,true);assert.equal(root.textContent,'Mahabalipuram, Tamil Nadu');assert.equal(root.getAttribute('aria-describedby'),'prior');
 }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});
