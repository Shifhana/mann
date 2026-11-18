import { BUILD_DURATION, type Motion } from './animation.ts';

const shells=new Map<string,Float32Array>();
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
/** Noise-excited hollow plastic resonances, with a dry contact edge. */
function shell(rate:number,variant:number,size:number,crisp:boolean){
 const key=`${rate}:${variant}:${size}:${crisp}`;
 const cached=shells.get(key);if(cached)return cached;
 const pcm=new Float32Array(Math.ceil((crisp?.095:.08)*rate));
 let seed=947+variant*197+size*53,low=0;
 const base=(crisp?1650:[2550,1780,1160][size])*(.94+variant*.018);
 const resonator=(f:number,q:number)=>{
  const w=2*Math.PI*Math.min(f,rate*.43)/rate,alpha=Math.sin(w)/(2*q);
  const b=alpha/(1+alpha),a1=-2*Math.cos(w)/(1+alpha),a2=(1-alpha)/(1+alpha);
  let x1=0,x2=0,y1=0,y2=0;
  return (x:number)=>{const y=b*x-b*x2-a1*y1-a2*y2;x2=x1;x1=x;y2=y1;y1=y;return y;};
 };
 const body=resonator(base,1.1),edge=resonator(base*2.16,1.4),shellMode=resonator(base*3.47,1.6);
 let peak=0;
 for(let n=0;n<pcm.length;n++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const t=n/rate,noise=seed/4294967296*2-1;low+=.13*(noise-low);
  const excitation=noise*Math.exp(-t*(crisp?230:190));
  const resonances=body(excitation)*1.4+edge(excitation)*.65+shellMode(excitation)*.25;
  const dry=(noise-low)*Math.exp(-t*(crisp?650:500))*.2;
  const rub=low*Math.exp(-t*125)*.12;
  pcm[n]=Math.min(1,t/.00018)*(resonances+dry+rub)*Math.exp(-t*42);
  peak=Math.max(peak,Math.abs(pcm[n]));
 }
 for(let i=0;i<pcm.length;i++)pcm[i]*=.9/Math.max(.1,peak);
 shells.set(key,pcm);return pcm;
}

/** Pick an actual landing in each audible cluster, favouring the larger brick. */
export function landingSoundEvents(motions:Motion[],volumes:number[]=[]){
 const units=new Map<Motion,number>();
 motions.forEach((m,i)=>units.set(m,Math.max(units.get(m)??0,volumes[i]??4)));
 const ordered=[...units].map(([motion,volume])=>({time:motion.delay+motion.duration,volume})).sort((a,b)=>a.time-b.time);
 const events:typeof ordered=[];
 for(let i=0;i<ordered.length;){
  const first=ordered[i].time;let selected=ordered[i++];
  while(i<ordered.length&&ordered[i].time-first<36){if(ordered[i].volume>selected.volume)selected=ordered[i];i++;}
  events.push(selected);
 }
 return events;
}

/** Original stereo synthesis; no recordings or third-party sound assets. */
export function constructionPCM(motions:Motion[],rate=48000,finish=false,volumes:number[]=[]){
 const length=Math.ceil((finish?.16:BUILD_DURATION/1000+.12)*rate);
 const channels=[new Float32Array(length),new Float32Array(length)];
 let seed=7219;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const impact=(time:number,level:number,pan:number,variant:number,size:number,crisp=false)=>{
  const pcm=shell(rate,Math.floor(variant),size,crisp),start=Math.round(time*rate);
  const pitch=.94+random()*.12,left=level*Math.sqrt((1-pan)/2),right=level*Math.sqrt((1+pan)/2);
  for(let n=0;n<pcm.length/pitch;n++){
   const i=start+n;if(i>=length)break;
   const at=n*pitch,j=Math.floor(at),fraction=at-j;
   const sample=(pcm[j]??0)*(1-fraction)+(pcm[j+1]??0)*fraction;
   channels[0][i]+=sample*left;channels[1][i]+=sample*right;
  }
 };
 if(finish){
  impact(.002,.58,0,3,1,true);
  impact(.0035,.13,.02,2,2); // Fused lower shell body, perceived as one snap.
 }else{
  const units=[...new Set(motions)];
  // A gentle handful tipping out: clustered, irregular collisions and small recontacts.
  if(units.length)for(let t=.012;t<.58;t+=.009+random()*.022){
   const fade=Math.min(1,t/.08)*(.55+.45*(1-t/.58));
   const level=(.045+random()*.035)*fade,pan=(random()-.5)*.8;
   impact(t,level,pan,random()*8,Math.floor(random()*3));
   impact(t+.004+random()*.015,level*.36,pan,random()*8,Math.floor(random()*3));
  }
  // Falling contacts follow occupied rain waves; avoid a continuous hiss.
  for(let t=.34;t<BUILD_DURATION/1000-.23;t+=.014+random()*.028){
   const active=units.filter(m=>t*1000>=m.delay&&t*1000<m.delay+m.duration*.9).length;
   if(!active)continue;
   const level=(.021+random()*.018)*(.5+Math.min(active/45,1)*.5),pan=(random()-.5)*.8;
   impact(t,level,pan,random()*8,Math.floor(random()*3));
   if(random()<.5)impact(t+.006+random()*.012,level*.35,pan,random()*8,1);
  }
  for(const event of landingSoundEvents(motions,volumes)){
   const weight=clamp(Math.log2(Math.max(.4,event.volume)/2)/5);
   const size=weight<.28?0:weight<.65?1:2;
   const level=(.14+random()*.065)*(.88+weight*.3),pan=(random()-.5)*.65;
   // The primary click stays exactly on a real landing; only quiet recontacts vary.
   impact(event.time/1000,level,pan,random()*8,size);
   if(random()<.65)impact(event.time/1000+.005+random()*.009,level*.22,pan,random()*8,size);
  }
 }
 // Gentle bus saturation preserves transient headroom without hard clipping.
 for(const pcm of channels)for(let i=0;i<pcm.length;i++)pcm[i]=.72*Math.tanh(pcm[i]/.72);
 return channels;
}

