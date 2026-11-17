import { Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Vector2, Vector4, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TREE_QUIETENING } from './plan-style.ts';

export const COAST_START_MS = 2000;
export const COAST_REVEAL_MS = 4500;
export const COAST_TREE_SITES = [[-30,-27],[-22,-25.5],[24,-27],[33,-21]] as const;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const t=clamp(v); return t*t*t*(t*(t*6-15)+10); };
export function coastReveal(elapsed: number) { return clamp(elapsed / COAST_REVEAL_MS); }
export function coastTreeGrowth(index: number, elapsed: number) {
  const start=[1550,1850,2200,1700][index];
  return {trunk:smooth((elapsed-start)/450),lower:smooth((elapsed-start-180)/600),
    upper:smooth((elapsed-start-390)/550),studs:smooth((elapsed-start-600)/300)};
}

/** All terrain remains fixed; only light, colour and material visibility develop. */
export function coastAppearance(elapsed: number) {
  const sea=smooth((elapsed-650)/3850);
  return {sand:smooth(elapsed/4000),sea,shoreWidth:24+(2.4-24)*sea};
}

/** The scenery has its own growth clock; it never moves or modifies temple pieces. */
export function createCoastalLandscape() {
  const group=new Group(); group.name='coastal-preview';
  const materials:MeshStandardMaterial[]=[],geometries=new Set<BufferGeometry>();
  const seaAppearance={value:0},shoreWidth={value:24};
  const treeShade={value:new Vector4()};
  const material=(color:string,name:string)=>{
    const m=new MeshStandardMaterial({color,roughness:.5,metalness:0,envMapIntensity:.5,
      transparent:true,opacity:0,depthWrite:false});
    m.name=name;materials.push(m);return m;
  };
  const sand=material('#E8C998','sand'),trunk=material('#896E4C','tree-trunk');
  const leaf=material('#527C51','foliage'),upper=material('#7EA165','foliage-light');
  const leafOriginal=leaf.color.clone(),upperOriginal=upper.color.clone(),quietSage=new Color('#A2A38A');
  sand.roughness=.68; sand.envMapIntensity=.35;
  leaf.roughness=upper.roughness=.4; leaf.envMapIntensity=upper.envMapIntensity=.65;
  const seaColor=new Color('#567F99'),shallowColor=new Color('#98BFC0'),wetColor=new Color('#C9B58E');
  sand.customProgramCacheKey=()=> 'coastal-tonal-depth-v1';
  sand.onBeforeCompile=shader=>{
    shader.uniforms.coastSeaAppearance=seaAppearance;shader.uniforms.coastShoreWidth=shoreWidth;shader.uniforms.coastSeaColor={value:seaColor};
    shader.uniforms.coastShallowColor={value:shallowColor};shader.uniforms.coastWetColor={value:wetColor};
    shader.uniforms.coastTrees={value:anchors.map(([x,z])=>new Vector2(x,z))};shader.uniforms.coastTreeShade=treeShade;
    shader.vertexShader='varying vec2 coastXZ;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ncoastXZ=position.xz;');
    shader.fragmentShader=`varying vec2 coastXZ;
      uniform float coastSeaAppearance; uniform float coastShoreWidth;
      uniform vec3 coastSeaColor; uniform vec3 coastShallowColor; uniform vec3 coastWetColor;
      uniform vec2 coastTrees[4]; uniform vec4 coastTreeShade;
      float coastHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      float coastNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(coastHash(i),coastHash(i+vec2(1,0)),f.x),mix(coastHash(i+vec2(0,1)),coastHash(i+vec2(1,1)),f.x),f.y);}
      `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      `#include <color_fragment>
      vec2 site=vec2(dot(coastXZ,vec2(.857492926,-.514495755)),dot(coastXZ,vec2(.514495755,.857492926)));
      float shore=site.y+2.1*sin(site.x*.04)+.65*sin(site.x*.11+.7);
      float sea=1.0-smoothstep(-38.0-coastShoreWidth,-38.0+coastShoreWidth,shore);
      // Broad, low-contrast sand tones; fine detail is deliberately restrained.
      float tone=.93+.10*coastNoise(coastXZ*.045)+.014*coastNoise(coastXZ*.24);
      vec3 sandTone=diffuseColor.rgb*tone;
      vec2 a=max(abs(coastXZ-vec2(14,1))-vec2(25,22),0.0);
      vec2 b=max(abs(coastXZ-vec2(-24,0))-vec2(14,12),0.0);
      float contact=.055*exp(-min(length(a),length(b))*1.15);
      for(int i=0;i<4;i++){
        vec2 p=(coastXZ-coastTrees[i]-vec2(.3,-.45))/vec2(1.35,.85);
        contact+=.14*exp(-dot(p,p)*1.7)*coastTreeShade[i];
      }
      sandTone*=1.0-contact;
      float wet=(1.0-smoothstep(.4,4.0,shore+38.0))*(1.0-sea);
      sandTone=mix(sandTone,coastWetColor,wet*coastSeaAppearance*.28);
      float depth=max(0.0,-38.0-shore);
      vec3 water=mix(coastShallowColor,coastSeaColor,smoothstep(0.0,42.0,depth));
      float glint=pow(.5+.5*sin(shore*.9+.55*sin(site.x*.09)),18.0);
      water*=1.0+.065*glint*smoothstep(1.0,6.0,depth);
      float shoreLight=exp(-pow((shore+38.0)/.42,2.0));
      water=mix(water,vec3(.72,.78,.72),shoreLight*.12);
      diffuseColor.rgb=mix(sandTone,water,sea*coastSeaAppearance);`);
  };
  const add=(geometry:BufferGeometry,mat:MeshStandardMaterial,x=0,y=0,z=0)=>{
    geometries.add(geometry);const mesh=new Mesh(geometry,mat);
    // Trees use the temple's single sun/shadow map, including their growth poses.
    // The expansive ground never casts; its existing contact shading is retained.
    mesh.name=mat.name;mesh.position.set(x,y,z);mesh.castShadow=mat!==sand;mesh.receiveShadow=true;
    mesh.renderOrder=mat===sand?-20:mat===trunk?-15:mat===leaf?-14:-13;
    mesh.frustumCulled=false;group.add(mesh);return mesh;
  };
  const ground=new PlaneGeometry(1200,1200);ground.rotateX(-Math.PI/2);const surface=add(ground,sand,0,-.04,0);

  const c=1/Math.hypot(1,.6),s=.6/Math.hypot(1,.6),turn=Math.atan(.6);
  const lowerCrown=new RoundedBoxGeometry(2.8,.8,1.8,1,.09),upperCrown=new RoundedBoxGeometry(1.9,.65,1.4,1,.08);
  const stem=new CylinderGeometry(.18,.2,1.2,12),stud=new CylinderGeometry(.3,.3,.16,12);
  const anchors=COAST_TREE_SITES.map(([right,depth])=>[c*right+s*depth,-s*right+c*depth]);
  group.userData.treeAnchors=anchors.map(p=>[...p]);
  const trees=anchors.map(([x,z])=>{
    const stemMesh=add(stem,trunk,x,.6,z);
    const lower=add(lowerCrown,leaf,x,1.35,z);lower.rotation.y=turn;
    const high=add(upperCrown,upper,x,1.98,z);high.rotation.y=turn;
    const studs=[-.5,.5].map(offset=>add(stud,upper,x+c*offset,2.38,z-s*offset));
    return {stem:stemMesh,lower,upper:high,studs};
  });
  const grow=(mesh:Mesh,q:number,bottom:number,height:number,bloom=false)=>{
    mesh.visible=q>0;mesh.scale.y=q;mesh.position.y=bottom+height*q/2;
    mesh.scale.x=mesh.scale.z=bloom ? .35+.65*q : 1;
  };
  return {group, surface, trees:trees.map((tree,i)=>({anchor:anchors[i],parts:[tree.stem,tree.lower,tree.upper,...tree.studs]})),
    setPlanEmphasis(amount:number){
      const t=clamp(amount)*TREE_QUIETENING;
      leaf.color.copy(leafOriginal).lerp(quietSage,t);
      upper.color.copy(upperOriginal).lerp(quietSage,t);
    },
    setReveal(progress:number){
      const elapsed=clamp(progress)*COAST_REVEAL_MS;
      const appearance=coastAppearance(elapsed);
      sand.opacity=appearance.sand;seaAppearance.value=appearance.sea;shoreWidth.value=appearance.shoreWidth;
      for(const m of [trunk,leaf,upper])m.opacity=1;
      group.visible=progress>0;
      trees.forEach((tree,i)=>{
        const q=coastTreeGrowth(i,elapsed);
        treeShade.value.setComponent(i,q.trunk*(.35+.65*q.lower));
        grow(tree.stem,q.trunk,0,1.2);
        const base=Math.max(0,1.2*q.trunk-.25);
        grow(tree.lower,q.lower,base,.8,true);
        const upperBase=base+.8*q.lower-.095;
        grow(tree.upper,q.upper,Math.max(base,upperBase),.65,true);
        const studBase=q.upper===1 ? 2.3 : Math.max(base,upperBase)+.65*q.upper-.005;
        tree.studs.forEach(mesh=>grow(mesh,q.studs,studBase,.16));
      });
    },
    dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.removeFromParent();},
  };
}
