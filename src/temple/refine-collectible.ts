import type {BrickRecord,TempleDefinition} from './types.ts';
import {sectionMembership} from './model.ts';
/** Conservative, development-only replacements; never mutate the approved definition. */
export function refineCollectible(original:TempleDefinition):TempleDefinition{
 const removed=new Set<string>(),added:BrickRecord[]=[];
 const niches=new Map<string,BrickRecord[]>(),eaves=new Map<string,BrickRecord[]>(),columns=new Map<string,BrickRecord[]>();
 for(const p of original.pieces){
  if(p.group.endsWith('.aedicules')){const key=[p.group,p.rotationY,p.position[0].toFixed(5),p.position[2].toFixed(5)].join(':');const a=niches.get(key)??[];a.push(p);niches.set(key,a);}
  if(p.group.endsWith('.eaves')){const key=p.group+':'+p.rotationY;const a=eaves.get(key)??[];a.push(p);eaves.set(key,a);}
  if(/pilasters|porch-pillars/.test(p.group)&&p.shape==='box'&&p.studs&&p.size[0]===1&&p.size[2]===1){const key=[p.group,p.material,p.rotationY,p.position[0].toFixed(5),p.position[2].toFixed(5)].join(':');const a=columns.get(key)??[];a.push(p);columns.set(key,a);}
 }
 const faceNiches=new Map<string,BrickRecord[][]>();
 for(const a of niches.values()){const key=a[0].group+':'+a[0].rotationY;const list=faceNiches.get(key)??[];list.push(a);faceNiches.set(key,list);}
 for(const faces of faceNiches.values()){
  const tangent=(p:BrickRecord)=>p.position[0]*Math.cos(p.rotationY)-p.position[2]*Math.sin(p.rotationY);
  faces.sort((a,b)=>tangent(a[0])-tangent(b[0]));
  for(const [index,a] of faces.entries()){
   const tile=a.find(p=>p.shape==='box'&&!p.studs),roof=a.find(p=>p.shape==='slope');if(!tile||!roof||a.length!==3)continue;
   a.forEach(p=>removed.add(p.id));
   // Keep the flanking miniature roofs; omit only the redundant middle repetition.
   if(faces.length===3&&index===1)continue;
   added.push({...tile,id:tile.id+'.brick-3004',catalogueId:'3004',size:[2,1.2,1],studs:true,position:[tile.position[0],tile.position[1]+.4,tile.position[2]]});
   added.push({...roof,id:roof.id+'.lowered',position:[roof.position[0],roof.position[1]-.4,roof.position[2]]});
  }
 }
 for(const a of eaves.values()){
  const r=a[0].rotationY,tangent=(p:BrickRecord)=>p.position[0]*Math.cos(r)-p.position[2]*Math.sin(r);a.sort((p,q)=>tangent(p)-tangent(q));
  for(let i=0;i+1<a.length;i+=2){const p=a[i],q=a[i+1];if(Math.abs(tangent(q)-tangent(p)-2)>.001)continue;
   removed.add(p.id);removed.add(q.id);const position=p.position.map((v,j)=>(v+q.position[j])/2) as BrickRecord['position'];
   added.push({...p,id:p.id+'.slope-3037',catalogueId:'3037',size:[4,1.2,2],position,section:sectionMembership(position[0],position[2],Math.abs(Math.cos(r))*4+Math.abs(Math.sin(r))*2,Math.abs(Math.sin(r))*4+Math.abs(Math.cos(r))*2)});
  }
 }
 for(const a of columns.values()){
  a.sort((p,q)=>p.position[1]-q.position[1]);for(let i=0;i+2<a.length;i+=3){const triple=a.slice(i,i+3);if(triple.some((p,j)=>Math.abs(p.size[1]-1.2)>.001||Math.abs(p.position[1]-triple[0].position[1]-j*1.2)>.001))continue;
   triple.forEach(p=>removed.add(p.id));added.push({...triple[0],id:triple[0].id+'.tall-14716',catalogueId:'14716',size:[1,3.6,1],position:[triple[0].position[0],triple[1].position[1],triple[0].position[2]],assemblyStage:Math.max(...triple.map(p=>p.assemblyStage))});
  }
 }
 return {...original,pieces:[...original.pieces.filter(p=>!removed.has(p.id)),...added]};
}
