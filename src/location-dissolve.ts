import {formatCoordinates,type Building} from './buildings.ts';
import {installTextDissolve} from './heritage-heading.ts';

export function installLocationDissolve(root:HTMLElement,building:Building,install=installTextDissolve){
 const label=root.textContent?.trim()??'',coordinates=formatCoordinates(building),previous=root.getAttribute('aria-describedby');
 const place=document.createElement('span'),position=document.createElement('span'),description=document.createElement('span');
 place.className='location-place';place.textContent=label;
 position.className='location-position';position.textContent=coordinates;position.setAttribute('aria-hidden','true');
 description.className='sr-only';description.id='location-coordinates';description.textContent=coordinates;
 root.replaceChildren(place,position,description);root.setAttribute('aria-describedby',[previous,description.id].filter(Boolean).join(' '));
 const motion=install(root,{from:'.location-place',to:'.location-position',width:252,left:12,align:'right',load:async fonts=>{try{return(await fonts.load("500 14px 'DM Sans'",label+coordinates)).length>0;}catch{return false;}}});
 return{dispose(){motion.dispose();root.textContent=label;if(previous===null)root.removeAttribute('aria-describedby');else root.setAttribute('aria-describedby',previous);}};
}
