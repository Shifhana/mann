import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EnvironmentAudio,coastalPCM} from '../src/temple/environment-audio.ts';
class Context {
 state='running';currentTime=0;sampleRate=8000;sources=[];
 createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return{duration:length/rate,copyToChannel(p,i){data[i].set(p)},getChannelData(i){return data[i]}}}
 createGain(){return{gain:{value:0,cancelAndHoldAtTime(){},linearRampToValueAtTime(v){this.value=v}},connect(){},disconnect(){}}}
 createBufferSource(){const s={loop:false,onended:null,connect(){},disconnect(){},start(){},stop(){this.stopped=true}};this.sources.push(s);return s;}
}
test('environment stays silent before unlock; hover movement never layers or restarts a bed',()=>{
 const c=new Context(),a=new EnvironmentAudio(()=>({context:c,node:{}}));a.setHover('sea');assert.equal(c.sources.length,0);a.setEnabled(true);assert.equal(c.sources.length,1);assert.equal(c.sources[0].loop,true);
 for(let i=0;i<40;i++)a.setHover('sea');assert.equal(c.sources.length,1);a.setHover('none');a.setHover('sea');assert.equal(c.sources.length,1);assert.equal(c.sources[0].stopped,undefined);a.dispose();assert.equal(c.sources[0].stopped,true);
});

test('sea playback stays quiet across hover resumes without restarting its loop',()=>{
 const c=new Context(),a=new EnvironmentAudio(()=>({context:c,node:{}}));a.setEnabled(true);a.setHover('sea');const sea=a.beds.get('sea');assert.equal(sea.gain.gain.value,.07);a.setHover('none');assert.equal(sea.gain.gain.value,0);a.setHover('sea');assert.equal(a.beds.get('sea'),sea);assert.equal(sea.gain.gain.value,.07);assert.equal(c.sources.length,1);assert.deepEqual([...a.buffers.keys()],['sea']);a.dispose();
});
test('sea fades, mute, hidden, reset and disposal leave no active resources',()=>{
 const c=new Context(),a=new EnvironmentAudio(()=>({context:c,node:{}}));a.setEnabled(true);a.setHover('sea');a.setHover('none');assert.equal(c.sources.length,1);assert.equal(a.beds.get('sea').gain.gain.value,0);
 a.transition(true);a.transition(false);assert.equal(a.clicks.size,1);assert.equal(c.sources[1].stopped,true);a.setEnabled(false);assert.ok(c.sources.every(s=>s.stopped));a.setEnabled(true);a.setHidden(true);assert.equal(a.beds.size,0);a.setHidden(false);assert.equal(a.beds.size,0);a.setHover('sea');a.reset();assert.equal(a.beds.size,0);assert.equal(a.clicks.size,0);a.dispose();a.setHover('sea');a.setEnabled(true);assert.equal(a.beds.size,0);
});
test('suspended context cannot play; completed transition clicks have distinct restrained timbres',()=>{
 const c=new Context(),a=new EnvironmentAudio(()=>({context:c,node:{}}));c.state='suspended';a.setEnabled(true);a.setHover('sea');a.transition(true);assert.equal(c.sources.length,0);c.state='running';a.setEnabled(true);assert.equal(c.sources.length,1);a.transition(true);const open=c.sources.at(-1).buffer.getChannelData(0).slice();a.transition(false);assert.notDeepEqual(c.sources.at(-1).buffer.getChannelData(0),open);a.dispose();
});
test('original stereo sea loop is deterministic, finite, restrained and seamlessly joined',()=>{
 const pcm=coastalPCM(8000);assert.deepEqual(pcm,coastalPCM(8000));assert.notDeepEqual(pcm[0],pcm[1]);for(const channel of pcm){assert.equal(channel.length,96000);let sum=0,peak=0,diff=0;for(let i=0;i<channel.length;i++){assert.ok(Number.isFinite(channel[i]));sum+=channel[i]**2;peak=Math.max(peak,Math.abs(channel[i]));if(i)diff+=(channel[i]-channel[i-1])**2;}assert.ok(peak<1&&Math.sqrt(sum/channel.length)>.01);assert.ok(Math.abs(channel[0]-channel.at(-1))<Math.sqrt(diff/channel.length)*4);}
});

test('idle landscape creates no audio voices; sea is the only prepared environmental bed',()=>{
 const c=new Context(),a=new EnvironmentAudio(()=>({context:c,node:{}}));a.setEnabled(true);a.setHover('none');assert.equal(c.sources.length,0);a.setHover('sea');a.setHover('none');assert.equal(c.sources.length,1);assert.deepEqual([...a.buffers.keys()],['sea']);assert.deepEqual([...a.beds.keys()],['sea']);a.dispose();
});
test('worker preparation cannot play after mute and is terminated on completion or disposal',()=>{
 const saved=globalThis.Worker,workers=[];
 globalThis.Worker=class{constructor(){workers.push(this)}postMessage(){}terminate(){this.terminated=true}};
 try{const c=new Context(),a=new EnvironmentAudio(()=>({context:c,node:{}}));a.setEnabled(true);a.setHover('sea');assert.equal(workers.length,1);assert.equal(c.sources.length,0);a.setEnabled(false);workers[0].onmessage({data:{sea:coastalPCM(8000)}});assert.equal(workers[0].terminated,true);assert.equal(c.sources.length,0);assert.deepEqual([...a.buffers.keys()],['sea']);a.setEnabled(true);assert.equal(c.sources.length,1);a.dispose();const second=new EnvironmentAudio(()=>({context:c,node:{}}));second.setEnabled(true);second.dispose();assert.equal(workers[1].terminated,true);}
 finally{if(saved===undefined)delete globalThis.Worker;else globalThis.Worker=saved;}
});
