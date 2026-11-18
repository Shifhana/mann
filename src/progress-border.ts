export interface FrameSegment { left:number; right:number; bottom:number; top?:number; topRadius?:number }
let clipSequence = 0;

/** One clockwise outline, stepping around flat controls in the empty lower edge.
 * The underlying canvas size and the normalised construction clock are unchanged. */
export function borderPath(width: number, height: number, segments:FrameSegment[] = []) {
  const x = width - .5, y = height - .5;
  const r = Math.min(9.5, (width - 1) / 2, (height - 1) / 2);
  const steps=segments.filter(s=>s.left>=r&&s.right<=width-r&&s.right>s.left+1&&(s.bottom>height||s.top!==undefined&&s.top<height))
    .sort((a,b)=>b.right-a.right);
  let edge=x-r;
  const lower=steps.map(s=>{
    if(s.right>edge+.5)throw new Error('Frame segments must not overlap');
    edge=s.left+.5;
    const level=s.top!==undefined&&s.top<height?s.top+.5:s.bottom-.5;
    const radius=Math.max(0,Math.min(s.topRadius??0,(s.right-s.left-1)/2,y-level));
    if(radius>0)return ` H ${s.right-.5} V ${level+radius} A ${radius} ${radius} 0 0 0 ${s.right-.5-radius} ${level} H ${s.left+.5+radius} A ${radius} ${radius} 0 0 0 ${s.left+.5} ${level+radius} V ${y}`;
    return ` H ${s.right-.5} V ${level} H ${s.left+.5} V ${y}`;
  }).join('');
  return `M ${r + .5} .5 H ${x - r} A ${r} ${r} 0 0 1 ${x} ${r + .5} V ${y - r} A ${r} ${r} 0 0 1 ${x - r} ${y}${lower} H ${r + .5} A ${r} ${r} 0 0 1 .5 ${y - r} V ${r + .5} A ${r} ${r} 0 0 1 ${r + .5} .5 Z`;
}

export function borderProgress(elapsed: number, finalLock: number) {
  return Math.max(0, Math.min(1, elapsed / finalLock));
}

export const RETRACTION_DURATION = 300;
export function retractionOffset(elapsed: number, from = 0) {
  const t = Math.max(0, Math.min(1, elapsed / RETRACTION_DURATION));
  return from + (1 - from) * t * t * (3 - 2 * t);
}

/** Consume displayed construction time; never run a second animation clock. */
export function installProgressBorder(container: HTMLElement, finalLock: number) {
  const frame = container.closest<HTMLElement>('.exhibit')!;
  const shell=frame.closest<HTMLElement>('.frame-shell')??frame;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('progress-border');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('pathLength', '1');
  path.style.strokeDashoffset = '1';
  // The viewport fill and its single progress stroke use the same contour.
  // This removes the separately rounded rectangular surface under the notches.
  const defs = document.createElementNS(ns, 'defs');
  const clip = document.createElementNS(ns, 'clipPath');
  clip.id = `temple-frame-clip-${++clipSequence}`;
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
  const clipShape = document.createElementNS(ns, 'path');
  clip.append(clipShape); defs.append(clip);
  // Keep the visible path first for existing border consumers and diagnostics.
  svg.append(path, defs);
  shell.append(svg);
  const previousClip = frame.style.clipPath;
  frame.style.clipPath = `url(#${clip.id})`;
  frame.classList.add('has-progress-border');
  const resize = () => {
    const bounds=svg.getBoundingClientRect(),renderBounds=frame.getBoundingClientRect();
    const segments=[...shell.querySelectorAll<HTMLElement>('.control-button')].map(element=>{
      const r=element.getBoundingClientRect(),topRadius=Math.max(0,parseFloat(getComputedStyle(element).borderTopLeftRadius)-.5);return{left:r.left-bounds.left,right:r.right-bounds.left,top:r.top-bounds.top,bottom:r.bottom-bounds.top,topRadius};
    });
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const outline = borderPath(bounds.width, renderBounds.height,segments);
    path.setAttribute('d', outline);
    clipShape.setAttribute('d', outline);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(shell);
  resize();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, animationFrame = 0;
  let pending: Promise<boolean> | undefined;
  let resolveRetraction: ((ready: boolean) => void) | undefined;
  const paint = (offset: number) => {
    path.style.strokeDashoffset = String(offset);
    container.dispatchEvent(new Event('borderframe'));
  };
  const finish = (ready: boolean) => {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (ready) paint(1);
    const resolve = resolveRetraction;
    pending = undefined; resolveRetraction = undefined;
    resolve?.(ready);
  };
  const onReduced = () => { if (reduced.matches && pending) finish(true); };
  reduced.addEventListener('change', onReduced);
  const retract = () => {
    if (disposed) return Promise.resolve(false);
    if (pending) return pending;
    if (reduced.matches) { paint(1); return Promise.resolve(true); }
    const start = performance.now(), from = Number(path.style.strokeDashoffset);
    pending = new Promise<boolean>(resolve => { resolveRetraction = resolve; });
    const tick = () => {
      if (disposed) return;
      const elapsed = performance.now() - start;
      if (elapsed >= RETRACTION_DURATION) { finish(true); return; }
      paint(retractionOffset(elapsed, from));
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return pending;
  };
  const update = (event: Event) => {
    // Static redraws/resizes must not restore the completed line mid-retraction.
    if (pending) return;
    const { elapsed } = (event as CustomEvent<{ elapsed: number }>).detail;
    path.style.strokeDashoffset = String(1 - borderProgress(elapsed, finalLock));
  };
  container.addEventListener('buildprogress', update);
  return { retract, fitControls() {
    shell.querySelectorAll<HTMLElement>('.control-button').forEach(button=>observer.observe(button));
    resize();
  }, dispose() {
    disposed = true;
    finish(false);
    reduced.removeEventListener('change', onReduced);
    observer.disconnect();
    container.removeEventListener('buildprogress', update);
    svg.remove();
    frame.style.clipPath = previousClip;
    frame.classList.remove('has-progress-border');
  } };
}
