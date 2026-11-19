const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const ease=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};
export const HEADING_DURATION=460;
export const HEADING_PARTICLES=28;
export const HEADING_HOLD=2000;
/** Automatic intent shares the existing manual animation, never a second loop. */
export class HeadingDemo {
 state:'armed'|'revealing'|'holding'|'complete'='armed';
 deadline:number|undefined;private remaining=HEADING_HOLD;
 get active(){return this.state==='revealing'||this.state==='holding';}
 start(reduced=false){if(this.state!=='armed')return;this.state=reduced?'complete':'revealing';}
 settled(now:number,hidden=false){if(this.state==='revealing'){this.state='holding';this.remaining=HEADING_HOLD;if(!hidden)this.deadline=now+this.remaining;}}
 advance(now:number,reduced=false){if((reduced&&this.active)||(this.deadline!==undefined&&now>=this.deadline)){this.state='complete';this.deadline=undefined;}}
 setHidden(hidden:boolean,now:number){if(this.state!=='holding')return;if(hidden&&this.deadline!==undefined){this.remaining=Math.max(0,this.deadline-now);this.deadline=undefined;}else if(!hidden&&this.deadline===undefined)this.deadline=now+this.remaining;}
 reset(){this.state='armed';this.deadline=undefined;this.remaining=HEADING_HOLD;}
}
export function headingMix(progress:number){const t=ease((progress-.34)/.28);return{english:t,tamil:t};}
export function headingParticle(progress:number,index:number,from:{x:number;y:number},to:{x:number;y:number}){
  const start=.12+(index%5)*.018,end=.76+(index%4)*.025;
  const phase=clamp((progress-start)/(end-start)),t=ease(phase);
  return{x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t-1.4*Math.sin(Math.PI*t),alpha:.7*Math.pow(Math.sin(Math.PI*phase),1.4)};
}
export async function headingFontsReady(fonts:Pick<FontFaceSet,'load'>,text:string){
  try {const faces=await Promise.all([fonts.load("400 17.25px 'Tiro Tamil'",text),fonts.load("600 20px 'Crimson Text'",'SHORE TEMPLE')]);return faces.every(group=>group.length>0);}catch{return false;}
}

