import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OrthographicCamera,Vector3} from 'three';
import {postcardCamera} from '../src/temple/postcard-camera.ts';
import {createTempleDefinition} from '../src/temple/model.ts';
import {refineCollectible} from '../src/temple/refine-collectible.ts';
import {createPlanView} from '../src/temple/plan-view.ts';

const model=refineCollectible(createTempleDefinition());
test('postcard camera frames every completed brick at the exterior angle without mutating the live model or camera',()=>{
 const source=new OrthographicCamera(-65,65,45,-47,.1,400);
 source.position.set(50,70,80);source.lookAt(0,15,0);source.updateMatrixWorld(true);source.updateProjectionMatrix();
 const before=JSON.stringify({source:source.toJSON(),model});
 const camera=postcardCamera(source,model.pieces,1662/1230);
 assert.notEqual(camera,source);assert.deepEqual(camera.quaternion.toArray(),source.quaternion.toArray());
 assert.ok(Math.abs((camera.right-camera.left)/(camera.top-camera.bottom)-1662/1230)<1e-12);
 let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
 for(const p of model.pieces)for(const x of[-p.size[0]/2,p.size[0]/2])for(const y of[-p.size[1]/2,p.size[1]/2+.2])for(const z of[-p.size[2]/2,p.size[2]/2]){
   const c=Math.cos(p.rotationY),s=Math.sin(p.rotationY),v=new Vector3(p.position[0]+c*x+s*z,p.position[1]+y,p.position[2]-s*x+c*z).project(camera);
   xMin=Math.min(xMin,v.x);xMax=Math.max(xMax,v.x);yMin=Math.min(yMin,v.y);yMax=Math.max(yMax,v.y);
   assert.ok(Math.abs(v.x)<.97&&Math.abs(v.y)<.97,p.id+' cropped');
 }
 assert.ok(Math.max(xMax-xMin,yMax-yMin)>1.4,'temple is too small');
 assert.ok(Math.abs(yMax+yMin)<.02,'architecture should be centred within the stamp');
 assert.equal(model.pieces.length,1911);assert.equal(JSON.stringify({source:source.toJSON(),model}),before);
});

test('exterior-only capture restores active plan uniforms, geometry and hover timeline even when rendering fails',()=>{
 const plan=createPlanView(model),shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};plan.patchShader(shader);
 plan.setRevealed(true,10,true);plan.update(10);
 const before={progress:plan.timeline.progress,target:plan.timeline.target,geometry:plan.group.children[0].geometry,visible:plan.group.visible,active:shader.uniforms.planActive.value,depth:shader.uniforms.planDepthStrength.value};
 assert.equal(plan.withExterior(()=>{assert.equal(shader.uniforms.planActive.value,0);assert.equal(shader.uniforms.planDepthStrength.value,0);assert.equal(plan.group.visible,false);return 'exterior';}),'exterior');
 assert.throws(()=>plan.withExterior(()=>{throw new Error('render failed')}),/render failed/);
 assert.deepEqual({progress:plan.timeline.progress,target:plan.timeline.target,geometry:plan.group.children[0].geometry,visible:plan.group.visible,active:shader.uniforms.planActive.value,depth:shader.uniforms.planDepthStrength.value},before);
 plan.dispose();
});
