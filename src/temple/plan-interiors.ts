import type { TempleDefinition } from './types.ts';
import { createPlanDepthZones } from './plan-style.ts';

export const INTERIOR_FLOOR = '#E4CEA5';
export const INTERIOR_THRESHOLD = '#C7A474';
export const INTERIOR_FLOOR_MIX = .7;
export const INTERIOR_THRESHOLD_MIX = .65;

export interface PlanInteriorRegion {
  name: string; kind: 'chamber' | 'threshold' | 'porch';
  x0: number; x1: number; z0: number; z1: number; floor: number; levels: number[];
}

/** Material/lighting masks on existing surfaces only. No floor or passage meshes. */
export function createPlanInteriorRegions(definition: TempleDefinition): PlanInteriorRegion[] {
  const zones = createPlanDepthZones(definition), regions: PlanInteriorRegion[] = [];
  for (const z of zones) {
    regions.push({ ...z, kind: z.name === 'main-porch' ? 'porch' : 'chamber', levels: [] });
    if (z.name === 'main-porch') continue;
    const walls = definition.pieces.filter(p => p.group === `${z.name}.wall`);
    const xs = walls.flatMap(p => {
      const half=(p.size[0]*Math.abs(Math.cos(p.rotationY))+p.size[2]*Math.abs(Math.sin(p.rotationY)))/2;
      return [p.position[0]-half,p.position[0]+half];
    });
    if (xs.length) regions.push({name:`${z.name}-threshold`,kind:'threshold',
      x0:z.door==='west'?Math.min(...xs):z.x1,x1:z.door==='west'?z.x0:Math.max(...xs),
      z0:z.doorMin,z1:z.doorMax,floor:z.floor,levels:[]});
  }
  for (const r of regions) {
    // Retain and illuminate existing level changes, including the original plinth
    // overlap at the Vishnu chamber. Never conceal it with a replacement floor.
    r.levels=[...new Set(definition.pieces.filter(p=>p.shape==='box'&&
      (p.structuralRole==='floor'||p.structuralRole==='foundation')&&
      p.position[0]+p.size[0]/2>r.x0&&p.position[0]-p.size[0]/2<r.x1&&
      p.position[2]+p.size[2]/2>r.z0&&p.position[2]-p.size[2]/2<r.z1)
      .map(p=>Math.round((p.position[1]+p.size[1]/2)*1e5)/1e5)
      .filter(y=>y>=r.floor-.01&&y<=r.floor+.81))].sort((a,b)=>a-b);
  }
  return regions;
}

export function interiorFloorWeight(r: PlanInteriorRegion,x:number,y:number,z:number,normalY:number) {
  if(x<r.x0||x>r.x1||z<r.z0||z>r.z1||normalY<.9)return 0;
  const d=Math.min(...r.levels.map(level=>Math.abs(y-level)));
  const t=Math.max(0,Math.min(1,(d-.05)/.1)),up=Math.max(0,Math.min(1,(normalY-.9)/.09));
  return (1-t*t*(3-2*t))*up*up*(3-2*up);
}

const n=(v:number)=>v.toFixed(5);

export function planInteriorGLSL(regions:PlanInteriorRegion[]) {
  return `float planFloor=0.0,planThreshold=0.0,planWallFill=0.0;\n`+regions.map(r=>`{
    vec2 lo=vPlanXZ-vec2(${n(r.x0)},${n(r.z0)}),hi=vec2(${n(r.x1)},${n(r.z1)})-vPlanXZ;
    float edge=min(min(lo.x,lo.y),min(hi.x,hi.y));
    if(vPlanEligible>.5 && edge>=0.0){
      float levelDistance=${r.levels.length?r.levels.map(y=>`abs(vPlanY-${n(y)})`).reduce((a,b)=>`min(${a},${b})`):'1000.0'};
      float floorMask=(1.0-smoothstep(.05,.15,levelDistance))*smoothstep(.9,.99,vPlanNormal.y);
      ${r.kind==='threshold'?'planThreshold=max(planThreshold,floorMask);':'planFloor=max(planFloor,floorMask);'}
    }
    if(vPlanEligible>.5 && edge>=-.07 && vPlanY>${n(r.floor+.06)} && vPlanY<planHeight-.04){
      float facing=max(max(lo.x<.13?max(vPlanNormal.x,0.0):0.0,hi.x<.13?max(-vPlanNormal.x,0.0):0.0),
                       max(lo.y<.13?max(vPlanNormal.z,0.0):0.0,hi.y<.13?max(-vPlanNormal.z,0.0):0.0));
      planWallFill=max(planWallFill,facing*(1.0-smoothstep(.2,.5,abs(vPlanNormal.y))));
    }
  }`).join('\n');
}

/** Quiet external contour ink while retaining the chamber/door edge hierarchy. */
export function planInteriorContourGLSL(regions:PlanInteriorRegion[]) {
  return `float interiorContour=.82;\n`+regions.map(r=>`{
    vec2 d=max(max(vec2(${n(r.x0)},${n(r.z0)})-vCutXZ,vCutXZ-vec2(${n(r.x1)},${n(r.z1)})),vec2(0.0));
    interiorContour=max(interiorContour,1.0-smoothstep(.20,.42,length(d)));
  }`).join('\n');
}
