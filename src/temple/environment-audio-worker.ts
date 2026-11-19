import {coastalPCM} from './coastal-pcm.ts';
self.onmessage = ({data}: MessageEvent<number>) => {
  const sea = coastalPCM(data);
  self.postMessage({sea}, {transfer: sea.map(p => p.buffer)});
};
