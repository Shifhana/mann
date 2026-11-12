import './style.css';
import { createTempleDefinition } from './temple/model.ts';
import { displayTemple } from './temple/render.ts';
import { createMotionPlan } from './temple/animation.ts';
import { createLandingPrototype } from './temple/landing-prototype.ts';
import { createFullConstruction, prominentLandings } from './temple/full-construction.ts';
import { refineCollectible } from './temple/refine-collectible.ts';
import { LandingAudio } from './temple/landing-audio.ts';
import { ConstructionAudio } from './temple/audio.ts';
import { installProgressBorder } from './progress-border.ts';
import { BUILD_DURATION } from './temple/animation.ts';

const container = document.querySelector<HTMLElement>('#temple-viewport')!;

try {
  const inspection = import.meta.env.DEV ? new URLSearchParams(location.search).get('compare') : null;
  let definition = createTempleDefinition(inspection === 'benchmark' || inspection === 'hidden' || inspection === 'aggressive' ? inspection : 'balanced');
  const fullPreview = !(import.meta.env.DEV && ['landing','legacy'].includes(new URLSearchParams(location.search).get('preview')??''));
  if(fullPreview && !(import.meta.env.DEV && new URLSearchParams(location.search).get('detail')==='original')) definition=refineCollectible(definition);
  const prototype = fullPreview ? createFullConstruction(definition.pieces) : import.meta.env.DEV && new URLSearchParams(location.search).get('preview')==='landing' ? createLandingPrototype(definition.pieces) : undefined;
  const previewDuration=fullPreview ? Math.max(5000,Math.ceil(Math.max(...prototype!.map(m=>m.settled))+80)) : undefined;
  const temple = displayTemple(container, definition, prototype, previewDuration);
  const sound = prototype ? new LandingAudio(fullPreview ? prominentLandings(prototype) : prototype,undefined,undefined,fullPreview ? 220 : Infinity,fullPreview) : new ConstructionAudio(createMotionPlan(definition.pieces),undefined,definition.pieces.map(p=>p.size[0]*p.size[1]*p.size[2]));
  if (import.meta.env.DEV && prototype) Object.assign(window, { __landingPreview: {temple,sound,events:prototype,container,duration:previewDuration??3000} });
  const rebuild = document.createElement('button');
  rebuild.className = 'rebuild'; rebuild.textContent = 'Rebuild';
  rebuild.setAttribute('aria-label', 'Rebuild the Shore Temple');
  rebuild.addEventListener('click', temple.rebuild);
  const controls=document.createElement('div');controls.className='controls';
  const mute=document.createElement('button');mute.className='mute';mute.type='button';
  const updateMute=()=>{
    mute.setAttribute('aria-label',sound.muted?'Unmute construction sounds':'Mute construction sounds');
    mute.title=sound.muted?'Unmute':'Mute';mute.setAttribute('aria-pressed',String(!sound.muted));
    mute.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/>${sound.muted?'<path d="m16 9 5 6m0-6-5 6"/>':'<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'}</svg>`;
  };
  updateMute();
  mute.addEventListener('click',()=>{
    const pending=sound.setMuted(!sound.muted);updateMute();
    void pending.catch(error=>{console.warn('Construction sound unavailable.',error);}).finally(updateMute);
  });
  container.addEventListener('buildprogress',event=>{
    const {elapsed,building,timelineSampleTime}=(event as CustomEvent<{elapsed:number;building:boolean;timelineSampleTime:number}>).detail;
    if(sound instanceof LandingAudio)sound.update(elapsed,building,timelineSampleTime);else sound.update(elapsed,building);
  });
  // The approved final locking click occurs just before the rotation's end hold.
  // Finish the border on that same displayed seating frame, preserving all audio.
  const removeProgressBorder = installProgressBorder(container, prototype
    ? Math.max(...(fullPreview ? prominentLandings(prototype) : prototype).map(m => m.settled))
    : BUILD_DURATION);
  const visibility=()=>sound.setHidden(document.hidden);visibility();
  document.addEventListener('visibilitychange',visibility);
  controls.append(rebuild,mute);container.closest('.exhibit')!.append(controls);
  container.addEventListener('buildstate', event => {
    rebuild.disabled = (event as CustomEvent<boolean>).detail;
    rebuild.textContent = rebuild.disabled ? 'Assembling…' : 'Rebuild';
  });
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('record')) {
    import('./recording.ts').then(({ installRecording }) => installRecording(container, temple.rebuild));
  }
  if (import.meta.hot) import.meta.hot.dispose(() => {removeProgressBorder();sound.dispose();document.removeEventListener('visibilitychange',visibility);temple.dispose();controls.remove();});
} catch (error) {
  console.error('Unable to display the Shore Temple model.', error);
  container.replaceChildren();
  const message = document.createElement('p');
  message.className = 'render-error';
  message.setAttribute('role', 'alert');
  message.textContent = 'This miniature needs WebGL. Please open it in a browser with hardware acceleration enabled.';
  container.append(message);
  container.closest('figure')?.setAttribute('aria-busy', 'false');
}
