export type EnvironmentHover = 'sea' | 'none';

import {coastalPCM} from './coastal-pcm.ts';
export {coastalPCM} from './coastal-pcm.ts';

/** Shares construction's unlocked context/output, never creates another clock. */
export class EnvironmentAudio {
  private enabled = false;
  private hidden = false;
  private disposed = false;
  private hover: EnvironmentHover = 'none';
  private beds = new Map<string, {source: AudioBufferSourceNode; gain: GainNode; timer?: ReturnType<typeof setTimeout>} >();
  private buffers = new Map<string, AudioBuffer>();
  private clicks = new Map<AudioBufferSourceNode, GainNode>();
  private worker: Worker | undefined;
  private output: () => {context: AudioContext; node: AudioNode} | undefined;
  constructor(output: () => {context: AudioContext; node: AudioNode} | undefined) { this.output = output; }
  private stopBeds() {
    for (const bed of this.beds.values()) { clearTimeout(bed.timer); bed.source.onended = null; bed.source.stop(); bed.source.disconnect(); bed.gain.disconnect(); }
    this.beds.clear();
  }
  private stopClicks() { for (const [source, gain] of this.clicks) { source.onended = null; source.stop(); source.disconnect(); gain.disconnect(); } this.clicks.clear(); }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) { this.stopBeds(); this.stopClicks(); } else this.sync(); }
  setHidden(hidden: boolean) { this.hidden = hidden; if (hidden) { this.hover = 'none'; this.stopBeds(); this.stopClicks(); } }
  setHover(hover: EnvironmentHover) { if (this.hover === hover) return; this.hover = hover; this.sync(); }
  private sync() {
    if (!this.enabled || this.hidden || this.disposed) return;
    const out = this.output(); if (!out || out.context.state !== 'running') return;
    const {context: ctx, node} = out;
    // Prepare the original noise off the render thread. First-hover synthesis
    // otherwise occupies a full frame budget on integrated-GPU laptops.
    if (typeof Worker !== 'undefined' && !this.buffers.has('sea')) {
      if (!this.worker) {
        const worker = this.worker = new Worker(new URL('./environment-audio-worker.ts', import.meta.url), {type: 'module'});
        worker.onmessage = ({data}: MessageEvent<{sea: Float32Array<ArrayBuffer>[]}>) => {
          worker.terminate(); this.worker = undefined;
          if (this.disposed) return;
          const pcm = data.sea, buffer = ctx.createBuffer(2, pcm[0].length, ctx.sampleRate); pcm.forEach((p, i) => buffer.copyToChannel(p, i)); this.buffers.set('sea', buffer);
          this.sync();
        };
        worker.onerror = () => { worker.terminate(); this.worker = undefined; this.enabled = false; console.warn('Coastal audio preparation unavailable.'); };
        worker.postMessage(ctx.sampleRate);
      }
      return;
    }
    for (const kind of ['sea'] as const) {
      let bed = this.beds.get(kind);
      const active = this.hover === kind;
      if (!bed && active) {
        let buffer = this.buffers.get(kind);
        if (!buffer) { const pcm = coastalPCM(ctx.sampleRate); buffer = ctx.createBuffer(2, pcm[0].length, ctx.sampleRate); pcm.forEach((p, i) => buffer!.copyToChannel(p, i)); this.buffers.set(kind, buffer); }
        const source = ctx.createBufferSource(), gain = ctx.createGain(); source.buffer = buffer; source.loop = true; gain.gain.value = 0; source.connect(gain); gain.connect(node); source.start(); bed = {source, gain}; this.beds.set(kind, bed);
      }
      if (!bed) continue;
      clearTimeout(bed.timer);
      bed.gain.gain.cancelAndHoldAtTime(ctx.currentTime);
      bed.gain.gain.linearRampToValueAtTime(active ? .07 : 0, ctx.currentTime + (active ? .6 : .8));
      if (!active) { const retiring = bed; bed.timer = setTimeout(() => { if (this.beds.get(kind) !== retiring) return; retiring.source.stop(); retiring.source.disconnect(); retiring.gain.disconnect(); this.beds.delete(kind); }, 850); }
    }
  }
  transition(plan: boolean) {
    if (!this.enabled || this.hidden || this.disposed) return;
    const out = this.output(); if (!out || out.context.state !== 'running') return;
    const {context: ctx, node} = out;
    // A dry, noise-excited plastic shell contact, with a distinct lower lock.
    this.stopClicks();
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .065), ctx.sampleRate), pcm = buffer.getChannelData(0);
    let seed = 7121, low = 0;
    for (let i = 0; i < pcm.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const t = i / ctx.sampleRate, noise = seed / 2147483648 - 1; low += .19 * (noise - low); pcm[i] = (low * .8 + Math.sin(t * Math.PI * 2 * (plan ? 1850 : 1380)) * .18) * Math.exp(-t * (plan ? 115 : 90)) * Math.min(1, t / .0008); }
    const source = ctx.createBufferSource(), gain = ctx.createGain(); source.buffer = buffer; gain.gain.value = plan ? .22 : .27; source.connect(gain); gain.connect(node); this.clicks.set(source, gain);
    source.onended = () => { this.clicks.delete(source); source.disconnect(); gain.disconnect(); }; source.start();
  }
  reset() { this.hover = 'none'; this.stopBeds(); this.stopClicks(); }
  dispose() { this.reset(); this.disposed = true; this.worker?.terminate(); this.worker = undefined; this.buffers.clear(); }
}
