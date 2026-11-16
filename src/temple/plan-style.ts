import type { TempleDefinition } from './types.ts';

export const CUT_FILL = '#9C7350';
export const CUT_EDGE = '#765239';
export const CUT_BASE = '#B98D60';
export const CUT_ROUGHNESS = .74;
export const TREE_QUIETENING = .36;
export const MAX_PLAN_CONTACT = .22;

export function planEmphasis(progress: number) {
  const t=Math.max(0,Math.min(1,progress));return t*t*(3-2*t);
}

export interface PlanDepthZone {
  name:string; x0:number; x1:number; z0:number; z1:number; floor:number;
  door:'east'|'west'|'both'; doorMin:number; doorMax:number;
}

/** Shade existing floors at actual walls, leaving door axes and passage ends open. */
export function createPlanDepthZones(definition:TempleDefinition):PlanDepthZone[]{
  const zones:PlanDepthZone[]=definition.chambers.map(c=>({
    name:c.name,x0:c.center[0]-c.clearSize[0]/2,x1:c.center[0]+c.clearSize[0]/2,
    z0:c.center[1]-c.clearSize[1]/2,z1:c.center[1]+c.clearSize[1]/2,floor:c.floorY,
    door:c.entrance,doorMin:c.center[1]-Math.min(2,c.clearSize[1]/2),doorMax:c.center[1]+Math.min(2,c.clearSize[1]/2),
  }));
  const porch=definition.pieces.filter(p=>p.group==='main.vestibule-wall'),main=definition.chambers.find(c=>c.name==='main');
  if(porch.length&&main){
    const bx=porch.flatMap(p=>{const half=(p.size[0]*Math.abs(Math.cos(p.rotationY))+p.size[2]*Math.abs(Math.sin(p.rotationY)))/2;return[p.position[0]-half,p.position[0]+half];});
    zones.push({name:'main-porch',x0:Math.min(...bx),x1:Math.max(...bx),z0:main.center[1]-2,z1:main.center[1]+2,floor:main.floorY,door:'both',doorMin:-1000,doorMax:1000});
  }
  return zones;
}

export function planFloorContact(z:PlanDepthZone,x:number,y:number,depth:number){
  if(x<z.x0||x>z.x1||depth<z.z0||depth>z.z1||Math.abs(y-z.floor)>=.18)return 0;
  const inDoor=depth>=z.doorMin&&depth<=z.doorMax;
  const left=z.door==='both'||z.door==='west'&&inDoor?0:Math.exp(-(x-z.x0)*2.1);
  const right=z.door==='both'||z.door==='east'&&inDoor?0:Math.exp(-(z.x1-x)*2.1);
  const sides=Math.exp(-(depth-z.z0)*2.1)+Math.exp(-(z.z1-depth)*2.1);
  const t=Math.max(0,Math.min(1,(Math.abs(y-z.floor)-.08)/.1)),vertical=1-t*t*(3-2*t);
  return Math.min(MAX_PLAN_CONTACT,(left+right+sides)*.11)*vertical;
}

export function planContactGLSL(zones:PlanDepthZone[]){
  const n=(v:number)=>v.toFixed(5);
  return `float planContact=0.0;\n`+zones.map(z=>`{
    vec2 lo=vPlanXZ-vec2(${n(z.x0)},${n(z.z0)}),hi=vec2(${n(z.x1)},${n(z.z1)})-vPlanXZ;
    if(min(min(lo.x,lo.y),min(hi.x,hi.y))>=0.0){
      bool doorway=vPlanXZ.y>=${n(z.doorMin)}&&vPlanXZ.y<=${n(z.doorMax)};
      float a=${z.door==='both'?'0.0':z.door==='west'?'doorway?0.0:exp(-lo.x*2.1)':'exp(-lo.x*2.1)'};
      float b=${z.door==='both'?'0.0':z.door==='east'?'doorway?0.0:exp(-hi.x*2.1)':'exp(-hi.x*2.1)'};
      float contact=min(.22,(a+b+exp(-lo.y*2.1)+exp(-hi.y*2.1))*.11);
      contact*=1.0-smoothstep(.08,.18,abs(vPlanY-${n(z.floor)}));
      planContact=max(planContact,contact);
    }
  }`).join('\n')+`\ndiffuseColor.rgb*=1.0-planContact*planDepthStrength;`;
}
