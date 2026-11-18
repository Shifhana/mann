import type {LandingMotion} from './landing-prototype.ts';
export function landingVoice(event:LandingMotion,kind:'contact'|'lock',index:number){
 const weight=Math.max(0,Math.min(1,Math.log2(Math.max(1,event.volume))/8));
 const visibility=event.visibility??1,intensity=Math.max(.45,Math.min(1,(event.impactSpeed??180)/240));
 return {level:(kind==='contact'?.22+weight*.16:.17+weight*.11)*(.35+.65*visibility)*(kind==='contact'?intensity:1),
 pitch:(kind==='contact'?1.10-weight*.25:1.13-weight*.16)+(index%5-2)*.009,
 sampleIndex:(kind==='lock'?3:0)+index%3};
}
async function recordedSamples(ctx:AudioContext){
 const decode=async(url:string)=>{const r=await fetch(`${import.meta.env.BASE_URL}audio/landing-prototype/${url}`);if(!r.ok)throw Error('LEGO sound unavailable');return ctx.decodeAudioData(await r.arrayBuffer());};
 const contacts=await Promise.all([233653,233648,233652].map(id=>decode(`${id}.mp3`)));
 const connections=await decode('connect.mp3');
 const trim=(source:AudioBuffer,from=0,to=source.duration)=>{
  const first=Math.floor(from*ctx.sampleRate),end=Math.min(source.length,Math.floor(to*ctx.sampleRate)),data=source.getChannelData(0);
  let peak=0;for(let i=first;i<end;i++)peak=Math.max(peak,Math.abs(data[i]));
  let start=first;while(start<end&&Math.abs(data[start])<peak*.04)start++;start=Math.max(first,start-2);
  const length=Math.min(end-start,Math.ceil(ctx.sampleRate*.085)),out=ctx.createBuffer(source.numberOfChannels,length,ctx.sampleRate);
  for(let c=0;c<source.numberOfChannels;c++){const a=source.getChannelData(c),b=out.getChannelData(c);for(let i=0;i<length;i++)b[i]=a[start+i]/Math.max(.01,peak)*Math.min(1,(length-i)/(ctx.sampleRate*.003));}return out;
 };
 return [...contacts.map(b=>trim(b)),...[[.155,.245],[1.145,1.23],[3.055,3.14]].map(([a,b])=>trim(connections,a,b))];
}
/** Dry recorded LEGO contacts and stud connections, scheduled on the shared timeline. */
export class LandingAudio {
 muted=true;
 private context:AudioContext|undefined;
 private samples:AudioBuffer[]=[];
 private loading:Promise<void>|undefined;
 private voices=new Map<AudioBufferSourceNode,GainNode>();
 private elapsed=3000;private building=false;private hidden=false;private disposed=false;private revision=0;
 private epoch:number|undefined;private cursor=0;private age=0;
 private capture:MediaStreamAudioDestinationNode|undefined;
 private interactionBus:GainNode|undefined;
 private timeline:{time:number;kind:'contact'|'lock';index:number}[];
 private events:LandingMotion[];private factory:()=>AudioContext;private loader:(ctx:AudioContext)=>Promise<AudioBuffer[]>;private lookAhead:number;private frameLocked:boolean;
 /** Development verification: sources actually scheduled, not inferred audible events. */
 audit:{id:string;kind:string;time:number;contextTime:number;performanceTime:number;sampleIndex:number;pitch:number;level:number;duration:number}[]=[];
 constructor(events:LandingMotion[],factory=()=>new AudioContext({latencyHint:'interactive'}),loader=recordedSamples,lookAhead=Infinity,frameLocked=false){
  this.events=events;this.factory=factory;this.loader=loader;this.lookAhead=lookAhead;this.frameLocked=frameLocked;
  this.timeline=events.flatMap((e,index)=>[{time:e.contact,kind:'contact' as const,index},{time:e.settled,kind:'lock' as const,index}]).sort((a,b)=>a.time-b.time);
 }
 private stop(){for(const [voice,gain]of this.voices){voice.onended=null;voice.stop();voice.disconnect();gain.disconnect();}this.voices.clear();this.epoch=undefined;this.cursor=0;}
 private fillWindow(){
  const ctx=this.context;if(!ctx||ctx.state!=='running'||this.muted||this.hidden||this.disposed||!this.building||!this.samples.length)return;
  const elapsed=this.elapsed+this.age;
  while(this.cursor<this.timeline.length){
   const item=this.timeline[this.cursor];if(item.time>(this.frameLocked?this.elapsed:elapsed+this.lookAhead))break;this.cursor++;if(this.frameLocked?this.elapsed-item.time>60:item.time<elapsed)continue;
   const event=this.events[item.index],spec=landingVoice(event,item.kind,item.index),voice=ctx.createBufferSource(),gain=ctx.createGain();
   const sampleIndex=spec.sampleIndex%this.samples.length;voice.buffer=this.samples[sampleIndex];voice.playbackRate.value=spec.pitch;gain.gain.value=spec.level;
   voice.connect(gain);gain.connect(ctx.destination);if(this.capture)gain.connect(this.capture);this.voices.set(voice,gain);
   voice.onended=()=>{this.voices.delete(voice);voice.disconnect();gain.disconnect();};
   const now=performance.now(),contextNow=ctx.currentTime,when=contextNow+(this.frameLocked?0:(item.time-elapsed)/1000);
   const duration=item.kind==='contact'?Math.min(voice.buffer.duration/spec.pitch,Math.max(.012,(event.settled-event.contact)/1000-.018)):voice.buffer.duration/spec.pitch;
   gain.gain.setValueAtTime(spec.level,when);if(item.kind==='contact'){gain.gain.setValueAtTime(spec.level,when+Math.max(0,duration-.003));gain.gain.linearRampToValueAtTime(0,when+duration);}
   this.audit.push({id:event.pieceId,kind:item.kind,time:item.time,contextTime:when,performanceTime:now+(this.frameLocked?0:item.time-elapsed),sampleIndex,pitch:spec.pitch,level:spec.level,duration});
   voice.start(when);if(item.kind==='contact')voice.stop(when+duration+.001);
  }
 }
 private schedule(){const ctx=this.context;if(!ctx||ctx.state!=='running'||!this.samples.length||this.muted||this.hidden||this.disposed||!this.building)return;this.stop();this.epoch=ctx.currentTime-(this.elapsed+this.age)/1000;if(this.frameLocked)while(this.cursor<this.timeline.length&&this.timeline[this.cursor].time<this.elapsed)this.cursor++;this.fillWindow();}
 async setMuted(muted:boolean){
  this.muted=muted;const revision=++this.revision;this.stop();if(muted||this.disposed)return;
  try{this.context??=this.factory();this.loading??=this.loader(this.context).then(s=>{this.samples=s;});await Promise.all([this.context.resume(),this.loading]);if(revision===this.revision&&!this.disposed&&!this.muted)this.schedule();}
  catch(error){if(revision===this.revision){this.muted=true;this.loading=undefined;}throw error;}
 }
 update(elapsed:number,building:boolean,timelineSampleTime?:number){
  const replay=elapsed<this.elapsed||building&&!this.building;this.elapsed=elapsed;this.building=building;this.age=timelineSampleTime===undefined?0:Math.max(0,performance.now()-timelineSampleTime);
  if(replay){this.stop();this.audit=[];}if(!building){this.stop();return;}
  const drift=this.epoch!==undefined&&this.context?Math.abs(this.context.currentTime-this.epoch-(elapsed+this.age)/1000):0;
  if(this.epoch===undefined||!Number.isFinite(this.lookAhead)&&drift>.09)this.schedule();else this.fillWindow();
 }
 setHidden(hidden:boolean){this.hidden=hidden;if(hidden)this.stop();else this.schedule();}
 interactionOutput(){if(!this.context)return undefined;if(!this.interactionBus){this.interactionBus=this.context.createGain();this.interactionBus.connect(this.context.destination);if(this.capture)this.interactionBus.connect(this.capture);}return {context:this.context,node:this.interactionBus};}
 recordingStream(){if(!this.context)throw Error('Enable audio before recording');if(!this.capture){this.capture=this.context.createMediaStreamDestination();this.interactionBus?.connect(this.capture);}return this.capture.stream;}
 dispose(){this.disposed=true;this.revision++;this.stop();this.interactionBus?.disconnect();void this.context?.close();}
}