export class ConstructionAudio {
  muted=true;
  private context:AudioContext|undefined;
  private bed:AudioBuffer|undefined;
  private finish:AudioBuffer|undefined;
  private source:AudioBufferSourceNode|undefined;
  private voices=new Set<AudioBufferSourceNode>();
  private elapsed=BUILD_DURATION;
  private building=false;
  private hidden=false;
  private disposed=false;
  private revision=0;
  private startedAt=0;
  private motions:Motion[];
  private createContext:()=>AudioContext;
  private volumes:number[];
  constructor(motions:Motion[],createContext=()=>new AudioContext({latencyHint:'interactive'}),volumes:number[]=[]){
    this.motions=motions;this.createContext=createContext;this.volumes=volumes;
  }
  private buffer(pcm:Float32Array[]){
    const ctx=this.context!,buffer=ctx.createBuffer(2,pcm[0].length,ctx.sampleRate);
    pcm.forEach((data,i)=>buffer.copyToChannel(new Float32Array(data),i));return buffer;
  }
  private stop(){
    for(const source of this.voices){source.onended=null;source.stop();source.disconnect();}
    this.voices.clear();this.source=undefined;
  }
  private play(buffer:AudioBuffer,offset=0){
    const ctx=this.context!,source=ctx.createBufferSource();source.buffer=buffer;
    source.connect(ctx.destination);this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();if(this.source===source)this.source=undefined;};
    source.start(0,offset);return source;
  }
  private join(){
    if(this.muted||this.hidden||this.disposed||!this.building||this.context?.state!=='running')return;
    this.stop();this.source=this.play(this.bed!,this.elapsed/1000);
    this.startedAt=this.context.currentTime-this.elapsed/1000;
  }
  async setMuted(muted:boolean){
    this.muted=muted;const revision=++this.revision;this.stop();
    if(muted||this.disposed)return;
    try {
      if(!this.context){
        this.context=this.createContext();
        this.bed=this.buffer(constructionPCM(this.motions,this.context.sampleRate,false,this.volumes));
        this.finish=this.buffer(constructionPCM([],this.context.sampleRate,true));
      }
      await this.context.resume();
      if(revision===this.revision&&!this.muted)this.join();
    } catch(error){if(revision===this.revision){this.muted=true;this.stop();}throw error;}
  }
  update(elapsed:number,building:boolean){
    const wasBuilding=this.building,rewound=elapsed<this.elapsed;
    this.elapsed=elapsed;this.building=building;
    if(this.muted||this.hidden||this.disposed)return;
    if(!building){
      if(wasBuilding){this.stop();if(elapsed>=BUILD_DURATION&&this.context?.state==='running')this.play(this.finish!);}
      return;
    }
    if(rewound||!this.source||this.context&&Math.abs(this.context.currentTime-this.startedAt-elapsed/1000)>.09)this.join();
  }
  setHidden(hidden:boolean){this.hidden=hidden;if(hidden)this.stop();else this.join();}
  dispose(){this.disposed=true;this.revision++;this.stop();void this.context?.close();}
}
