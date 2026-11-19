import {Matrix4, Mesh, Raycaster, Vector2, Vector3, type Group, type InstancedMesh, type Intersection, type OrthographicCamera} from 'three';

/** The reveal is an explicit toggle. Hover/focus affect only the warm tint. */
export class TempleInteraction {
  ready=false; revealed=false; hovered=false; focused=false; strength=0; settle=0;
  private armed=true; private pulseStart:number|undefined;
  private target=0; private from=0; private started=0; private time=0;
  private sample(now:number,reduced:boolean) {
    this.time=Math.max(this.time,now);
    const t=reduced?1:Math.max(0,Math.min(1,(this.time-this.started)/180));
    this.strength=this.from+(this.target-this.from)*t*t*(3-2*t);
  }
  update(now:number,reduced=false) {
    this.sample(now,reduced);
    if(this.ready&&this.hovered&&this.armed){this.armed=false;this.pulseStart=this.time;}
    if(reduced)this.pulseStart=undefined;
    const elapsed=this.pulseStart===undefined?Infinity:this.time-this.pulseStart;
    // A brief damped material response uses the already-warmed tint uniform.
    // No masonry, foundations, camera, picking bounds or visitor paths move.
    const p=elapsed/420;
    this.settle=reduced||elapsed>=420?0:Math.sin(Math.PI*p)**2*(1+.12*Math.sin(2*Math.PI*p));
    const next=+(this.ready&&(this.hovered||this.focused));
    if(next!==this.target){this.from=this.strength;this.started=this.time;this.target=next;}
    if(reduced)this.strength=this.target;
    return this.strength!==this.target||(!reduced&&elapsed<420);
  }
  endHover(){this.hovered=false;this.armed=true;}
  activate(){if(!this.ready)return false;this.revealed=!this.revealed;return true;}
  reset(){this.ready=this.revealed=this.hovered=this.focused=false;this.strength=this.settle=this.target=this.from=this.started=this.time=0;this.armed=true;this.pulseStart=undefined;}
}

/** Exact visible hits, with a cached masonry broad phase. Dynamic people use
 * their current instance transforms without enabling their interaction raycast. */
export function createTemplePicker(meshes:InstancedMesh[],camera:OrthographicCamera,visible:(id:string,y:number)=>boolean,caps?:Group,scenery?:Group,people?:Group){
  const ray=new Raycaster(),pointer=new Vector2(),point=new Vector3(),probe=new Mesh(),matrix=new Matrix4();
  probe.matrixAutoUpdate=false;
  const hits:Intersection[]=[],others:Intersection[]=[];
  const bricks=meshes.flatMap(mesh=>{
    mesh.updateWorldMatrix(true,false);if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    return Array.from({length:mesh.count},(_,index)=>{const world=new Matrix4();mesh.getMatrixAt(index,world);world.premultiply(mesh.matrixWorld);return{mesh,world,id:mesh.userData.pieceIds[index] as string,box:mesh.geometry.boundingBox!.clone().applyMatrix4(world)};});
  });
  const peopleMeshes=people?.children.filter((o):o is InstancedMesh=>(o as InstancedMesh).isInstancedMesh&&o.name!=='human-contact-shadows')??[];
  return {
    hit(x:number,y:number,width:number,height:number){
      if(width<=0||height<=0)return false;
      pointer.set(x/width*2-1,1-y/height*2);ray.setFromCamera(pointer,camera);ray.far=Infinity;
      let distance=Infinity;
      for(const brick of bricks){
        if(!ray.ray.intersectBox(brick.box,point))continue;
        probe.geometry=brick.mesh.geometry;probe.material=brick.mesh.material;probe.matrixWorld.copy(brick.world);hits.length=0;probe.raycast(ray,hits);
        for(const h of hits)if(h.distance<distance&&visible(brick.id,h.point.y))distance=h.distance;
      }
      if(caps?.visible){caps.updateWorldMatrix(true,true);hits.length=0;ray.intersectObject(caps,true,hits);for(const h of hits)distance=Math.min(distance,h.distance);}
      if(!Number.isFinite(distance))return false;
      ray.far=distance-.0001;
      if(scenery?.visible){scenery.updateWorldMatrix(true,true);others.length=0;ray.intersectObjects(scenery.children.filter(o=>o.visible),true,others);if(others.length)return false;}
      if(people?.visible)for(const mesh of peopleMeshes){
        mesh.updateWorldMatrix(true,false);probe.geometry=mesh.geometry;probe.material=mesh.material;
        for(let i=0;i<mesh.count;i++){
          if(mesh.geometry.getAttribute('figureReveal').getX(i)<=.1)continue;
          mesh.getMatrixAt(i,matrix);probe.matrixWorld.copy(matrix).premultiply(mesh.matrixWorld);hits.length=0;probe.raycast(ray,hits);if(hits.length)return false;
        }
      }
      return true;
    },
  };
}
