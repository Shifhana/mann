import { BUILD_DURATION } from './temple/animation.ts';
/** Development-only, real-time canvas recording. No alternate animation renderer. */
export function installRecording(container: HTMLElement, rebuild: () => void) {
  const button=document.createElement('button'); button.textContent='Record 1× replay';
  button.style.cssText='position:fixed;right:20px;top:100px;z-index:10;padding:8px';
  document.body.append(button);
  button.onclick=()=>{
    button.disabled=true;
    const canvas=document.createElement('canvas'); canvas.width=innerWidth; canvas.height=innerHeight;
    const ctx=canvas.getContext('2d')!;
    const source=container.querySelector('canvas')!;
    let opening=true;
    const paint=()=>{
      ctx.fillStyle='#f2ede4'; ctx.fillRect(0,0,canvas.width,canvas.height);
      const bounds=source.getBoundingClientRect();
      if(!opening)ctx.drawImage(source,bounds.x,bounds.y,bounds.width,bounds.height);
      for(const selector of ['.eyebrow','h1','.location','.colophon p','.rebuild']) {
        const el=document.querySelector<HTMLElement>(selector); if(!el) continue;
        const r=el.getBoundingClientRect(), style=getComputedStyle(el);
        ctx.font=style.font; ctx.fillStyle=style.color; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(el.innerText,r.x+r.width/2,r.y+r.height/2);
      }
    };
    // Encode actual wall-clock frames explicitly. MediaRecorder may suppress
    // unchanged canvas frames, truncating the empty opening and completed hold.
    const chunks:{bytes:Uint8Array<ArrayBuffer>;timestamp:number}[]=[];
    let failed=false;
    const encoder=new VideoEncoder({
      output:chunk=>{const bytes=new Uint8Array(new ArrayBuffer(chunk.byteLength));chunk.copyTo(bytes);chunks.push({bytes,timestamp:chunk.timestamp});},
      error:error=>{failed=true;console.error(error);button.textContent='Recording failed';button.disabled=false;}
    });
    encoder.configure({codec:'vp8',width:canvas.width,height:canvas.height,bitrate:6000000,framerate:30,latencyMode:'realtime'});
    const started=performance.now();
    const capture=()=>{
      if(failed)return;
      const frame=new VideoFrame(canvas,{timestamp:Math.round((performance.now()-started)*1000)});
      encoder.encode(frame,{keyFrame:chunks.length===0});frame.close();
    };
    container.addEventListener('templeframe',paint);
    paint();capture();
    setTimeout(()=>{opening=false;rebuild();},250);
    const timer=window.setInterval(capture,1000/30);
    setTimeout(async()=>{
      clearInterval(timer);capture();container.removeEventListener('templeframe',paint);
      if(failed)return;
      await encoder.flush();encoder.close();
      // IVF: VP8 packets with millisecond timebase, preserving their real timestamps.
      const header=new Uint8Array(32),view=new DataView(header.buffer);
      header.set(new TextEncoder().encode('DKIF'),0);view.setUint16(6,32,true);
      header.set(new TextEncoder().encode('VP80'),8);
      view.setUint16(12,canvas.width,true);view.setUint16(14,canvas.height,true);
      view.setUint32(16,1000,true);view.setUint32(20,1,true);view.setUint32(24,chunks.length,true);
      const packets:BlobPart[]=[header];
      for(const chunk of chunks){const h=new Uint8Array(12),v=new DataView(h.buffer);v.setUint32(0,chunk.bytes.length,true);v.setBigUint64(4,BigInt(Math.round(chunk.timestamp/1000)),true);packets.push(h,chunk.bytes);}
      const res=await fetch('/__recording',{method:'POST',headers:{'Content-Type':'video/x-ivf'},body:new Blob(packets)});
      button.textContent=res.ok?'Recording saved':'Recording failed';button.disabled=false;
    },BUILD_DURATION+2050);
  };
}

