import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,InstancedBufferAttribute,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial,OrthographicCamera,Vector3} from 'three';
import {TempleInteraction,createTemplePicker} from '../src/temple/temple-interaction.ts';
import {PlanTimeline} from '../src/temple/plan-timeline.ts';
test('hover and focus are affordances only; explicit activation toggles a ready temple',()=>{
 const t=new TempleInteraction();assert.equal(t.activate(),false);t.ready=true;t.hovered=true;t.update(0);t.update(90);assert.equal(t.strength,.5);assert.equal(t.revealed,false);t.focused=true;t.update(180);assert.equal(t.strength,1);assert.equal(t.revealed,false);assert.equal(t.activate(),true);assert.equal(t.revealed,true);t.hovered=t.focused=false;t.update(180);t.update(360);assert.equal(t.strength,0);assert.equal(t.revealed,true);t.activate();assert.equal(t.revealed,false);t.reset();assert.equal(t.ready,false);assert.equal(t.strength,0);
});
test('tint reversal is continuous, queued frames cannot rewind it and reduced motion settles immediately',()=>{
 const t=new TempleInteraction();t.ready=t.hovered=true;t.update(100);t.update(190);const mid=t.strength;t.hovered=false;t.update(190);assert.equal(t.strength,mid);t.update(180);assert.equal(t.strength,mid);t.update(220);assert.ok(t.strength<mid);t.hovered=true;t.update(230,true);assert.equal(t.strength,1);t.hovered=false;t.update(231,true);assert.equal(t.strength,0);
});
test('rapid intentional toggles reuse the approved reversible 500ms plane timeline',()=>{
 const t=new TempleInteraction(),plane=new PlanTimeline();t.ready=true;for(const now of [0,80,150,230,300]){plane.update(now);const before=plane.progress;t.activate();plane.setRevealed(t.revealed,now);assert.equal(plane.progress,before);}plane.update(1000);assert.equal(plane.progress,1);t.hovered=false;t.update(1100);assert.equal(t.revealed,true);
});
test('a damped material settling response runs once per area entry, without opening the plan',()=>{
 const t=new TempleInteraction();t.ready=t.hovered=true;t.update(0);t.update(55);assert.ok(t.settle>0);assert.equal(t.revealed,false);t.update(250);assert.notEqual(t.settle,0);t.update(421);assert.equal(t.settle,0);t.hovered=false;t.update(440);t.hovered=true;t.update(470);assert.equal(t.settle,0,'crossing brick gaps does not restart the pulse');t.endHover();t.update(480);t.hovered=true;t.update(500);t.update(555);assert.ok(t.settle>0);t.update(556,true);assert.equal(t.settle,0);t.reset();assert.equal(t.settle,0);
});
test('the stronger cue is a single soft pulse, seats by 420ms and cannot resume after reduced motion cancels it',()=>{
 const t=new TempleInteraction();t.ready=t.hovered=true;t.update(0);let peak=0;for(let now=0;now<=420;now+=10){t.update(now);const tint=t.strength+.85*t.settle;peak=Math.max(peak,tint);assert.ok(tint>=0&&tint<1.9);assert.equal(t.revealed,false);}assert.ok(peak>1.7&&peak<1.9);assert.equal(t.settle,0);assert.equal(t.update(800),false);assert.equal(t.strength,1);t.endHover();t.update(850);t.hovered=true;t.update(900);t.update(990,true);assert.equal(t.settle,0);t.update(1000);assert.equal(t.settle,0,'preference changes cannot resurrect a cancelled decorative cue');
});
function fixture(){
 const camera=new OrthographicCamera(-5,5,5,-5,.1,100);camera.position.set(0,5,10);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 const geometry=new BoxGeometry(2,2,2),material=new MeshStandardMaterial(),temple=new InstancedMesh(geometry,material,1);temple.setMatrixAt(0,new Matrix4().makeTranslation(0,1,0));temple.userData.pieceIds=['wall'];const caps=new Group(),scenery=new Group(),people=new Group();
 const point=new Vector3(0,1,0).project(camera);return{camera,geometry,material,temple,caps,scenery,people,x:(point.x+1)*50,y:(1-point.y)*50,dispose(){geometry.dispose();material.dispose();temple.dispose()}};
}
test('picking uses genuinely visible geometry and cut faces, not the broad temple envelope',()=>{
 const f=fixture(),before=JSON.stringify(f.camera.toJSON()),matrices=[...f.temple.instanceMatrix.array];let cut=false;
 const pick=createTemplePicker([f.temple],f.camera,()=>!cut,f.caps,f.scenery,f.people);assert.equal(pick.hit(f.x,f.y,100,100),true);assert.equal(pick.hit(90,10,100,100),false);cut=true;assert.equal(pick.hit(f.x,f.y,100,100),false);
 const cap=new Mesh(new BoxGeometry(2,.01,2),f.material);cap.position.y=1;f.caps.add(cap);assert.equal(pick.hit(f.x,f.y,100,100),true);assert.equal(JSON.stringify(f.camera.toJSON()),before);assert.deepEqual([...f.temple.instanceMatrix.array],matrices);cap.geometry.dispose();f.dispose();
});
test('visible visitors and scenery block activation without changing their raycast/geometry',()=>{
 const f=fixture(),pick=createTemplePicker([f.temple],f.camera,()=>true,f.caps,f.scenery,f.people),visitorGeometry=new BoxGeometry(.7,1,.7),visitor=new InstancedMesh(visitorGeometry,f.material,1);visitorGeometry.setAttribute('figureReveal',new InstancedBufferAttribute(new Float32Array([1]),1));visitor.raycast=()=>{};visitor.name='human-body';visitor.setMatrixAt(0,new Matrix4().makeTranslation(0,2.2,3));
 // A new picker observes the actual existing group hierarchy at creation.
 f.people.add(visitor);const withPeople=createTemplePicker([f.temple],f.camera,()=>true,f.caps,f.scenery,f.people);assert.equal(withPeople.hit(f.x,f.y,100,100),false);visitor.setMatrixAt(0,new Matrix4().makeTranslation(0,-.2,-3));assert.equal(withPeople.hit(f.x,f.y,100,100),true);visitorGeometry.getAttribute('figureReveal').setX(0,0);visitor.setMatrixAt(0,new Matrix4().makeTranslation(0,2.2,3));assert.equal(withPeople.hit(f.x,f.y,100,100),true);
 const rock=new Mesh(new BoxGeometry(.7,1,.7),f.material);rock.position.set(0,2.2,3);f.scenery.add(rock);assert.equal(pick.hit(f.x,f.y,100,100),false);rock.visible=false;assert.equal(pick.hit(f.x,f.y,100,100),true);assert.equal(visitor.raycast(),undefined);rock.geometry.dispose();visitorGeometry.dispose();visitor.dispose();f.dispose();
});
