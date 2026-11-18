import './style.css';
import './postcard.css';
import { createTempleDefinition } from './temple/model.ts';
import { displayTemple } from './temple/render.ts';
import { createMotionPlan } from './temple/animation.ts';
import { createLandingPrototype } from './temple/landing-prototype.ts';
import { createFullConstruction, prominentLandings } from './temple/full-construction.ts';
import { refineCollectible } from './temple/refine-collectible.ts';
import { EnvironmentAudio, type EnvironmentHover } from './temple/environment-audio.ts';
import { LandingAudio } from './temple/landing-audio.ts';
import { ConstructionAudio } from './temple/audio.ts';
import { installProgressBorder } from './progress-border.ts';
import { BUILD_DURATION } from './temple/animation.ts';
import { installFacts } from './facts.ts';
import { installPostcard } from './postcard.ts';
import { shoreTemple } from './buildings.ts';
import { installHeritageHeading } from './heritage-heading.ts';

const container = document.querySelector<HTMLElement>('#temple-viewport')!;
const facts=installFacts(document.querySelector<HTMLElement>('.facts')!);
const heading=installHeritageHeading(document.querySelector<HTMLElement>('.heritage-heading')!);
if(import.meta.hot)import.meta.hot.dispose(()=>{facts.dispose();heading.dispose();});

