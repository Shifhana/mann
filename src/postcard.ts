import type { RenderedTemple } from './temple/render.ts';
import { formatCoordinates, type Building } from './buildings.ts';
import { postcardFilename, postcardPng } from './postcard-export.ts';
const SHARE_PROMPT='Share this little piece of history.';

export function installPostcard(button: HTMLButtonElement, container: HTMLElement, temple: RenderedTemple, building: Building) {
  const dialog=document.createElement('dialog');dialog.className='postcard-dialog';
  dialog.setAttribute('aria-labelledby','postcard-title');
  dialog.innerHTML=`<div class="postcard-actions"><button class="postcard-close postcard-action" type="button" autofocus aria-label="Back — close postcard preview"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M13 8H3m5-5L3 8l5 5"/></svg><span>Back</span></button><p class="postcard-status" role="status" aria-live="polite" aria-atomic="true">${SHARE_PROMPT}</p><button class="postcard-download postcard-action" type="button" aria-label="Download Postcard as a 3000 by 2442 PNG"><img src="/ui/download.svg" width="16" height="16" alt="" aria-hidden="true"><span>Download Postcard</span></button></div>
    <article class="postcard-sheet">
      <div class="postcard-composition">
      <div class="postcard-content">
      <div class="postcard-stamp"><div class="postcard-art"></div></div>
      <footer class="postcard-caption"><h2 id="postcard-title"></h2><p class="postcard-coordinates"></p><p class="postcard-location"></p></footer>
      </div>
      </div>
    </article>`;
  dialog.querySelector('.postcard-sheet')!.setAttribute('aria-label', `${building.name} architectural travel postcard`);
  dialog.querySelector('#postcard-title')!.textContent = building.name;
  dialog.querySelector('.postcard-coordinates')!.textContent = formatCoordinates(building);
  dialog.querySelector('.postcard-location')!.textContent = building.location;
  document.body.append(dialog);
  const closeButton=dialog.querySelector<HTMLButtonElement>('.postcard-close')!;
  const downloadButton=dialog.querySelector<HTMLButtonElement>('.postcard-download')!;
  const status=dialog.querySelector<HTMLElement>('.postcard-status')!;
  const art=dialog.querySelector<HTMLElement>('.postcard-art')!;
  let capture:HTMLCanvasElement|undefined, motion:Animation|undefined, closing=false, disposed=false;
  let returnFocus:HTMLElement|undefined;
  let exporting=false, revision=0, png:Blob|undefined;
  const urls=new Map<string,ReturnType<typeof setTimeout>>();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const ready=()=>container.dataset.ready==='true'&&container.dataset.state==='complete'&&(!container.dataset.landscape||container.dataset.landscape==='complete');
  const animate=(opening:boolean)=>{
    motion?.cancel();
    motion=dialog.animate(opening ? [{opacity:0,transform:'translateY(6px) scale(.985)'},{opacity:1,transform:'none'}] : [{opacity:1,transform:'none'},{opacity:0,transform:'translateY(4px) scale(.99)'}],{duration:reduced.matches?0:240,easing:'cubic-bezier(.2,.65,.3,1)',fill:opening?'none':'forwards'});
    return motion.finished.catch(()=>{});
  };
  const close=async()=>{
    if(!dialog.open||closing)return;
    revision++;
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
      status.textContent=SHARE_PROMPT;status.dataset.kind='prompt';
      returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:button;
      dialog.showModal();closeButton.focus({preventScroll:true});void animate(true);
    } catch(error) {console.error('Unable to prepare the postcard preview.',error);}
  };
  const onCancel=(event:Event)=>{event.preventDefault();void close();};
  const onKeyDown=(event:KeyboardEvent)=>{
    if(event.key!=='Tab')return;
    event.preventDefault();
    const actions=downloadButton.disabled?[closeButton]:[closeButton,downloadButton];
    const index=actions.indexOf(document.activeElement as HTMLButtonElement);
    actions[(index+(event.shiftKey?-1:1)+actions.length)%actions.length].focus({preventScroll:true});
  };
  const download=async()=>{
    if(exporting||disposed||closing||!dialog.open||!ready())return;
    const current=revision;
    exporting=true;downloadButton.disabled=true;downloadButton.setAttribute('aria-busy','true');
    status.textContent='Preparing your PNG…';status.dataset.kind='busy';
    const cancelled=()=>disposed||closing||!dialog.open||current!==revision;
    try {
      const blob=await (png??postcardPng(()=>{
        if(cancelled())throw new DOMException('Postcard closed.','AbortError');
        // 3324×2460 is larger than the final PNG's image region: real scene
        // detail at export resolution, never an enlarged preview screenshot.
        return temple.capturePostcard(2);
      },building));
      if(cancelled())return;
      png=blob;
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      const timer=setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000);
      urls.set(url,timer);
      link.href=url;link.download=postcardFilename(building);
      document.body.append(link);
      try {link.click();}finally {link.remove();}
      status.textContent='Your postcard is downloaded.';status.dataset.kind='complete';
    } catch(error) {
      if(!cancelled()) {
        status.textContent='Unable to create the PNG. Please try again.';
        console.error('Unable to export the postcard.',error);
      }
    } finally {
      exporting=false;downloadButton.disabled=false;downloadButton.setAttribute('aria-busy','false');
    }
  };
  const onBackdrop=(event:MouseEvent)=>{
    if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)void close();
  };
  const updateReady=()=>{button.disabled=!ready();if(!button.disabled)container.removeEventListener('templeframe',updateReady);};
  const reset=()=>{
      revision++;png=undefined;
      if(dialog.open)void close();capture?.remove();if(capture){capture.width=0;capture.height=0;}capture=undefined;
      button.disabled=true;container.addEventListener('templeframe',updateReady);
  };
  const onBuildState=(event:Event)=>{
    if((event as CustomEvent<boolean>).detail)reset();else updateReady();
  };
  button.title=`Preview your ${building.name} postcard`;button.setAttribute('aria-label',`Download Postcard — preview ${building.name}`);
  button.setAttribute('aria-haspopup','dialog');
  button.addEventListener('click',open);closeButton.addEventListener('click',close);
  downloadButton.addEventListener('click',download);
  dialog.addEventListener('cancel',onCancel);dialog.addEventListener('click',onBackdrop);dialog.addEventListener('keydown',onKeyDown);
  container.addEventListener('buildstate',onBuildState);container.addEventListener('templeframe',updateReady);updateReady();
  return {reset,dispose(){disposed=true;revision++;png=undefined;motion?.cancel();if(dialog.open)dialog.close();dialog.remove();if(capture)capture.width=capture.height=0;capture=undefined;for(const[url,timer]of urls){clearTimeout(timer);URL.revokeObjectURL(url);}urls.clear();button.removeEventListener('click',open);downloadButton.removeEventListener('click',download);container.removeEventListener('buildstate',onBuildState);container.removeEventListener('templeframe',updateReady);}};
}
