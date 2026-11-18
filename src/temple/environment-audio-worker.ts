import {coastalPCM} from './coastal-pcm.ts';
self.onmessage = ({data}: MessageEvent<number>) => {
  const sea = coastalPCM('sea', data), tree = coastalPCM('tree', data);
  self.postMessage({sea, tree}, {transfer: [...sea, ...tree].map(p => p.buffer)});
};
