/** Approved quiet sea bed. Noise and modulation join periodically. */
export function coastalPCM(rate: number) {
  const length = Math.round(rate * 12), overlap = Math.round(rate * .6);
  const channels: Float32Array<ArrayBuffer>[] = [];
  for (let channel = 0; channel < 2; channel++) {
    let seed = 18791 + channel * 971, low = 0, body = 0;
    const raw = new Float32Array(length + overlap);
    for (let i = 0; i < raw.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 2147483648 - 1;
      low += .009 * (noise - low); body += .16 * (noise - body);
      raw[i] = body - low * .65;
    }
    const pcm = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const blend = Math.min(1, i / overlap), phase = i / length * Math.PI * 2;
      const noise = i < overlap ? raw[length + i] * (1 - blend) + raw[i] * blend : raw[i];
      const swell = .56 + .27 * Math.sin(phase * 3) + .12 * Math.sin(phase * 5 + .8);
      pcm[i] = noise * swell * 1.8;
    }
    channels.push(pcm);
  }
  return channels;
}
