/** Pixels per second; the ticker is compositor-only, with no render-loop timer. */
export const TICKER_SPEED=12;
export function tickerDuration(width:number){return Number.isFinite(width)&&width>0?Math.max(60000,width/TICKER_SPEED*1000):60000;}

export function installFacts(root:HTMLElement){
  const track=root.querySelector<HTMLElement>('.ticker-track')!,group=track.querySelector<HTMLElement>('.ticker-group')!;
  const copy=group.cloneNode(true) as HTMLElement;copy.classList.add('ticker-copy');copy.setAttribute('aria-hidden','true');track.append(copy);
  let disposed=false;
  const measure=()=>root.style.setProperty('--ticker-duration',`${tickerDuration(group.getBoundingClientRect().width)}ms`);
  const observer=new ResizeObserver(measure);observer.observe(group);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),viewport=root.querySelector<HTMLElement>('.ticker-window')!;
  const motion=()=>{if(!reduced.matches)viewport.scrollLeft=0;};
  reduced.addEventListener('change',motion);
  const visibility=()=>root.toggleAttribute('data-paused',document.hidden);
  document.addEventListener('visibilitychange',visibility);visibility();
  void document.fonts.ready.then(()=>{if(!disposed){measure();root.setAttribute('data-ready','');}});
  return {dispose(){disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion);root.removeAttribute('data-ready');root.removeAttribute('data-paused');copy.remove();}};
}
