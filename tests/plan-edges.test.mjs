import {test} from 'node:test';import assert from 'node:assert/strict';
import {createTempleDefinition} from '../src/temple/model.ts';import {refineCollectible} from '../src/temple/refine-collectible.ts';
import {createPlanSolids,planFaces,createPlanView} from '../src/temple/plan-view.ts';
import {CUT_EDGE_WIDTH,createCutEdgeField,rasterCutEdges} from '../src/temple/plan-edges.ts';
import {PLAN_CUT_HEIGHT} from '../src/temple/plan-timeline.ts';
const model=refineCollectible(createTempleDefinition()),original=JSON.stringify(model),byId=new Map(model.pieces.map(p=>[p.id,p]));
const field=createCutEdgeField(model.pieces,PLAN_CUT_HEIGHT),raster=rasterCutEdges(field);
const sample=(x,z,f=field,r=raster)=>{const[x0,z0,x1,z1]=f.bounds,ix=Math.floor((x-x0)/(x1-x0)*r.width),iz=Math.floor((z-z0)/(z1-z0)*r.height);return ix>=0&&iz>=0&&ix<r.width&&iz<r.height?r.data[iz*r.width+ix]:0;};

test('actual brick-cut caps preserve joints and never extend to nominal joined-slab bounds',()=>{
 const faces=planFaces(createPlanSolids(model.pieces),PLAN_CUT_HEIGHT);assert.ok(faces.length>50);
 for(const f of faces){const p=byId.get(f.pieceId),c=Math.cos(p.rotationY),s=Math.sin(p.rotationY);assert.equal(p.shape,'box');
  for(const v of f.polygon){assert.equal(v[1],PLAN_CUT_HEIGHT);const dx=v[0]-p.position[0],dz=v[2]-p.position[2],x=c*dx-s*dz,z=s*dx+c*dz;assert.ok(Math.abs(x)<=(p.size[0]-.045)/2+1e-5,p.id+' expanded in X');assert.ok(Math.abs(z)<=(p.size[2]-.045)/2+1e-5,p.id+' expanded in Z');}
 }
});
test('brown is restricted to delicate cut-edge bands and keeps the broad wall centre free of dark edge ink',()=>{
 assert.equal(CUT_EDGE_WIDTH,.20);assert.equal(sample(1,2),0);assert.ok(sample(2.94,2)>200);assert.equal(sample(3.3,2),0);assert.equal(sample(8,2),0);
 let dark=0,total=0;for(let x=-.97;x<2.97;x+=.01){if(sample(x,2)>128)dark++;total++;}assert.ok(dark/total<.14,'thick wall face was flooded with brown');
});
test('edge metadata does not outline internal brick joints or create a fill mesh',()=>{
 const make=(id,x)=>({id,shape:'box',size:[4,1.2,2],position:[x,PLAN_CUT_HEIGHT-.2,1],rotationY:0,structuralRole:'wall',group:'fixture.wall'});
 const f=createCutEdgeField([make('a',2),make('b',6)],PLAN_CUT_HEIGHT),r=rasterCutEdges(f,1024,512);
 assert.equal(sample(4,1,f,r),0);assert.ok(sample(2,.06,f,r)>200);assert.deepEqual(Object.keys(f).sort(),['bounds','edges']);
});
test('there is no slab, collar or dark vertical geometry in the final section',()=>{
 const p=createPlanView(model);p.setRevealed(true,0,true);p.update(0);assert.equal(p.group.children.length,1);const cap=p.group.children[0],g=cap.geometry;
 assert.equal(cap.position.y,0);assert.equal(cap.material.color.getHexString(),'9c7350');for(let i=0;i<g.getAttribute('position').count;i++){assert.equal(g.getAttribute('position').getY(i),PLAN_CUT_HEIGHT);assert.equal(g.getAttribute('normal').getX(i),0);assert.equal(g.getAttribute('normal').getY(i),1);assert.equal(g.getAttribute('normal').getZ(i),0);}p.dispose();
});
test('only the cap shader receives the edge material; cut-face ink stays out of the original wall shader and model records',()=>{
 const p=createPlanView(model),cap=p.group.children[0],shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <roughnessmap_fragment>'};
 cap.material.onBeforeCompile(shader,undefined);assert.equal(shader.uniforms.cutInk.value.getHexString(),'765239');assert.ok(shader.fragmentShader.includes('mix(diffuseColor.rgb,cutInk,cutEdge)'));assert.ok(shader.uniforms.cutEdges.value.image.data instanceof Uint8Array);
 const originalShader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};p.patchShader(originalShader);assert.ok(!originalShader.fragmentShader.includes('cutInk'));assert.equal(JSON.stringify(model),original);p.dispose();
});
test('edge texture and original transforms survive repeated reveal/reset and dispose cleanly',()=>{
 const p=createPlanView(model),shader={uniforms:{},vertexShader:'',fragmentShader:''};p.group.children[0].material.onBeforeCompile(shader,undefined);let disposed=0;shader.uniforms.cutEdges.value.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<3;i++){p.setRevealed(true,i*2000,true);p.update(i*2000);p.reset();p.update(i*2000+1);assert.equal(p.group.visible,false);}
 assert.equal(JSON.stringify(model),original);p.dispose();assert.equal(disposed,1);
});