try {
  const inspection = import.meta.env.DEV ? new URLSearchParams(location.search).get('compare') : null;
  let definition = createTempleDefinition(inspection === 'benchmark' || inspection === 'hidden' || inspection === 'aggressive' ? inspection : 'balanced');
  const fullPreview = !(import.meta.env.DEV && ['landing','legacy'].includes(new URLSearchParams(location.search).get('preview')??''));
  if(fullPreview && !(import.meta.env.DEV && new URLSearchParams(location.search).get('detail')==='original')) definition=refineCollectible(definition);
  const prototype = fullPreview ? createFullConstruction(definition.pieces) : import.meta.env.DEV && new URLSearchParams(location.search).get('preview')==='landing' ? createLandingPrototype(definition.pieces) : undefined;
  const previewDuration=fullPreview ? Math.max(5000,Math.ceil(Math.max(...prototype!.map(m=>m.settled))+80)) : undefined;
  const finalLock = prototype ? Math.max(...(fullPreview ? prominentLandings(prototype) : prototype).map(m => m.settled)) : BUILD_DURATION;
  const planModule = fullPreview ? await import('./temple/plan-view.ts') : undefined;
  const coastalPreview = fullPreview;
  const temple = displayTemple(container, definition, prototype, previewDuration, coastalPreview ? finalLock : undefined, planModule?.createPlanView);
  const sound = prototype ? new LandingAudio(fullPreview ? prominentLandings(prototype) : prototype,undefined,undefined,fullPreview ? 220 : Infinity,fullPreview) : new ConstructionAudio(createMotionPlan(definition.pieces),undefined,definition.pieces.map(p=>p.size[0]*p.size[1]*p.size[2]));
  const environmentSound = new EnvironmentAudio(() => sound instanceof LandingAudio ? sound.interactionOutput() : undefined);
  const environmentHover = (event: Event) => environmentSound.setHover((event as CustomEvent<EnvironmentHover>).detail);
  const planSound = (event: Event) => environmentSound.transition((event as CustomEvent<boolean>).detail);
  container.addEventListener('environmenthover', environmentHover);
  container.addEventListener('planstate', planSound);
  if (import.meta.env.DEV && prototype) Object.assign(window, { __landingPreview: {temple,sound,environmentSound,events:prototype,container,duration:previewDuration??3000} });
  const rebuild = document.createElement('button');
  rebuild.className = 'rebuild control-button'; rebuild.type = 'button';
  rebuild.innerHTML = '<img src="/ui/rebuild.svg" width="16" height="16" alt="" aria-hidden="true"><span class="control-label">Rebuild</span>';
  rebuild.setAttribute('aria-label', 'Rebuild the Shore Temple');
  const controls=document.createElement('div');controls.className='controls';
  controls.setAttribute('role','group');controls.setAttribute('aria-label','Model controls');
  const controlsLeft=document.createElement('div');controlsLeft.className='controls-left control-recess';
  const controlsRight=document.createElement('div');controlsRight.className='controls-right control-recess';
  const mute=document.createElement('button');mute.className='mute control-button';mute.type='button';
  const updateMute=()=>{
    mute.setAttribute('aria-label',sound.muted?'Sound off — unmute sounds':'Sound on — mute sounds');
    mute.title=sound.muted?'Unmute':'Mute';mute.setAttribute('aria-pressed',String(!sound.muted));
    mute.innerHTML=`${sound.muted?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9 5 6m0-6-5 6"/></svg>':'<img src="/ui/sound-on.svg" width="16" height="16" alt="" aria-hidden="true">'}<span class="control-label">Sound ${sound.muted?'off':'on'}</span>`;
  };
  updateMute();
  mute.addEventListener('click',()=>{
    const pending=sound.setMuted(!sound.muted);environmentSound.setEnabled(false);updateMute();
    void pending.catch(error=>{console.warn('Construction sound unavailable.',error);}).finally(()=>{environmentSound.setEnabled(!sound.muted);updateMute();});
  });
  container.addEventListener('buildprogress',event=>{
    const {elapsed,building,timelineSampleTime}=(event as CustomEvent<{elapsed:number;building:boolean;timelineSampleTime:number}>).detail;
    if(sound instanceof LandingAudio)sound.update(elapsed,building,timelineSampleTime);else sound.update(elapsed,building);
  });
  // The approved final locking click occurs just before the rotation's end hold.
  // Finish the border on that same displayed seating frame, preserving all audio.
  const progressBorder = installProgressBorder(container, finalLock);
  let restarting = false;
  rebuild.addEventListener('click', async () => {
    if (restarting || container.dataset.state !== 'complete') return;
    environmentSound.reset();
    restarting = true;
    rebuild.disabled = true;
    postcardPreview.reset();
    temple.resetPlanView?.();
    temple.resetLandscape?.();
    try {
      if (await progressBorder.retract()) temple.rebuild();
    } finally {
      restarting = false;
      rebuild.disabled = container.getAttribute('data-state') === 'building';
    }
  });
  const visibility=()=>{sound.setHidden(document.hidden);environmentSound.setHidden(document.hidden);};visibility();
  document.addEventListener('visibilitychange',visibility);
  const postcard=document.createElement('button');postcard.className='postcard control-button';postcard.type='button';postcard.disabled=true;
  postcard.title='Postcard downloads are coming soon';postcard.setAttribute('aria-label','Download Postcard — coming soon');
  postcard.innerHTML='<img src="/ui/download.svg" width="16" height="16" alt="" aria-hidden="true"><span>Download Postcard</span>';
  controlsLeft.append(rebuild,mute);controlsRight.append(postcard);controls.append(controlsLeft,controlsRight);container.closest('.exhibit')!.after(controls);
  progressBorder.fitControls();
  const postcardPreview=installPostcard(postcard,container,temple,shoreTemple);
  container.addEventListener('buildstate', event => {
    if ((event as CustomEvent<boolean>).detail) environmentSound.reset();
    rebuild.disabled = (event as CustomEvent<boolean>).detail;
    rebuild.querySelector('.control-label')!.textContent = rebuild.disabled ? 'Assembling…' : 'Rebuild';
  });
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('record')) {
    import('./recording.ts').then(({ installRecording }) => installRecording(container, temple.rebuild));
  }
  if (import.meta.hot) import.meta.hot.dispose(() => {postcardPreview.dispose();progressBorder.dispose();environmentSound.dispose();container.removeEventListener('environmenthover',environmentHover);container.removeEventListener('planstate',planSound);sound.dispose();document.removeEventListener('visibilitychange',visibility);temple.dispose();controls.remove();});
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
