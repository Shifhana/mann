import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ConstructionAudio,constructionPCM,landingSoundEvents} from '../src/temple/audio.ts';
import {createMotionPlan,BUILD_DURATION} from '../src/temple/animation.ts';
import {createTempleDefinition} from '../src/temple/model.ts';
const motions=createMotionPlan(createTempleDefinition().pieces);
class Context {
 state='running';sampleRate=48000;currentTime=0;destination={};sources=[];
 async resume(){} async close(){this.state='closed';}
 createBuffer(channels,length,rate){return {duration:length/rate,copyToChannel(){},channels,length};}
 createBufferSource(){const s={onended:null,buffer:null,stopped:false,connect(){},disconnect(){},start(when,offset){this.offset=offset;},stop(){this.stopped=true;}};this.sources.push(s);return s;}
 live(){return this.sources.filter(s=>!s.stopped);}
}
test('audio starts muted without creating an AudioContext; unmute joins current progress',async()=>{
 const c=new Context();let created=0;const a=new ConstructionAudio(motions,()=>{created++;return c;});
 a.update(1450,true);assert.equal(created,0);assert.equal(a.muted,true);
 await a.setMuted(false);assert.equal(c.live().length,1);assert.equal(c.live()[0].offset,1.45);
 a.dispose();assert.equal(c.live().length,0);
});
test('mute cancels playback, unmute seeks forward, and Rebuild replaces rather than layers audio',async()=>{
 const c=new Context(),a=new ConstructionAudio(motions,()=>c);
 a.update(400,true);await a.setMuted(false);await a.setMuted(true);assert.equal(c.live().length,0);
 a.update(1800,true);await a.setMuted(false);assert.equal(c.live()[0].offset,1.8);
 a.update(0,true);assert.equal(c.live().length,1);assert.equal(c.live()[0].offset,0);
 a.dispose();
});
test('completion makes exactly one final click; idle/unmute never replays it',async()=>{
 const c=new Context(),a=new ConstructionAudio(motions,()=>c);
 a.update(3300,true);await a.setMuted(false);
 a.update(BUILD_DURATION,false);assert.equal(c.sources.length,2);assert.equal(c.live().length,1);
 assert.ok(c.live()[0].buffer.duration<.2);
 a.update(BUILD_DURATION,false);assert.equal(c.sources.length,2);
 await a.setMuted(true);await a.setMuted(false);assert.equal(c.live().length,0);a.dispose();
});
test('hidden tabs and stale resume promises cannot leak or duplicate sound',async()=>{
 const c=new Context();let resolve;c.resume=()=>new Promise(r=>{resolve=r;});
 const a=new ConstructionAudio(motions,()=>c);a.update(500,true);
 const pending=a.setMuted(false);await a.setMuted(true);resolve();await pending;assert.equal(c.live().length,0);
 c.resume=async()=>{};await a.setMuted(false);a.setHidden(true);assert.equal(c.live().length,0);
 a.update(2200,true);a.setHidden(false);assert.equal(c.live().length,1);assert.equal(c.live()[0].offset,2.2);a.dispose();
});
test('original stereo PCM is deterministic, audible, finite and has ample clipping headroom',()=>{
 const channels=constructionPCM(motions);assert.deepEqual(channels,constructionPCM(motions));
 for(const pcm of [...channels,...constructionPCM([],48000,true)]){
  let peak=0,sum=0;for(const s of pcm){assert.ok(Number.isFinite(s));peak=Math.max(peak,Math.abs(s));sum+=s*s;}
  assert.ok(peak>.02&&peak<.9);assert.ok(Math.sqrt(sum/pcm.length)>.001);
 }
 assert.notDeepEqual(channels[0],channels[1]);
});

test('landing accents stay on actual seating times and prefer larger pieces within a cluster',()=>{
 const a={delay:100,duration:560,x:0,z:0,drop:20},b={...a,delay:110},c={...a,delay:200};
 assert.deepEqual(landingSoundEvents([a,b,c],[.4,48,2]),[{time:670,volume:48},{time:760,volume:2}]);
 const real=landingSoundEvents(motions);const times=new Set(motions.map(m=>m.delay+m.duration));
 assert.ok(real.every(event=>times.has(event.time)));
});

test('larger bricks produce deeper landing textures while the opening is a distinct audible pour',()=>{
 const m={delay:1640,duration:560,x:0,z:0,drop:20};
 const small=constructionPCM([m],48000,false,[.4])[0],large=constructionPCM([m],48000,false,[100])[0];
 const crossings=pcm=>{let n=0;for(let i=105601;i<107040;i++)if((pcm[i]>0)!==(pcm[i-1]>0))n++;return n;};
 assert.ok(crossings(small)>crossings(large)*1.15,'large-part texture should have lower frequency content');
 const opening=small.slice(0,12000);const rms=Math.sqrt(opening.reduce((sum,v)=>sum+v*v,0)/opening.length);
 assert.ok(rms>.003,'opening handful must be clearly audible before the first landing');
});
