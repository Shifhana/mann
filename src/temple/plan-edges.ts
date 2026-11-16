import type { BrickRecord } from './types.ts';

export const CUT_EDGE_WIDTH = .20;
export type CutEdge = { x0: number; z0: number; x1: number; z1: number };
export interface CutEdgeField { edges: CutEdge[]; bounds: [number,number,number,number] }
const snap=(n:number)=>Math.round(n*1e5)/1e5;
export function isSectionRelief(p: BrickRecord) { return p.group.endsWith('.niches') || p.group==='enclosure.nandi'; }

/** Contour metadata only. No nominal footprint is ever turned into a filled mesh. */
export function createCutEdgeField(pieces: BrickRecord[], height: number): CutEdgeField {
  const rects: CutEdge[]=[];
  for(const p of pieces){
    if(p.structuralRole==='sacred'||isSectionRelief(p))continue;
    if(p.position[1]-(p.size[1]-.025)/2>=height||p.position[1]+(p.size[1]-.025)/2<=height)continue;
    if(p.shape!=='box')throw Error(`Non-masonry element at wall cut: ${p.id}`);
    const c=Math.abs(Math.cos(p.rotationY)),s=Math.abs(Math.sin(p.rotationY));
    if(Math.min(c,s)>1e-5)throw Error(`Non-orthogonal wall cut: ${p.id}`);
    const w=p.size[0]*c+p.size[2]*s,d=p.size[2]*c+p.size[0]*s;
    rects.push({x0:snap(p.position[0]-w/2),x1:snap(p.position[0]+w/2),z0:snap(p.position[2]-d/2),z1:snap(p.position[2]+d/2)});
  }
  const xs=[...new Set(rects.flatMap(r=>[r.x0,r.x1]))].sort((a,b)=>a-b),zs=[...new Set(rects.flatMap(r=>[r.z0,r.z1]))].sort((a,b)=>a-b);
  const nx=xs.length-1,nz=zs.length-1,cells=new Uint8Array(nx*nz),xi=new Map(xs.map((v,i)=>[v,i])),zi=new Map(zs.map((v,i)=>[v,i]));
  for(const r of rects)for(let z=zi.get(r.z0)!;z<zi.get(r.z1)!;z++)for(let x=xi.get(r.x0)!;x<xi.get(r.x1)!;x++)cells[z*nx+x]=1;
  const occupied=(x:number,z:number)=>x>=0&&z>=0&&x<nx&&z<nz&&cells[z*nx+x]===1;
  const edges: CutEdge[]=[];
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)if(occupied(x,z)){
    if(!occupied(x-1,z))edges.push({x0:xs[x],x1:xs[x],z0:zs[z],z1:zs[z+1]});
    if(!occupied(x+1,z))edges.push({x0:xs[x+1],x1:xs[x+1],z0:zs[z],z1:zs[z+1]});
    if(!occupied(x,z-1))edges.push({x0:xs[x],x1:xs[x+1],z0:zs[z],z1:zs[z]});
    if(!occupied(x,z+1))edges.push({x0:xs[x],x1:xs[x+1],z0:zs[z+1],z1:zs[z+1]});
  }
  return {edges,bounds:[xs[0]-1,zs[0]-1,xs.at(-1)!+1,zs.at(-1)!+1]};
}

export function cutEdgeDistance(e: CutEdge,x:number,z:number){
  return Math.hypot(Math.max(e.x0-x,0,x-e.x1),Math.max(e.z0-z,0,z-e.z1));
}

/** Narrow antialiased contour mask; actual per-brick cap geometry clips this mask.
 * Neither chamber floors nor vertical wall faces use this texture/material. */
export function rasterCutEdges(field: CutEdgeField,width=2048,height=1024){
  const data=new Uint8Array(width*height),[x0,z0,x1,z1]=field.bounds;
  const dx=(x1-x0)/width,dz=(z1-z0)/height,aa=Math.hypot(dx,dz)/2,r=CUT_EDGE_WIDTH+aa;
  for(const edge of field.edges){
    const left=Math.max(0,Math.floor((edge.x0-r-x0)/dx)),right=Math.min(width-1,Math.ceil((edge.x1+r-x0)/dx));
    const top=Math.max(0,Math.floor((edge.z0-r-z0)/dz)),bottom=Math.min(height-1,Math.ceil((edge.z1+r-z0)/dz));
    for(let z=top;z<=bottom;z++)for(let x=left;x<=right;x++){
      const distance=cutEdgeDistance(edge,x0+(x+.5)*dx,z0+(z+.5)*dz);
      const value=Math.round(255*Math.max(0,Math.min(1,(CUT_EDGE_WIDTH+aa-distance)/(2*aa))));
      data[z*width+x]=Math.max(data[z*width+x],value);
    }
  }
  return {data,width,height};
}
