import { Raycaster, Vector2, type Intersection, type Mesh, type Object3D, type OrthographicCamera, type MeshStandardMaterial } from 'three';

export const WAVE_SETTLE_MS=800;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** The final shoreline of the existing combined sand/water surface. */
export function seaCoverage(x:number,z:number){
  const right=x*.857492926-z*.514495755,depth=x*.514495755+z*.857492926;
  const shore=depth+2.1*Math.sin(right*.04)+.65*Math.sin(right*.11+.7);
  const t=clamp((shore+40.4)/4.8);return 1-t*t*(3-2*t);
}

/** Analytic damped envelope: reversal preserves both position and velocity.
 * The phase advances only while active, so re-entry never resets the water. */
export class SeaWaveTimeline {
  strength=0;velocity=0;phase=0;hovered=false;
  private time:number|undefined;
  private changed=0;
  setHovered(hovered:boolean,now:number,reduced=false){
    if(reduced){this.reset();return false;}
    this.update(now);
    if(this.hovered===hovered)return false;
    this.hovered=hovered;this.changed=Math.max(now,this.time??now);this.time=this.changed;
    return this.hovered||this.strength>0;
  }
  update(now:number){
    if(this.time===undefined){this.time=now;return false;}
    if(now<this.time)return this.hovered||this.strength>0;
    const dt=(now-this.time)/1000;this.time=now;
    if(this.hovered||this.strength>0){
      this.phase+=dt;
      const target=this.hovered?1:0,error=this.strength-target,b=this.velocity+14*error,decay=Math.exp(-14*dt);
      this.strength=target+(error+b*dt)*decay;
      this.velocity=(this.velocity-14*b*dt)*decay;
      if(now-this.changed>=WAVE_SETTLE_MS){this.strength=target;this.velocity=0;}
    }
    return this.hovered||this.strength>0;
  }
  reset(){this.strength=this.velocity=this.phase=0;this.hovered=false;this.time=undefined;this.changed=0;}
}

/** Modulate the existing lit water in its own draw: no overlay, new mesh,
 * shadow caster, texture, simulation, or additional animation clock. */
export function createSeaWaves(surface:Mesh,camera:OrthographicCamera,blockers:()=>Object3D[],visible:(hit:Intersection)=>boolean){
  const timeline=new SeaWaveTimeline(),ray=new Raycaster(),pointer=new Vector2(),hits:Intersection[]=[],occluders:Intersection[]=[];
  const material=surface.material as MeshStandardMaterial;
  const originalCompile=material.onBeforeCompile,originalKey=material.customProgramCacheKey;
  const uniforms={seaWaveTime:{value:0},seaWaveStrength:{value:0}};
  material.customProgramCacheKey=()=>originalKey.call(material)+'-hover-waves-v1';
  material.onBeforeCompile=(shader,renderer)=>{
    originalCompile.call(material,shader,renderer);
    Object.assign(shader.uniforms,uniforms);
    shader.fragmentShader='uniform float seaWaveTime; uniform float seaWaveStrength;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`
      // Gentle, slightly curved bands travel shoreward. All variation is zero
      // at rest; the approved sea palette and lighting remain the baseline.
      vec2 seaWaveSlope=vec2(0.0);
      if(seaWaveStrength>0.0){
        float mask=smoothstep(.75,.99,sea)*seaWaveStrength;
        float a=site.y*.85+.35*sin(site.x*.12)-seaWaveTime*1.35;
        float b=site.y*1.27+site.x*.065-seaWaveTime*1.02+1.7;
        float c=site.y*.43-site.x*.045-seaWaveTime*.63+3.1;
        float height=.60*sin(a)+.27*sin(b)+.13*sin(c);
        float slopeDepth=.51*cos(a)+.3429*cos(b)+.0559*cos(c);
        float slopeRight=.0252*cos(site.x*.12)*cos(a)+.01755*cos(b)-.00585*cos(c);
        seaWaveSlope=vec2(.857492926,-.514495755)*slopeRight+vec2(.514495755,.857492926)*slopeDepth;
        float crest=pow(.5+.5*sin(a),10.0)*(.7+.3*sin(site.x*.08+seaWaveTime*.2));
        diffuseColor.rgb*=1.0+mask*(height*.035+crest*.065-.012);
        seaWaveSlope*=mask*.028;
      }
      #include <normal_fragment_begin>`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      if(seaWaveStrength>0.0)normal=normalize(normal+mat3(viewMatrix)*vec3(-seaWaveSlope.x,0.0,-seaWaveSlope.y));`);
  };
  material.needsUpdate=true;
  const sync=()=>{uniforms.seaWaveTime.value=timeline.phase;uniforms.seaWaveStrength.value=timeline.strength;};
  return {timeline,uniforms,
    hit(x:number,y:number,width:number,height:number){
      if(!surface.visible||surface.parent?.visible===false)return false;
      pointer.set(x/width*2-1,1-y/height*2);ray.setFromCamera(pointer,camera);ray.far=Infinity;
      hits.length=0;surface.updateWorldMatrix(true,false);ray.intersectObject(surface,false,hits);
      const hit=hits[0];if(!hit||seaCoverage(hit.point.x,hit.point.z)<.9)return false;
      ray.far=hit.distance-.0001;occluders.length=0;ray.intersectObjects(blockers(),false,occluders);
      return !occluders.some(visible);
    },
    hover(hovered:boolean,now:number,reduced:boolean){const changed=timeline.setHovered(hovered,now,reduced);sync();return changed;},
    update(now:number){const active=timeline.update(now);sync();return active;},
    reset(){timeline.reset();sync();},
    dispose(){timeline.reset();sync();material.onBeforeCompile=originalCompile;material.customProgramCacheKey=originalKey;material.needsUpdate=true;},
  };
}
