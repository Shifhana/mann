import { CATALOGUE } from './catalogue.ts';
import { CONSOLIDATION_PARTS } from './consolidation-catalogue.ts';
import type { BrickRecord, Vec3 } from './types.ts';

export type ConsolidationMode = 'hidden' | 'balanced' | 'aggressive';
const EPS = .001;
interface Box { piece: BrickRecord; min: Vec3; max: Vec3; sources: string[]; hidden: boolean }
export function pieceBounds(piece: BrickRecord) {
  const c=Math.abs(Math.cos(piece.rotationY)),s=Math.abs(Math.sin(piece.rotationY));
  const half=[(piece.size[0]*c+piece.size[2]*s)/2,piece.size[1]/2,(piece.size[2]*c+piece.size[0]*s)/2];
  return {min:piece.position.map((v,i)=>v-half[i]) as Vec3,max:piece.position.map((v,i)=>v+half[i]) as Vec3};
}
const volume=(b:{min:Vec3;max:Vec3})=>b.max.reduce((v,n,i)=>v*(n-b.min[i]),1);
const contains=(a:{min:Vec3;max:Vec3},b:{min:Vec3;max:Vec3})=>a.min.every((v,i)=>v<=b.min[i]+EPS&&a.max[i]>=b.max[i]-EPS);
const overlaps=(a:Box,b:Box)=>a.min.every((v,i)=>v<b.max[i]-EPS&&a.max[i]>b.min[i]+EPS);

/** Preserve occupied masonry, materials, chambers and protected detail records.
 * Merge only complete rectangular unions that match a verified catalogue element.
 * No scaled bricks, hollowing, decorative deletion or fake seams.
 */
export function consolidatePieces(pieces: BrickRecord[], mode: ConsolidationMode,
  membership: (x:number,z:number,w:number,d:number)=>BrickRecord['section']) {
  const boxes:Box[]=pieces.filter(p=>p.shape==='box').map(piece=>({piece,...pieceBounds(piece),sources:[piece.id],hidden:false}));
  const buckets=new Map<string,Box[]>();
  for(const b of boxes)for(let x=Math.floor(b.min[0]);x<=Math.floor(b.max[0]);x++)for(let z=Math.floor(b.min[2]);z<=Math.floor(b.max[2]);z++) {
    const key=`${x},${z}`,bucket=buckets.get(key)??[];bucket.push(b);buckets.set(key,bucket);
  }
  const covered=(pt:Vec3,skip:Box)=>(buckets.get(`${Math.floor(pt[0])},${Math.floor(pt[2])}`)??[])
    .some(b=>b!==skip&&pt.every((v,i)=>v>=b.min[i]-EPS&&v<=b.max[i]+EPS));
  for(const b of boxes) {
    b.hidden=true;
    faces:for(let axis=0;axis<3;axis++)for(const side of [0,1]) {
      const u=(axis+1)%3,v=(axis+2)%3;
      for(let a=b.min[u]+.1;a<b.max[u];a+=.5)for(let c=b.min[v]+.1;c<b.max[v];c+=.5) {
        const pt:Vec3=[0,0,0];pt[u]=a;pt[v]=c;pt[axis]=(side?b.max[axis]:b.min[axis])+(side?.02:-.02);
        if(axis===1&&side&&b.piece.studs)pt[axis]+=.18;
        if(!covered(pt,b)){b.hidden=false;break faces;}
      }
    }
  }
  const hiddenCount=boxes.filter(b=>b.hidden).length;
  const protectedDetail=(p:BrickRecord)=>p.structuralRole==='sacred'||p.structuralRole==='detail';
  const eligible=(b:Box)=>b.piece.catalogueId!==null && (b.hidden || mode==='aggressive'&&b.piece.structuralRole!=='sacred'&&!b.piece.group.includes('nandi') || mode==='balanced'&&!protectedDetail(b.piece));
  const groups=new Map<string,Box[]>();
  for(const b of boxes.filter(eligible)) {
    const p=b.piece,key=`${p.group}:${p.material}:${p.studs}:${p.assemblyStage}`;
    const group=groups.get(key)??[];group.push(b);groups.set(key,group);
  }
  const removed=new Set<string>(), replacements:BrickRecord[]=[], merges:{sources:string[];replacement:string}[]=[];
  const catalogue=[...CATALOGUE,...CONSOLIDATION_PARTS].sort((a,b)=>b.size[0]*b.size[1]*b.size[2]-a.size[0]*a.size[1]*a.size[2]);
  for(const group of groups.values()) {
    const available=new Set(group);
    for(const anchor of group) {
      if(!available.has(anchor))continue;
      for(const part of catalogue) {
        if(part.studs!==anchor.piece.studs)continue;
        // Balanced pass retains the visible horizontal course pattern.
        if(mode==='balanced'&&!anchor.hidden&&Math.abs(part.size[1]-anchor.piece.size[1])>EPS)continue;
        let done=false;
        for(const rotated of [false,true]) {
          const size:Vec3=rotated?[part.size[2],part.size[1],part.size[0]]:[...part.size];
          const candidate={min:anchor.min,max:anchor.min.map((v,i)=>v+size[i]) as Vec3};
          if(!contains(candidate,anchor))continue;
          const inside=[...available].filter(b=>contains(candidate,b));
          if(inside.length<2 || Math.abs(inside.reduce((n,b)=>n+volume(b),0)-volume(candidate))>EPS)continue;
          if(inside.some((b,i)=>inside.slice(i+1).some(c=>overlaps(b,c))))continue;
          // In hidden-only mode all members must be concealed, not just the anchor.
          if(mode==='hidden'&&inside.some(b=>!b.hidden))continue;
          const sources=inside.flatMap(b=>b.sources).sort();
          const p:BrickRecord={...anchor.piece,id:`${sources[0]}.merged-${sources.length}`,catalogueId:part.id,
            size:[...part.size],position:anchor.min.map((v,i)=>v+size[i]/2) as Vec3,
            rotationY:rotated?Math.PI/2:0,
            section:membership(anchor.min[0]+size[0]/2,anchor.min[2]+size[2]/2,size[0],size[2])};
          inside.forEach(b=>{available.delete(b);removed.add(b.piece.id);});
          replacements.push(p);merges.push({sources,replacement:p.id});done=true;break;
        }
        if(done)break;
      }
    }
  }
  return {pieces:[...pieces.filter(p=>!removed.has(p.id)),...replacements],hiddenCount,merges};
}