/** Whole shaped text runs and 28 paired ink-to-ink paths, only while active. */
export interface DissolveOptions {from:string;to:string;width?:number;left?:number;align?:CanvasTextAlign;load:(fonts:Pick<FontFaceSet,'load'>,text:string)=>Promise<boolean>;}
export function installTextDissolve(root:HTMLElement,options:DissolveOptions,fonts:Pick<FontFaceSet,'load'>=document.fonts,build?:HTMLElement){
  const english=root.querySelector<HTMLElement>(options.from)!,tamil=root.querySelector<HTMLElement>(options.to)!;
  const canvas=document.createElement('canvas');canvas.className='heading-particles';canvas.setAttribute('aria-hidden','true');root.append(canvas);
  const context=canvas.getContext('2d')!;
  const ratio=Math.min(devicePixelRatio||1,2),width=options.width??230,height=60,left=options.left??10,top=16;
  canvas.width=width*ratio;canvas.height=height*ratio;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,ready=false,frame=0,last=0,progress=0,target=0,holdTimer=0;
  const demo=new HeadingDemo();
  type Ink={x:number;y:number};
  type TextRaster={image:HTMLCanvasElement;ink:Ink[]};
  const rasters:TextRaster[]=[],paths:{from:Ink;to:Ink}[]=[];
  function raster(element:HTMLElement):TextRaster{
    const image=document.createElement('canvas');image.width=canvas.width;image.height=canvas.height;
    const draw=image.getContext('2d')!,style=getComputedStyle(element);
    const marker=document.createElement('i');marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';element.append(marker);
    const baseline=marker.getBoundingClientRect().top-root.getBoundingClientRect().top;marker.remove();
    draw.scale(ratio,ratio);draw.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;draw.letterSpacing=style.letterSpacing==='normal'?'0px':style.letterSpacing;draw.fillStyle=style.color;draw.textAlign=options.align??'left';
    const x=left+(options.align==='right'?root.clientWidth:0);
    const stroke=parseFloat(style.webkitTextStrokeWidth);if(stroke>0){draw.lineWidth=stroke;draw.strokeStyle=style.webkitTextStrokeColor;draw.strokeText(element.textContent??'',x,top+baseline);}
    draw.fillText(element.textContent??'',x,top+baseline);
    const pixels=draw.getImageData(0,0,image.width,image.height).data,ink:Ink[]=[];
    // Sample actual opaque ink, ordered horizontally. No particle starts in a
    // glyph's empty bounding box or ends outside the shaped Tamil lettering.
    for(let x=0;x<image.width;x+=2)for(let y=0;y<image.height;y+=2)if(pixels[(y*image.width+x)*4+3]>160)ink.push({x:x/ratio,y:y/ratio});
    return{image,ink};
  }
  function draw(){
    context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);context.setTransform(ratio,0,0,ratio,0,0);
    const mix=headingMix(progress);
    // A short, continuous ink handoff keeps either complete title legible for
    // most of the transition instead of eroding both into random fragments.
    context.globalAlpha=1-mix.english;context.drawImage(rasters[0].image,0,0,width,height);
    context.globalAlpha=mix.tamil;context.drawImage(rasters[1].image,0,2*(1-mix.tamil),width,height);
    context.fillStyle='#b69a76';context.strokeStyle='#c1a16c';
    paths.forEach((path,index)=>{
      const p=headingParticle(progress,index,path.from,path.to);if(p.alpha<.001)return;
      context.globalAlpha=p.alpha;context.beginPath();context.arc(p.x,p.y,.42+(index%3)*.06,0,Math.PI*2);context.fill();
      if(index===4||index===13||index===23){context.globalAlpha=p.alpha*.45;context.lineWidth=.5;context.beginPath();context.moveTo(p.x-1.1,p.y);context.lineTo(p.x+1.1,p.y);context.moveTo(p.x,p.y-1.1);context.lineTo(p.x,p.y+1.1);context.stroke();}
    });context.globalAlpha=1;
  }
  function scheduleHold(){clearTimeout(holdTimer);holdTimer=0;if(demo.deadline!==undefined&&!document.hidden)holdTimer=window.setTimeout(update,Math.max(1,demo.deadline-performance.now()));}
  function settle(){root.dataset.headingLanguage=target?'tamil':'english';root.removeAttribute('data-dissolving');context.clearRect(0,0,canvas.width,canvas.height);if(target)demo.settled(performance.now(),document.hidden);root.dataset.headingDemo=demo.state;scheduleHold();}
  function sample(now:number){const time=Math.max(last,now);progress=clamp(progress+(target?1:-1)*(time-last)/HEADING_DURATION);last=time;}
  function tick(now:number){frame=0;if(disposed)return;sample(now);draw();if(progress===target)settle();else frame=requestAnimationFrame(tick);}
  function update(){if(!ready||disposed)return;const now=performance.now();demo.advance(now,reduced.matches);sample(now);target=+(demo.active||root.matches(':hover')||root.matches(':focus-visible'));root.dataset.headingDemo=demo.state;if(reduced.matches){cancelAnimationFrame(frame);frame=0;progress=target;settle();return;}if(progress===target){settle();return;}
    // Paint the complete current run before hiding its DOM replacement. This
    // removes the blank handoff frame, including during rapid reversals.
    draw();root.setAttribute('data-dissolving','');if(!frame)frame=requestAnimationFrame(tick);
  }
  function checkComplete(){if(build?.dataset.ready==='true'&&build.dataset.state==='complete'&&(!build.dataset.landscape||build.dataset.landscape==='complete')){demo.start(reduced.matches);build.removeEventListener('templeframe',checkComplete);update();}}
  function resetDemo(){clearTimeout(holdTimer);holdTimer=0;demo.reset();build?.addEventListener('templeframe',checkComplete);update();}
  const buildState=(event:Event)=>{if((event as CustomEvent<boolean>).detail)resetDemo();};
  const visibility=()=>{demo.setHidden(document.hidden,performance.now());scheduleHold();if(!document.hidden){last=performance.now();update();checkComplete();}};
  for(const event of ['pointerenter','pointerleave','focus','blur'])root.addEventListener(event,update);
  reduced.addEventListener('change',update);
  build?.addEventListener('templeframe',checkComplete);build?.addEventListener('buildstate',buildState);document.addEventListener('visibilitychange',visibility);
  void options.load(fonts,tamil.textContent??'').then(loaded=>{if(disposed||!loaded)return;rasters.push(raster(english),raster(tamil));if(rasters.some(r=>!r.ink.length))return;
    for(let i=0;i<HEADING_PARTICLES;i++){const pick=(r:TextRaster)=>r.ink[Math.min(r.ink.length-1,Math.floor((i+.5)/HEADING_PARTICLES*r.ink.length))];paths.push({from:pick(rasters[0]),to:pick(rasters[1])});}
    ready=true;root.setAttribute('data-tamil-ready','');checkComplete();update();});
  return{resetDemo,dispose(){disposed=true;clearTimeout(holdTimer);cancelAnimationFrame(frame);for(const event of ['pointerenter','pointerleave','focus','blur'])root.removeEventListener(event,update);reduced.removeEventListener('change',update);build?.removeEventListener('templeframe',checkComplete);build?.removeEventListener('buildstate',buildState);document.removeEventListener('visibilitychange',visibility);canvas.remove();root.removeAttribute('data-tamil-ready');root.removeAttribute('data-dissolving');root.removeAttribute('data-heading-language');root.removeAttribute('data-heading-demo');for(const raster of rasters){raster.image.width=raster.image.height=0;}}};
}

export function installHeritageHeading(root:HTMLElement,fonts:Pick<FontFaceSet,'load'>=document.fonts,build?:HTMLElement){
  return installTextDissolve(root,{from:'.heading-english',to:'.heading-tamil',load:headingFontsReady},fonts,build);
}
