import { Matrix4, Mesh, Quaternion, Raycaster, Vector2, Vector3, type Group, type InstancedMesh, type Intersection, type OrthographicCamera } from 'three';
export const TREE_SETTLE_MS=850;
export interface TreeSpring { angle:number; velocity:number; target:number; time:number; end:number }
export function advanceTree(s:TreeSpring,now:number){
  // An already queued rAF timestamp may slightly precede a pointer event.
  now=Math.max(now,s.time);
  if(now>=s.end){s.angle=s.target;s.velocity=0;s.time=now;return;}
  const t=Math.max(0,now-s.time)/1000,damping=8,frequency=24;
  const a=s.angle-s.target,b=(s.velocity+damping*a)/frequency,e=Math.exp(-damping*t),c=Math.cos(frequency*t),n=Math.sin(frequency*t);
  s.angle=s.target+e*(a*c+b*n);s.velocity=e*((b*frequency-damping*a)*c+(-a*frequency-damping*b)*n);s.time=now;
}
export function nudgeTree(s:TreeSpring,now:number){advanceTree(s,now);s.velocity=Math.max(-4,Math.min(4,s.velocity+3.2));s.end=now+TREE_SETTLE_MS;}
type Tree={anchor:number[];parts:Mesh[]};
type Occluder={mesh:InstancedMesh;index:number;id:string};

/** Virtual base pivots preserve the existing flat landscape hierarchy. */
export function createTreeInteraction(trees:Tree[],camera:OrthographicCamera,occluders:Occluder[],visible:(id:string,y:number)=>boolean,caps?:Group){
  const axis=new Vector3(),rotation=new Quaternion(),ray=new Raycaster(),pointer=new Vector2(),point=new Vector3();
  const meshes=trees.flatMap(t=>t.parts),owners=new Map(meshes.map(m=>[m,trees.findIndex(t=>t.parts.includes(m))]));
  const rest=trees.map(t=>t.parts.map(m=>({position:m.position.clone(),quaternion:m.quaternion.clone()})));
  const bases=trees.map(t=>new Vector3(t.anchor[0],0,t.anchor[1]));
  const states:TreeSpring[]=trees.map(()=>({angle:0,velocity:0,target:0,time:0,end:0}));
  const treeHits:Intersection[]=[],wallHits:Intersection[]=[];
  const probe=new Mesh();probe.matrixAutoUpdate=false;
  const walls=occluders.map(o=>{o.mesh.updateWorldMatrix(true,false);const matrix=new Matrix4();o.mesh.getMatrixAt(o.index,matrix);matrix.premultiply(o.mesh.matrixWorld);if(!o.mesh.geometry.boundingBox)o.mesh.geometry.computeBoundingBox();return{...o,matrix,box:o.mesh.geometry.boundingBox!.clone().applyMatrix4(matrix)};});
  let hovered=-1;
  function restore(index:number){trees[index].parts.forEach((m,j)=>{m.position.copy(rest[index][j].position);m.quaternion.copy(rest[index][j].quaternion);});}
  return {
    hit(x:number,y:number,width:number,height:number){
      pointer.set(x/width*2-1,1-y/height*2);ray.setFromCamera(pointer,camera);ray.far=Infinity;treeHits.length=0;
      for(const mesh of meshes)if(mesh.visible){mesh.updateWorldMatrix(true,false);ray.intersectObject(mesh,false,treeHits);}
      treeHits.sort((a,b)=>a.distance-b.distance);const hit=treeHits[0];if(!hit)return -1;
      ray.far=hit.distance-.0001;
      for(const wall of walls){if(!ray.ray.intersectBox(wall.box,point)||point.distanceTo(ray.ray.origin)>ray.far)continue;
        probe.geometry=wall.mesh.geometry;probe.material=wall.mesh.material;probe.matrixWorld.copy(wall.matrix);wallHits.length=0;probe.raycast(ray,wallHits);
        if(wallHits.some(h=>visible(wall.id,h.point.y)))return -1;
      }
      if(caps?.visible){wallHits.length=0;ray.intersectObject(caps,true,wallHits);if(wallHits.length)return -1;}
      return owners.get(hit.object as Mesh)??-1;
    },
    hover(index:number,now:number,reduced:boolean){if(index===hovered)return false;const previous=hovered;hovered=index;
      for(const i of [previous,index])if(i>=0){const s=states[i];advanceTree(s,now);s.target=(!reduced&&i===index) ? .018 : 0;s.end=now+TREE_SETTLE_MS;if(reduced){s.angle=0;s.velocity=0;s.end=now;}}
      return !reduced;
    },
    nudge(index:number,now:number,reduced:boolean){if(index<0||reduced)return false;nudgeTree(states[index],now);return true;},
    update(now:number){camera.getWorldDirection(axis);axis.y=0;axis.normalize();let active=false;states.forEach((s,i)=>{advanceTree(s,now);restore(i);if(s.angle!==0){rotation.setFromAxisAngle(axis,s.angle);trees[i].parts.forEach((m,j)=>{m.position.sub(bases[i]).applyQuaternion(rotation).add(bases[i]);m.quaternion.copy(rotation).multiply(rest[i][j].quaternion);});}active ||= now<s.end;});return active;},
    reset(){hovered=-1;states.forEach((s,i)=>{s.angle=s.velocity=s.target=s.time=s.end=0;restore(i);});},
  };
}
