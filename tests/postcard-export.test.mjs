import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paintPostcard,postcardFilename,POSTCARD_LAYOUT,POSTCARD_PNG} from '../src/postcard-export.ts';
import {createPostcardScene} from '../src/temple/postcard-scene.ts';
import {Scene,Group,Mesh,BoxGeometry,MeshStandardMaterial,InstancedMesh,Matrix4,DirectionalLight,Texture} from 'three';

test('PNG preserves the approved 602×490 composition at 3000×2442 without side margins or distortion',()=>{
  const calls=[],context={scale(...args){calls.push(['scale',...args]);},fillRect(...args){calls.push(['fill',this.fillStyle,...args]);},save(){},restore(){},beginPath(){},roundRect(...args){calls.push(['roundRect',...args]);},clip(){},drawImage(...args){calls.push(['image',...args]);},stroke(){calls.push(['stroke',this.strokeStyle,this.lineWidth]);},measureText(){return{fontBoundingBoxAscent:9,fontBoundingBoxDescent:3};},fillText(...args){calls.push(['text',this.font,this.fillStyle,this.textAlign,this.letterSpacing,...args]);}};
  const canvas={getContext:()=>context},image={width:3324,height:2460};
  paintPostcard(canvas,image,{name:'Another Hall',latitude:-33.8568,longitude:151.2153,location:'Sydney'});
  assert.deepEqual(POSTCARD_PNG,{width:3000,height:2442});assert.equal(canvas.width,3000);assert.equal(canvas.height,2442);
  assert.equal(POSTCARD_LAYOUT.width/POSTCARD_LAYOUT.height,602/490);
  assert.equal(POSTCARD_PNG.height,Math.round(POSTCARD_PNG.width*490/602));
  assert.deepEqual(calls[0],['scale',3000/602,3000/602]);assert.deepEqual(calls[1],['fill','#FAF9F6',0,0,602,2442/(3000/602)]);
  assert.deepEqual(calls.find(c=>c[0]==='roundRect'),['roundRect',20,20,562,410,2]);
  assert.deepEqual(calls.find(c=>c[0]==='stroke'),['stroke','#583622',.2]);
  const imageCall=calls.find(c=>c[0]==='image');assert.deepEqual(imageCall.slice(-4),[20,20,562,410]);assert.ok(imageCall[2]>=0&&imageCall[3]>=0);
  const text=calls.filter(c=>c[0]==='text');
  assert.deepEqual(text.map(c=>[c[2],c[5],c[6],c[7]]),[['#583622','ANOTHER HALL',20,455],['#AEAEAE','33°51′24″S 151°12′55″E',301,455],['#9F8F80','SYDNEY',582,455]]);
  assert.deepEqual(text.map(c=>c[1]),["500 12px 'DM Mono', monospace","400 11px 'DM Mono', monospace","500 12px 'DM Mono', monospace"]);
  assert.throws(()=>paintPostcard({getContext:()=>null},image,{}),/Unable to create/);
  assert.equal(postcardFilename({name:'São / Hall?'}),'brickit-sao-hall-postcard.png');
});

test('detached exterior has no plan/build shader or live scene mutations and releases only its own resources',()=>{
  const source=new Scene(),root=new Group(),plan=new Group(),coast=new Group(),geometry=new BoxGeometry(),material=new MeshStandardMaterial({color:'#B98D60'});
  material.onBeforeCompile=()=>{throw Error('live animation or clipping must not be used');};
  const mesh=new InstancedMesh(geometry,material,1);mesh.setMatrixAt(0,new Matrix4().makeTranslation(1,2,3));root.add(mesh,plan);
  source.add(root,coast);source.environment=new Texture();const light=new DirectionalLight('#fff5e6',3);source.add(light);light.position.set(-50,68,52);
  const before=JSON.stringify(source.toJSON()),snapshot=createPostcardScene(source,new Set([plan,coast]));
  const copy=snapshot.scene.children[0].children[0];assert.ok(copy instanceof InstancedMesh);assert.equal(snapshot.scene.children[0].children.length,1);
  assert.equal(copy.geometry,geometry);assert.notEqual(copy.material,material);assert.equal(copy.material.onBeforeCompile,MeshStandardMaterial.prototype.onBeforeCompile);
  assert.notEqual(copy.instanceMatrix.array,mesh.instanceMatrix.array);assert.deepEqual(copy.instanceMatrix.array,mesh.instanceMatrix.array);
  assert.equal(snapshot.scene.environment,source.environment);assert.ok(snapshot.scene.children.some(o=>o.name==='coastal-preview'));
  const clonedLight=snapshot.scene.children.find(o=>o instanceof DirectionalLight);assert.notEqual(clonedLight.shadow,light.shadow);assert.notEqual(clonedLight.target,light.target);
  let sharedDisposals=0,privateDisposals=0;geometry.addEventListener('dispose',()=>sharedDisposals++);material.addEventListener('dispose',()=>sharedDisposals++);source.environment.addEventListener('dispose',()=>sharedDisposals++);copy.material.addEventListener('dispose',()=>privateDisposals++);
  snapshot.dispose();assert.equal(sharedDisposals,0);assert.equal(privateDisposals,1);assert.equal(JSON.stringify(source.toJSON()),before);
  geometry.dispose();material.dispose();source.environment.dispose();
});
