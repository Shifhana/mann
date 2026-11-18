/** Original periodic filtered-noise beds: coastal wash and low, airy gusts.
 * Overlap-add joins the noise itself; all modulation is periodic as well. */
export function coastalPCM(kind: 'sea' | 'tree', rate: number) {
  const length = Math.round(rate * 12), overlap = Math.round(rate * .6);
  const channels: Float32Array<ArrayBuffer>[] = [];
  for (let channel = 0; channel < 2; channel++) {
    let seed = 18791 + channel * 971, low = 0, body = 0;
    const raw = new Float32Array(length + overlap);
    for (let i = 0; i < raw.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1;
      low += .009 * (noise - low); body += (kind === 'sea' ? .16 : .045) * (noise - body);
      raw[i] = body - low * .65;
    }
    const pcm = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const blend = Math.min(1, i / overlap), phase = i / length * Math.PI * 2;
      const noise = i < overlap ? raw[length + i] * (1 - blend) + raw[i] * blend : raw[i];
      const swell = kind === 'sea' ? .56 + .27 * Math.sin(phase * 3) + .12 * Math.sin(phase * 5 + .8) : .58 + .24 * Math.sin(phase * 2 + .4) + .13 * Math.sin(phase * 3);
      pcm[i] = noise * swell * (kind === 'sea' ? 1.8 : 2.1);
    }
    channels.push(pcm);
  }
  return channels;
}
