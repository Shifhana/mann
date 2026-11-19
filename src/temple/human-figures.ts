import { Color, CylinderGeometry, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Raycaster, ShaderMaterial, Vector3, type OrthographicCamera } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { TempleDefinition } from './types.ts';
import { HUMAN_HEIGHT, humanSites, humanPose, humanNextActivity, humanWalkPoint, plantedFoot, type HumanSite, type HumanPose } from './human-navigation.ts';
export { HUMAN_HEIGHT, HUMAN_REVEAL_MS, humanSites, humanPose, humanNextActivity, plantedFoot } from './human-navigation.ts';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
function supportField(definition:TempleDefinition){
 const blocks=definition.pieces.filter(p=>p.shape==='box'&&(p.structuralRole==='floor'||p.structuralRole==='foundation'||p.group==='main.plinth-studs')).map(p=>({p,c:Math.cos(p.rotationY),s:Math.sin(p.rotationY),top:p.position[1]+p.size[1]/2})),cache=new Map<string,number>();
 return (x:number,z:number,base:number,yaw:number)=>{
  const key=[x,z,base,yaw].map(n=>n.toFixed(4)).join(',');const found=cache.get(key);if(found!==undefined)return found;
  let top=-Infinity;const c=Math.cos(yaw),s=Math.sin(yaw);
  for(const [ox,oz]of [[0,0],[-.10,-.17],[.10,-.17],[-.10,.17],[.10,.17]]){const wx=x+ox*c+oz*s,wz=z-ox*s+oz*c;
   for(const b of blocks){if(b.top<base-.82||b.top>base+.82)continue;const dx=wx-b.p.position[0],dz=wz-b.p.position[2],lx=dx*b.c-dz*b.s,lz=dx*b.s+dz*b.c;if(Math.abs(lx)>b.p.size[0]/2-.001||Math.abs(lz)>b.p.size[2]/2-.001)continue;top=Math.max(top,b.top);if(b.p.studs){const sx=lx+b.p.size[0]/2-.5,sz=lz+b.p.size[2]/2-.5;if(Math.hypot(sx-Math.round(sx),sz-Math.round(sz))<.3)top=Math.max(top,b.top+.18);}}
  }
  if(!Number.isFinite(top))top=base;
  if(cache.size>4096)cache.clear();cache.set(key,top);return top;
 };
}
type Part={name:string;kind:'body'|'round';color:string};
function parts(site:HumanSite,index:number):Part[]{const skin=index%2?'#C0A178':'#CFB187',pants=index%2?'#777063':'#687770';const a:Part[]=[{name:'torso',kind:'body',color:site.shirt},{name:'pelvis',kind:'body',color:pants},{name:'neck',kind:'round',color:skin},{name:'head',kind:'round',color:skin},{name:'stud',kind:'round',color:skin}];for(const side of ['left','right'])a.push({name:side+'-thigh',kind:'body',color:pants},{name:side+'-shin',kind:'body',color:pants},{name:side+'-foot',kind:'body',color:'#655D4F'},{name:side+'-upper-arm',kind:'body',color:site.shirt},{name:side+'-forearm',kind:'body',color:site.shirt},{name:side+'-hand',kind:'round',color:skin});return a;}

