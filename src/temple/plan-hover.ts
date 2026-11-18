import { Vector3, type OrthographicCamera } from 'three';
import type { TempleDefinition } from './types.ts';

export type HoverPoint = { x: number; y: number };
const cross = (o: HoverPoint, a: HoverPoint, b: HoverPoint) => (a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);

/** Immutable completed-model envelope. Holes, seams and clipping cannot change it. */
export function createHoverRegion(points: HoverPoint[], exitMargin = 12) {
  const sorted = points.slice().sort((a,b)=>a.x-b.x||a.y-b.y);
  const lower: HoverPoint[] = [], upper: HoverPoint[] = [];
  for (const p of sorted) { while(lower.length>1&&cross(lower.at(-2)!,lower.at(-1)!,p)<=0)lower.pop();lower.push(p); }
  for (const p of sorted.slice().reverse()) { while(upper.length>1&&cross(upper.at(-2)!,upper.at(-1)!,p)<=0)upper.pop();upper.push(p); }
  lower.pop();upper.pop();const polygon=lower.concat(upper);
  return {
    polygon,
    contains(x: number, y: number, alreadyInside = false) {
      const p={x,y};
      if(polygon.length<3)return false;
      let inside=true, distance=Infinity;
      for(let i=0;i<polygon.length;i++) {
        const a=polygon[i],b=polygon[(i+1)%polygon.length];
        if(cross(a,b,p)<-1e-6)inside=false;
        const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
        const t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0;
        distance=Math.min(distance,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));
      }
      return inside||alreadyInside&&distance<=exitMargin;
    },
  };
}

export function createTempleHoverRegion(definition: TempleDefinition, camera: OrthographicCamera, width: number, height: number) {
  const points: HoverPoint[] = [], v=new Vector3();
  for(const p of definition.pieces) {
    const c=Math.cos(p.rotationY),s=Math.sin(p.rotationY);
    for(const dx of [-p.size[0]/2,p.size[0]/2])for(const dz of [-p.size[2]/2,p.size[2]/2])for(const dy of [-p.size[1]/2,p.size[1]/2+.18]) {
      v.set(p.position[0]+c*dx+s*dz,p.position[1]+dy,p.position[2]-s*dx+c*dz).project(camera);
      points.push({x:(v.x+1)*width/2,y:(1-v.y)*height/2});
    }
  }
  return createHoverRegion(points);
}
