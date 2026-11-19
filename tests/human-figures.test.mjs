import {test} from 'node:test';import assert from 'node:assert/strict';import {Box3,Matrix4,InstancedMesh,MeshStandardMaterial,Object3D,OrthographicCamera,Vector3} from 'three';
import{partGeometry,geometryKey}from'../src/temple/geometry.ts';import{createTemplePicker}from'../src/temple/temple-interaction.ts';
import {createTempleDefinition}from'../src/temple/model.ts';import{refineCollectible}from'../src/temple/refine-collectible.ts';import{createHumanFigures,humanSites,humanPose,humanNextActivity,plantedFoot,HUMAN_HEIGHT}from'../src/temple/human-figures.ts';
const definition=refineCollectible(createTempleDefinition()),sites=humanSites(definition);
const solids=definition.pieces.map(p=>{const c=Math.abs(Math.cos(p.rotationY)),s=Math.abs(Math.sin(p.rotationY)),w=(p.size[0]*c+p.size[2]*s)/2,h=p.size[1]/2,d=(p.size[0]*s+p.size[2]*c)/2;return{p,min:[p.position[0]-w,p.position[1]-h,p.position[2]-d],max:[p.position[0]+w,p.position[1]+h,p.position[2]+d]};});
test('three arrivals and three shrine visitors preserve six approved LEGO figures, doorway-based scale and original temple records',()=>{
 const before=JSON.stringify(definition),h=createHumanFigures(definition);assert.equal(sites.length,6);assert.equal(sites.filter(s=>s.loop==='concealed').length,3);assert.deepEqual(sites.filter(s=>s.chamber).map(s=>s.chamber),definition.chambers.map(c=>c.name));assert.ok(HUMAN_HEIGHT/4.8>.4&&HUMAN_HEIGHT/4.8<.55);assert.equal(h.group.getObjectByName('human-body').geometry.type,'RoundedBoxGeometry');assert.equal(h.group.getObjectByName('human-round').geometry.type,'CylinderGeometry');assert.equal(h.group.children.length,3);assert.equal(JSON.stringify(definition),before);assert.equal(definition.pieces.length,1911);h.dispose();
});
test('interior circuits close without a visible position, facing or gait reset and use actual east doorway access',()=>{
 for(const [i,s]of sites.entries()){for(const m of s.motion){if(m.kind==='walk')assert.ok(Math.hypot(m.to[0]-m.from[0],m.to[2]-m.from[2])>0);}
  if(s.loop==='circuit'){const a=humanPose(s,i,s.duration-.001),b=humanPose(s,i,s.duration);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-7);assert.ok(Math.abs(Math.sin(a.yaw)-Math.sin(b.yaw))<1e-7);assert.equal(a.walk,b.walk);assert.ok(humanNextActivity(s,s.duration)>s.duration);}
 }
 const v=sites.find(s=>s.chamber==='vishnu');assert.ok(v.motion.some(m=>m.kind==='walk'&&m.to[0]>-9));assert.ok(v.motion.some(m=>m.kind==='walk'&&m.to[0]<-10));assert.equal(humanNextActivity(sites[0],sites[0].delay-.0005),sites[0].delay);
});
test('stance feet remain planted in world distance rather than sliding; swing feet progress forward',()=>{
 for(const side of [-1,1]){let last;for(let d=1;d<3;d+=.001){const f=plantedFoot(d,5,side);if(last&&f.u===0&&last.u===0&&f.from===last.from)assert.equal(f.at,last.at);if(last&&f.from===last.from)assert.ok(f.at>=last.at);last=f;}}
});
test('main observer is revealed promptly on the open court, pauses, walks and resets to the same point',()=>{
 const h=createHumanFigures(definition),main=sites.findIndex(s=>s.chamber==='main'),site=sites[main];h.update(0,true,false,0);h.update(450,true,false,0);let p=h.group.userData.poses[main];assert.equal(h.group.userData.poses.length,6);assert.equal(p.state,'waiting');assert.equal(p.reveal,1);assert.equal(p.x,9);assert.equal(p.z,12.5);assert.ok(p.z>11&&p.z<15,'outside the roofed shrine, inside the existing paved rim');h.update(2000,true,false,1);assert.equal(h.group.userData.poses[main].x,p.x);assert.equal(h.group.userData.poses[main].z,p.z);h.update(7000,true,false,1);assert.ok(Math.hypot(h.group.userData.poses[main].x-p.x,h.group.userData.poses[main].z-p.z)>.1);h.reset();h.update(10000,true,true,1);p=h.group.userData.poses[main];assert.equal(p.x,site.from[0]);assert.equal(p.z,site.from[2]);assert.equal(p.moving,false);h.dispose();
});
test('main observer is genuinely visible in front of the completed masonry from the approved isometric direction',()=>{
 const h=createHumanFigures(definition),groups=new Map(),meshes=[],object=new Object3D(),material=new MeshStandardMaterial();h.update(0,true,true,0);
 for(const p of definition.pieces){const key=geometryKey(p);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
 for(const pieces of groups.values()){const mesh=new InstancedMesh(partGeometry(pieces[0]),material,pieces.length);mesh.userData.pieceIds=pieces.map(p=>p.id);pieces.forEach((p,i)=>{object.position.fromArray(p.position);object.rotation.set(0,p.rotationY,0);object.updateMatrix();mesh.setMatrixAt(i,object.matrix)});meshes.push(mesh);}
 const camera=new OrthographicCamera(-50,50,50,-50,.1,400),target=new Vector3(0,15,0),direction=new Vector3(.6,Math.hypot(.6,1)*Math.tan(35*Math.PI/180),1).normalize().multiplyScalar(110);camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateMatrixWorld(true);
 const body=h.group.getObjectByName('human-body'),matrix=new Matrix4();body.getMatrixAt(3*12,matrix);const point=new Vector3().setFromMatrixPosition(matrix).project(camera),x=(point.x+1)*500,y=(1-point.y)*500,plain=createTemplePicker(meshes,camera,()=>true),occupied=createTemplePicker(meshes,camera,()=>true,undefined,undefined,h.group);
 assert.equal(plain.hit(x,y,1000,1000),true,'real temple paving lies behind the visitor');assert.equal(occupied.hit(x,y,1000,1000),false,'the visible visitor must be closer than masonry, not hidden by the roof');h.dispose();for(const mesh of meshes)mesh.dispose();material.dispose();
});
test('exterior recycling requires proven start/end occlusion and a complete exterior; traffic never deadlocks or overlaps',()=>{
 const h=createHumanFigures(definition);h.update(0,true,false,0);for(let t=100;t<80000;t+=100)h.update(t,true,false,0);assert.deepEqual(h.group.userData.cycles,[0,0,0,0,0,0]);
 h.reset();h.group.userData.recycleProof.fill(true);h.update(0,true,false,1);for(let t=100;t<80000;t+=100)h.update(t,true,false,1);assert.deepEqual(h.group.userData.cycles,[0,0,0,0,0,0]);
 h.reset();h.update(0,true,false,0);let previous=[],lastCycles=[0,0,0];for(let t=32;t<=200000;t+=32){h.update(t,true,false,0);const p=h.group.userData.poses,cycles=h.group.userData.cycles;for(let i=0;i<3;i++){for(let j=0;j<i;j++)assert.ok(Math.hypot(p[i].x-p[j].x,p[i].z-p[j].z)>.84);if(previous[i]&&Math.hypot(p[i].x-previous[i].x,p[i].z-previous[i].z)>.1)assert.ok(cycles[i]>lastCycles[i],'large movement only at a proven concealed recycle');}previous=p.map(p=>({...p}));lastCycles=[...cycles];}
 assert.ok(h.group.userData.cycles.slice(0,3).every(c=>c>=2));h.dispose();
});
test('reveals wait for completion, view transitions preserve ongoing world-space circulation, and reduced motion/hidden pages freeze safely',()=>{
 const h=createHumanFigures(definition);assert.equal(h.update(0,false,false).active,false);assert.equal(h.group.visible,false);h.update(1000,true,false,0);h.update(1250,true,false,0);assert.ok(h.group.userData.poses[0].reveal>h.group.userData.poses[5].reveal);const start=h.group.userData.poses.map(p=>({...p}));h.update(6500,true,false,0);assert.ok(Math.hypot(h.group.userData.poses[3].x-start[3].x,h.group.userData.poses[3].z-start[3].z)>.01);const unchanged=h.group.userData.poses.map(p=>({...p}));h.update(6500,true,false,1);for(let i=0;i<6;i++){assert.equal(h.group.userData.poses[i].x,unchanged[i].x);assert.equal(h.group.userData.poses[i].z,unchanged[i].z);}
 h.update(6516,true,false,1);h.update(9016,true,false,1);assert.ok(Math.hypot(h.group.userData.poses[3].x-start[3].x,h.group.userData.poses[3].z-start[3].z)>.1);h.setHidden(true,9016);const pause=JSON.stringify(h.group.userData.poses),cycles=[...h.group.userData.cycles];assert.equal(h.update(90000,true,false,1).active,false);assert.equal(JSON.stringify(h.group.userData.poses),pause);assert.deepEqual(h.group.userData.cycles,cycles);h.setHidden(false,90000);h.update(90000,true,false,1);assert.equal(JSON.stringify(h.group.userData.poses),pause);
 h.update(90016,true,true,1);const frozen=h.group.children.map(m=>[...m.instanceMatrix.array]);assert.equal(h.update(99000,true,true,1).wakeAt,undefined);assert.deepEqual(h.group.children.map(m=>[...m.instanceMatrix.array]),frozen);h.reset();assert.equal(h.group.visible,false);assert.ok(h.group.userData.cycles.every(c=>c===0));h.update(100000,true,true,0);assert.ok(h.group.userData.poses.every(p=>p.reveal===1&&!p.moving));h.dispose();
});
test('multiple complete circuits and exterior approaches clear the unchanged masonry and sacred fittings with grounded feet',()=>{
 const mat=new Matrix4(),box=new Box3();for(const plan of [0,1]){const h=createHumanFigures(definition);h.group.userData.recycleProof.fill(true);h.update(0,true,false,plan);for(let t=1200;t<=150000;t+=80){h.update(t,true,false,plan);for(const m of h.group.children.filter(m=>m.name!=='human-contact-shadows')){m.geometry.computeBoundingBox();for(let i=0;i<m.count;i++){m.getMatrixAt(i,mat);box.copy(m.geometry.boundingBox).applyMatrix4(mat);for(const {p,min,max}of solids)assert.ok(!(box.min.x<max[0]-.025&&box.max.x>min[0]+.025&&box.min.y<max[1]-.025&&box.max.y>min[1]+.025&&box.min.z<max[2]-.025&&box.max.z>min[2]+.025),`${m.name}[${i}] meets ${p.id} at ${t}`);}}
 for(const feet of h.group.userData.feet){assert.ok(feet.some(f=>Math.abs(f.y-f.ground)<.001),'one foot remains on its actual support');for(const f of feet)assert.ok(f.y>=f.ground-.0001);}}
 h.dispose();}
});
test('visitor resources are batched, noninteractive, and released without affecting temple resources',()=>{const h=createHumanFigures(definition);for(const m of h.group.children){assert.equal(m.castShadow,false);const hits=[];m.raycast({},hits);assert.deepEqual(hits,[]);}let disposed=0;for(const m of h.group.children)m.geometry.addEventListener('dispose',()=>disposed++);h.dispose();assert.equal(disposed,3);});
test('stationary waiting periods preserve instance buffers and request only the next scheduled movement',()=>{
 const h=createHumanFigures(definition);for(const s of h.sites){s.initialTime=0;s.delay+=10000;s.duration+=10000;for(const m of s.motion){m.start+=10000;m.end+=10000;}}
 h.update(0,true,false,0);const waiting=h.update(2000,true,false,0),versions=h.group.children.map(m=>m.instanceMatrix.version);assert.equal(waiting.active,false);assert.equal(waiting.wakeAt,10400);const next=h.update(2500,true,false,0);assert.equal(next.active,false);assert.equal(next.wakeAt,10400);assert.deepEqual(h.group.children.map(m=>m.instanceMatrix.version),versions);h.dispose();
});
test('an initially hidden page initializes visible reduced-motion arrivals only when shown',()=>{
 const h=createHumanFigures(definition);h.setHidden(true,0);assert.equal(h.update(1000,true,true,0).active,false);assert.equal(h.group.visible,false);h.setHidden(false,5000);h.update(5000,true,true,0);assert.equal(h.group.visible,true);for(let i=0;i<3;i++){const expected=humanPose(h.sites[i],i,h.sites[i].initialTime,true);assert.equal(h.group.userData.poses[i].x,expected.x);assert.equal(h.group.userData.poses[i].z,expected.z);assert.ok(expected.x>=25.5);}h.dispose();
});

test('the forecourt crossing remains live over late circulation cycles, without a permanent queue',()=>{
 const h=createHumanFigures(definition);h.group.userData.recycleProof.fill(true);h.update(0,true,false,0);let halfway;
 for(let t=64;t<=420000;t+=64){h.update(t,true,false,0);if(t===210048)halfway=[...h.group.userData.cycles];}
 assert.ok(halfway);for(let i=0;i<3;i++)assert.ok(h.group.userData.cycles[i]>=halfway[i]+2,`${sites[i].id} must keep circulating after the first several journeys`);h.dispose();
});

test('rendered feet follow planted world-space anchors through rounded corners',()=>{
 const h=createHumanFigures(definition),matrix=new Matrix4();h.update(0,true,false,1);let checked=0;
 for(let t=1200;t<35000;t+=64){h.update(t,true,false,1);const body=h.group.getObjectByName('human-body');for(let i=0;i<6;i++)for(let j=0;j<2;j++){const foot=h.group.userData.feet[i][j];body.getMatrixAt(i*12+(j?9:4),matrix);assert.ok(Math.hypot(matrix.elements[12]-foot.x,matrix.elements[14]-foot.z)<.00001);if(h.group.userData.poses[i].state==='walk'&&foot.stance)checked++;}}
 assert.ok(checked>100);h.dispose();
});