export function createHumanFigures(definition:TempleDefinition){
  const sites=humanSites(definition),group=new Group();group.name='human-scale-figures';group.visible=false;group.userData.sites=sites;
  // Compile conservative junction-entry windows once; no per-frame look-ahead
  // raycasting or route sampling is needed for the two crossing arrival lanes.
  const junctionWindows=sites.map(site=>{
    const windows:{start:number;end:number}[]=[];if(site.chamber)return windows;
    let inside=false;
    for(let t=0;t<=site.duration+100;t+=100){const p=humanPose(site,0,t),next=Math.hypot(p.x-27.5,p.z-3.1)<1.45;if(next&&!inside)windows.push({start:Math.max(0,t-100),end:t+100});if(next)windows.at(-1)!.end=t+100;inside=next;}
    return windows;
  });
  const all=sites.map(parts),bodyGeometry=new RoundedBoxGeometry(1,1,1,1,.055),ovalGeometry=new CylinderGeometry(.5,.5,1,16);
  const material=new MeshStandardMaterial({color:0xffffff,roughness:.48,metalness:0,envMapIntensity:.45});
  material.customProgramCacheKey=()=> 'inhabited-lego-people-v3';
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float figureReveal; varying float humanReveal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhumanReveal=figureReveal;');
    shader.fragmentShader='varying float humanReveal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      if(humanReveal<1.0 && humanReveal<=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715)))))discard;`);
  };
  const makeMesh=(geometry:typeof bodyGeometry|typeof ovalGeometry,kind:Part['kind'])=>{
    const count=all.flat().filter(p=>p.kind===kind).length,reveal=new InstancedBufferAttribute(new Float32Array(count),1),mesh=new InstancedMesh(geometry,material,count);
    geometry.setAttribute('figureReveal',reveal);reveal.setUsage(DynamicDrawUsage);mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.name='human-'+kind;mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.raycast=()=>{};group.add(mesh);return mesh;
  };
  const bodies=makeMesh(bodyGeometry,'body'),ovals=makeMesh(ovalGeometry,'round'),indices={body:0,round:0},offscreen=new Matrix4().makeTranslation(0,10000,0);
  const mapped=all.map(list=>Object.fromEntries(list.map(part=>{const index=indices[part.kind]++,mesh=part.kind==='body'?bodies:ovals;mesh.setColorAt(index,new Color(part.color));mesh.setMatrixAt(index,offscreen);return [part.name,{index,mesh}];})));
  // Retain the existing lightweight contact shadows and cached sun shadow map.
  const shadowGeometry=new PlaneGeometry(1,1);shadowGeometry.rotateX(-Math.PI/2);
  const shadowAlpha=new InstancedBufferAttribute(new Float32Array(sites.length),1);shadowGeometry.setAttribute('figureReveal',shadowAlpha);
  const shadowMaterial=new ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{ink:{value:new Color('#6C523C')}},
    vertexShader:'attribute float figureReveal;varying float opacity;varying vec2 coord;void main(){opacity=figureReveal;coord=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform vec3 ink;varying float opacity;varying vec2 coord;void main(){float edge=1.0-smoothstep(.1,1.0,length(coord));gl_FragColor=vec4(ink,edge*edge*.15*opacity);
      #include <colorspace_fragment>
    }`});
  const shadows=new InstancedMesh(shadowGeometry,shadowMaterial,sites.length);shadows.name='human-contact-shadows';shadows.frustumCulled=false;shadows.renderOrder=-12;shadows.raycast=()=>{};shadows.instanceMatrix.setUsage(DynamicDrawUsage);group.add(shadows);
  const position=new Vector3(),scale=new Vector3(),q=new Quaternion(),body=new Quaternion(),matrix=new Matrix4(),axisY=new Vector3(0,1,0),direction=new Vector3();
  const ground=supportField(definition),clocks=sites.map(()=>0),cycles=sites.map(()=>0),proof=sites.map(()=>false),speeds=sites.map(()=>1),poses:HumanPose[]=[],feet:{x:number;y:number;z:number;ground:number;stance:boolean}[][]=[];
  group.userData.poses=poses;group.userData.cycles=cycles;group.userData.feet=feet;group.userData.recycleProof=proof;
  let lastTime:number|undefined,revealTime=0,wasActive=false,lastReduced=false,lastPlan=0,hidden=false,initialized=false,junctionOwner=-1;
  function draw(reduced:boolean){
    sites.forEach((site,i)=>{
      const pose=humanPose(site,i,clocks[i],reduced,revealTime);pose.walk*=speeds[i];if(speeds[i]<.001){pose.moving=false;pose.state='pause';}poses[i]=pose;body.setFromAxisAngle(axisY,pose.yaw);const s=site.scale,c=Math.cos(pose.yaw),sn=Math.sin(pose.yaw),m=site.motion[pose.segment];
      const supports=[-1,1].map(sign=>{
        const lateral=sign*.12*s,neutralX=pose.x+c*lateral,neutralZ=pose.z-sn*lateral,base=ground(neutralX,neutralZ,pose.y,pose.yaw);
        if(!pose.walk||!m||m.kind!=='walk')return {x:neutralX,y:base,z:neutralZ,ground:base,stance:true,offset:0};
        const f=plantedFoot(pose.along,pose.length,sign),target=(distance:number)=>{const p=humanWalkPoint(site,m.run,distance);return{x:p.x+Math.cos(p.yaw)*lateral,y:p.y,z:p.z-Math.sin(p.yaw)*lateral};},a=target(f.from),b=target(f.to),ha=ground(a.x,a.z,a.y,pose.yaw),hb=ground(b.x,b.z,b.y,pose.yaw);
        let u=smooth(f.u),y=ha+(hb-ha)*u+f.lift*.085*s;
        // Raise before translating across the existing .8-stud level change;
        // lower only after clearing the edge. The other foot remains planted.
        if(Math.abs(hb-ha)>.08&&f.u>0){u=smooth((f.u-.22)/.56);const rise=smooth(f.u/.22),seat=smooth((f.u-.78)/.22);y=ha+(Math.max(ha,hb)+.075*s-ha)*rise-(Math.max(ha,hb)+.075*s-hb)*seat;}
        const x=neutralX+(a.x+(b.x-a.x)*u-neutralX)*pose.walk,z=neutralZ+(a.z+(b.z-a.z)*u-neutralZ)*pose.walk,offset=(x-neutralX)*sn+(z-neutralZ)*c;
        const sole=base+(y-base)*pose.walk,actual=ground(x,z,pose.y,pose.yaw);
        return{x,y:f.u===0?actual:Math.max(sole,actual),z,ground:actual,stance:f.u===0&&pose.walk===1,offset};
      });
      feet[i]=supports;
      let hip=(supports[0].y+supports[1].y)/2+(1.08-.02*pose.walk)*s;
      for(const foot of supports)hip=Math.min(hip,foot.y+.14*s+Math.sqrt(Math.max(.01,(.985*s)**2-foot.offset**2)));
      pose.y=hip-1.08*s;
      const put=(name:string,x:number,y:number,z:number,w:number,h:number,d:number)=>{
        const {mesh,index}=mapped[i][name];position.set(x,y,z).multiplyScalar(s).applyQuaternion(body);position.x+=pose.x;position.y+=pose.y;position.z+=pose.z;q.copy(body);scale.set(w*s,h*s,d*s);matrix.compose(position,q,scale);mesh.setMatrixAt(index,matrix);(mesh.geometry.getAttribute('figureReveal') as InstancedBufferAttribute).setX(index,pose.reveal);
      };
      const segment=(name:string,x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,w:number,d:number)=>{
        direction.set(x1-x2,y1-y2,z1-z2);const length=direction.length();direction.divideScalar(length);q.setFromUnitVectors(axisY,direction);const {mesh,index}=mapped[i][name];position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2).multiplyScalar(s).applyQuaternion(body);position.x+=pose.x;position.y+=pose.y;position.z+=pose.z;q.premultiply(body);scale.set(w*s,length*s,d*s);matrix.compose(position,q,scale);mesh.setMatrixAt(index,matrix);(mesh.geometry.getAttribute('figureReveal') as InstancedBufferAttribute).setX(index,pose.reveal);
      };
      put('pelvis',0,1.11,0,.45,.18,.32);put('torso',0,1.44,0,.54,.64,.35);put('neck',0,1.81,0,.22,.14,.22);put('head',0,2.02,0,.44,.44,.44);put('stud',0,2.28,0,.18,.08,.18);
      for(const [j,side,sign]of [[0,'left',-1],[1,'right',1]] as const){
        const foot=supports[j],ankle=(foot.y+.14*s-pose.y)/s,z=foot.offset/s,dy=ankle-1.08,length=Math.hypot(dy,z),bend=Math.sqrt(Math.max(0,.5**2-length**2/4)),kneeY=(1.08+ankle)/2+bend*z/length,kneeZ=z/2-bend*dy/length,x=sign*.12,footX=((foot.x-pose.x)*c-(foot.z-pose.z)*sn)/s;
        segment(side+'-thigh',x,1.08,0,(x+footX)/2,kneeY,kneeZ,.17,.20);segment(side+'-shin',(x+footX)/2,kneeY,kneeZ,footX,ankle,z,.155,.18);put(side+'-foot',footX,(foot.y+.07*s-pose.y)/s,z,.19,.14,.34);
        const phase=pose.length?pose.along/.84*Math.PI*2:0,swing=.065*pose.walk*Math.sin(phase+(j?Math.PI:0));segment(side+'-upper-arm',sign*.34,1.69,0,sign*.35,1.43,swing*.6,.16,.18);segment(side+'-forearm',sign*.35,1.43,swing*.6,sign*.35,1.18,.025+swing,.14,.16);put(side+'-hand',sign*.35,1.13,.025+swing,.17,.17,.17);
      }
      position.set(pose.x,ground(pose.x,pose.z,site.from[1],pose.yaw)+.008,pose.z);q.identity();scale.set(.65*s,1,.65*s);matrix.compose(position,q,scale);shadows.setMatrixAt(i,matrix);shadowAlpha.setX(i,pose.reveal);
    });
    for(const mesh of [bodies,ovals]){mesh.instanceMatrix.needsUpdate=true;(mesh.geometry.getAttribute('figureReveal') as InstancedBufferAttribute).needsUpdate=true;}shadows.instanceMatrix.needsUpdate=true;shadowAlpha.needsUpdate=true;
  }
  return {group,sites,
    /** Conservatively prove the full reset silhouette is behind actual masonry.
     * Done in private warmup, not during a visible landing/visitor frame. */
    prepareVisibility(camera:OrthographicCamera,blockers:InstancedMesh[]){
      const ray=new Raycaster(),dir=camera.getWorldDirection(new Vector3()),point=new Vector3(),hits:import('three').Intersection[]=[];for(const mesh of blockers)mesh.updateWorldMatrix(true,false);
      const concealed=(site:HumanSite,time:number)=>{const p=humanPose(site,0,time);for(const y of [.01,.05,.8,1.5,HUMAN_HEIGHT])for(const x of [-.46,.46])for(const z of [-.35,.35]){point.set(p.x+x*site.scale,ground(p.x,p.z,site.from[1],p.yaw)+y*site.scale,p.z+z*site.scale).addScaledVector(dir,-200);ray.set(point,dir);ray.far=199.995;hits.length=0;ray.intersectObjects(blockers,false,hits);if(!hits.length)return false;}return true;};
      group.userData.visibilityProof=sites.map((site,i)=>{if(site.loop!=='concealed')return null;const start=concealed(site,0),end=concealed(site,site.duration);proof[i]=start&&end;return{start,end};});
    },
    update(now:number,ready:boolean,reduced:boolean,planProgress=0){
      if(!ready){if(lastTime!==undefined)this.reset();return{active:false,wakeAt:undefined};}
      const first=!initialized,dt=first?0:Math.max(0,now-lastTime!);lastTime=Math.max(now,lastTime??now);
      if(hidden)return{active:false,wakeAt:undefined};
      if(first){initialized=true;sites.forEach((site,i)=>{clocks[i]=!site.chamber||reduced?site.initialTime:0;});}
      const planChanged=lastPlan!==planProgress;
      if(!reduced&&!lastReduced){revealTime+=dt;const current=sites.map((site,i)=>humanPose(site,i,clocks[i]));
        // The return from the steps crosses the north/south forecourt lane.
        // Reserve that small junction before either visitor reaches it, so two
        // mutually cautious visitors cannot stop face-to-face at the crossing.
        const junctionDistance=(p:HumanPose)=>Math.hypot(p.x-27.5,p.z-3.1);
        const arrivals=junctionWindows.map((windows,i)=>{
          const next=windows.find(w=>w.end>=clocks[i]),eta=next?Math.max(0,next.start-clocks[i]):Infinity;
          return eta<=6000?eta:Infinity;
        });
        if(junctionOwner>=0&&arrivals[junctionOwner]===Infinity)junctionOwner=-1;
        if(junctionOwner<0){let soon=Infinity;arrivals.forEach((eta,i)=>{if(eta<soon){soon=eta;junctionOwner=i;}});}
        for(let i=0;i<sites.length;i++){
          const site=sites[i],previous=current[i],step=dt*(previous.state==='walk'?1+.035*Math.sin(clocks[i]/5100+i*1.73):1),candidate=humanPose(site,i,clocks[i]+step);let pace=1;
          current.forEach((other,j)=>{if(j===i)return;const dist=Math.hypot(previous.x-other.x,previous.z-other.z);if(Math.hypot(candidate.x-other.x,candidate.z-other.z)<dist)pace=Math.min(pace,smooth((dist-.84)/.62));});
          if(junctionOwner>=0&&junctionOwner!==i&&arrivals[i]<Infinity&&junctionDistance(candidate)<junctionDistance(previous))pace=Math.min(pace,smooth((junctionDistance(previous)-1.45)/.8));
          // Release a queue gradually instead of holding the last visitor outside.
          // Never advance farther than the collision-safe pace when braking.
          speeds[i]=Math.min(pace,speeds[i]+dt/550);clocks[i]+=step*speeds[i];current[i]=humanPose(site,i,clocks[i]);
          if(site.loop==='concealed'&&clocks[i]>=site.duration&&planProgress===0&&proof[i]&&!current.some((other,j)=>j!==i&&!sites[j].chamber&&Math.hypot(site.from[0]-other.x,site.from[2]-other.z)<.85)){clocks[i]=0;cycles[i]++;current[i]=humanPose(site,i,0);}
        }
      }
      lastPlan=planProgress;if(reduced)revealTime=Math.max(revealTime,1190);
      const active=!reduced&&(revealTime<1190||sites.some((site,i)=>humanPose(site,i,clocks[i]).moving&&speeds[i]>.001));
      if(!group.visible||active||wasActive||lastReduced!==reduced||planChanged){draw(reduced);group.visible=true;}
      wasActive=active;lastReduced=reduced;let wait=Infinity;
      if(!reduced)sites.forEach((site,i)=>{const next=humanNextActivity(site,clocks[i]);if(next!==undefined)wait=Math.min(wait,next-clocks[i]);});
      return{active,wakeAt:Number.isFinite(wait)?now+Math.max(1,wait):undefined};
    },
    setHidden(value:boolean,now:number){hidden=value;lastTime=lastTime===undefined?undefined:now;},
    prepareWarmup(){group.visible=true;},
    reset(){lastTime=undefined;initialized=false;revealTime=0;clocks.fill(0);cycles.fill(0);speeds.fill(1);junctionOwner=-1;wasActive=lastReduced=false;lastPlan=0;poses.length=feet.length=0;group.visible=false;},
    dispose(){group.removeFromParent();for(const mesh of [bodies,ovals,shadows]){mesh.geometry.dispose();mesh.dispose();}material.dispose();shadowMaterial.dispose();},
  };
}
