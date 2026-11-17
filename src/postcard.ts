import type { RenderedTemple } from './temple/render.ts';
import { formatCoordinates, type Building } from './buildings.ts';

/** Stage 1 is a preview only: there is deliberately no export or download action. */
export function installPostcard(button: HTMLButtonElement, container: HTMLElement, temple: RenderedTemple, building: Building) {
  const dialog=document.createElement('dialog');dialog.className='postcard-dialog';
  dialog.setAttribute('aria-labelledby','postcard-title');
  dialog.innerHTML=`<div class="postcard-actions"><button class="postcard-close" type="button" autofocus aria-label="Back — close postcard preview"><span>Back</span><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8"/></svg></button></div>
    <article class="postcard-sheet">
      <div class="postcard-content">
      <div class="postcard-stamp"><div class="postcard-art"></div></div>
      <footer class="postcard-caption"><h2 id="postcard-title"></h2><p class="postcard-coordinates"></p><p class="postcard-location"></p></footer>
      </div>
    </article>`;
  dialog.querySelector('.postcard-sheet')!.setAttribute('aria-label', `${building.name} architectural travel postcard`);
  dialog.querySelector('#postcard-title')!.textContent = building.name;
  dialog.querySelector('.postcard-coordinates')!.textContent = formatCoordinates(building);
  dialog.querySelector('.postcard-location')!.textContent = building.location;
  document.body.append(dialog);
  const closeButton=dialog.querySelector<HTMLButtonElement>('.postcard-close')!;
  const art=dialog.querySelector<HTMLElement>('.postcard-art')!;
  let capture:HTMLCanvasElement|undefined, motion:Animation|undefined, closing=false, disposed=false;
  let returnFocus:HTMLElement|undefined;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const ready=()=>container.dataset.ready==='true'&&container.dataset.state==='complete'&&(!container.dataset.landscape||container.dataset.landscape==='complete');
  const animate=(opening:boolean)=>{
    motion?.cancel();
    motion=dialog.animate(opening ? [{opacity:0,transform:'translateY(6px) scale(.985)'},{opacity:1,transform:'none'}] : [{opacity:1,transform:'none'},{opacity:0,transform:'translateY(4px) scale(.99)'}],{duration:reduced.matches?0:240,easing:'cubic-bezier(.2,.65,.3,1)',fill:opening?'none':'forwards'});
    return motion.finished.catch(()=>{});
  };
  const close=async()=>{
    if(!dialog.open||closing)return;
    closing=true;dialog.classList.add('is-closing');await animate(false);
    if(disposed)return;
    dialog.close();motion?.cancel();motion=undefined;closing=false;dialog.classList.remove('is-closing');
    returnFocus?.focus({preventScroll:true});
  };
  const open=()=>{
    if(disposed||closing||dialog.open||!ready())return;
    try {
      capture??=temple.capturePostcard();
      capture.setAttribute('role','img');capture.setAttribute('aria-label',`The completed LEGO model of ${building.name}, ${building.location}, viewed from the exterior.`);
      art.replaceChildren(capture);
      returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:button;
      dialog.showModal();closeButton.focus({preventScroll:true});void animate(true);
    } catch(error) {console.error('Unable to prepare the postcard preview.',error);}
  };
  const onCancel=(event:Event)=>{event.preventDefault();void close();};
  const onKeyDown=(event:KeyboardEvent)=>{
    // Back is intentionally the preview's only action. Keep both Tab directions
    // on it instead of letting Chromium cycle focus to the browser chrome.
    if(event.key==='Tab'){event.preventDefault();closeButton.focus({preventScroll:true});}
  };
  const onBackdrop=(event:MouseEvent)=>{
    if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)void close();
  };
  const updateReady=()=>{button.disabled=!ready();if(!button.disabled)container.removeEventListener('templeframe',updateReady);};
  const reset=()=>{
      if(dialog.open)void close();capture?.remove();if(capture){capture.width=0;capture.height=0;}capture=undefined;
      button.disabled=true;container.addEventListener('templeframe',updateReady);
  };
  const onBuildState=(event:Event)=>{
    if((event as CustomEvent<boolean>).detail)reset();else updateReady();
  };
  button.title=`Preview your ${building.name} postcard`;button.setAttribute('aria-label',`Download Postcard — preview ${building.name}`);
  button.setAttribute('aria-haspopup','dialog');
  button.addEventListener('click',open);closeButton.addEventListener('click',close);
  dialog.addEventListener('cancel',onCancel);dialog.addEventListener('click',onBackdrop);dialog.addEventListener('keydown',onKeyDown);
  container.addEventListener('buildstate',onBuildState);container.addEventListener('templeframe',updateReady);updateReady();
  return {reset,dispose(){disposed=true;motion?.cancel();if(dialog.open)dialog.close();dialog.remove();capture=undefined;button.removeEventListener('click',open);container.removeEventListener('buildstate',onBuildState);container.removeEventListener('templeframe',updateReady);}};
}
