import {
  ACESFilmicToneMapping, AmbientLight, CanvasTexture, Color, DirectionalLight, Group,
  HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  InstancedBufferAttribute, MeshDepthMaterial, RGBADepthPacking, Object3D, OrthographicCamera, PCFShadowMap, PlaneGeometry, PMREMGenerator, Scene,
  ShadowMaterial, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { BUILD_DURATION, createMotionPlan, remaining, turnAngle } from './animation.ts';
import { BOUNCE_HEIGHT, LANDING_GLSL, PROTOTYPE_DURATION, landingOffset, prototypeAngle, type LandingMotion } from './landing-prototype.ts';
import { planBatches } from './batching.ts';
import { COAST_START_MS, COAST_REVEAL_MS, coastReveal, createCoastalLandscape } from './coastal-preview.ts';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { disposeGeometries, geometryKey, partGeometry } from './geometry.ts';
import type { BrickRecord, MaterialRole, TempleDefinition } from './types.ts';
import type { PlanViewFactory } from './plan-view.ts';
import { postcardCamera } from './postcard-camera.ts';

export const PALETTE: Record<MaterialRole, string> = {
  sandstone: '#B98D60', honey: '#D4B184', toasted: '#99704C', brown: '#73513A',
};

export interface RenderedTemple {
  /** Root rotation is independent of every piece's immutable final transform. */
  root: Group;
  camera: OrthographicCamera;
  instances: Map<string, { mesh: InstancedMesh; index: number; finalMatrix: Matrix4 }>;
  rebuild: () => void;
  resetLandscape?: () => void;
  resetPlanView?: () => void;
  landscape?: Group;
  capturePostcard: () => HTMLCanvasElement;
  dispose: () => void;
}

export function displayTemple(container: HTMLElement, definition: TempleDefinition, prototype?: LandingMotion[], previewDuration?:number, coastalRevealAt?: number, planFactory?: PlanViewFactory): RenderedTemple {
  const duration = prototype ? previewDuration ?? PROTOTYPE_DURATION : BUILD_DURATION;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = .8;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const scene = new Scene();
  const root = new Group();
  root.name = 'shore-temple';
  scene.add(root);
  const planView = import.meta.env.DEV ? planFactory?.(definition) : undefined;
  if (planView) root.add(planView.group);
  const coast = import.meta.env.DEV && coastalRevealAt !== undefined ? createCoastalLandscape() : undefined;
  if (coast) scene.add(coast.group);
  const environment = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const environmentMap = pmrem.fromScene(environment, .04);
  scene.environment = environmentMap.texture;
  scene.environmentIntensity = .3;
  pmrem.dispose();
  environment.dispose();

  const materials = Object.fromEntries(Object.entries(PALETTE).map(([role, color]) => [role,
    new MeshStandardMaterial({ color, roughness: .4, metalness: 0, envMapIntensity: .65 }),
  ])) as Record<MaterialRole, MeshStandardMaterial>;

  const clock = { value: duration };
  const shaderMotion = (shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) => {
    shader.uniforms.buildTime = clock;
    shader.vertexShader = 'attribute vec4 buildMotion; attribute float buildDrop; attribute float buildBounce; attribute float buildEntry; attribute float buildDamping; uniform float buildTime; varying float buildOpacity;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      prototype ? '#include <begin_vertex>\n'+LANDING_GLSL+'\nif(buildOpacity<=0.0) transformed=vec3(0.0,10000.0,0.0);' : `#include <begin_vertex>
      float progress=clamp((buildTime-buildMotion.x)/buildMotion.y,0.0,1.0);
      float seat=.055/buildDrop;
      float u=clamp(progress/.94,0.0,1.0);
      float distance=u<.1?5.0*u*u:u<.8?u-.05:.75+(u-.8)-(u-.8)*(u-.8)/.4;
      float rest=progress<.94 ? seat+(1.0-seat)*(1.0-distance/.85) : seat*(1.0-smoothstep(.94,1.0,progress));
      buildOpacity=buildTime>buildMotion.x?1.0:0.0;
      transformed+=vec3(buildMotion.z,buildDrop,buildMotion.w)*rest;`);
    shader.fragmentShader='varying float buildOpacity;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      float grain=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
      if(buildOpacity<=grain) discard;`);
    planView?.patchShader(shader);
  };
  // The four stone materials share every property except their linear colour.
  // Instance colours allow equal part geometries to share a draw submission.
  const stoneMaterial=materials.sandstone.clone();stoneMaterial.color.set(0xffffff);
  stoneMaterial.onBeforeCompile=shaderMotion;
  Object.values(materials).forEach(m => { m.onBeforeCompile = shaderMotion; });
  const depthMaterial = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  depthMaterial.onBeforeCompile = shaderMotion;
  const sample = new Map(prototype?.map(m=>[m.pieceId,m]));
  const motions = prototype ? definition.pieces.map(p=>sample.get(p.id)??{delay:-1,duration:1,x:0,z:0,drop:0}) : createMotionPlan(definition.pieces);
  container.dataset.fallingEvents=String(prototype?.length ?? new Set(motions).size);
  const motionById = new Map(definition.pieces.map((p,i)=>[p.id,motions[i]]));
  const instances: RenderedTemple['instances'] = new Map();
  const plan=prototype?planBatches(definition.pieces):null;
  const batches=plan?.batches??new Map<string,BrickRecord[]>();
  if(!plan)for(const p of definition.pieces){const key=`${geometryKey(p)}:${p.material}`,batch=batches.get(key)??[];batch.push(p);batches.set(key,batch);}
  const object = new Object3D();
  for (const [key, pieces] of batches) {
    const mesh = new InstancedMesh(partGeometry(pieces[0]).clone(), prototype ? stoneMaterial : materials[pieces[0].material], pieces.length);
    mesh.name = key;
    if(plan)mesh.renderOrder=plan.order.get(key)!;
    const motionData = new Float32Array(pieces.length * 4), dropData = new Float32Array(pieces.length), bounceData=new Float32Array(pieces.length), entryData=new Float32Array(pieces.length), dampingData=new Float32Array(pieces.length);
    pieces.forEach((p, i) => { const m = motionById.get(p.id)!; motionData.set([m.delay,m.duration,prototype ? ('contact' in m ? (m as LandingMotion).contact-m.delay : 1) : m.x,prototype ? ('contact' in m ? (m as LandingMotion).settled-(m as LandingMotion).contact : 1) : m.z], i*4); dropData[i]=m.drop; bounceData[i]=(m as LandingMotion).bounceHeight??BOUNCE_HEIGHT; entryData[i]=(m as LandingMotion).entryFadeMs??0; dampingData[i]=(m as LandingMotion).bounceDamping??0; });
    mesh.geometry.setAttribute('buildMotion', new InstancedBufferAttribute(motionData, 4));
    mesh.geometry.setAttribute('buildDamping',new InstancedBufferAttribute(dampingData,1));
    mesh.geometry.setAttribute('buildEntry',new InstancedBufferAttribute(entryData,1));
    mesh.geometry.setAttribute('buildBounce',new InstancedBufferAttribute(bounceData,1));
    mesh.geometry.setAttribute('buildDrop', new InstancedBufferAttribute(dropData, 1));
    if (planView) mesh.geometry.setAttribute('planEligible', new InstancedBufferAttribute(new Float32Array(pieces.map(p => planView.eligible(p) ? 1 : 0)), 1));
    if (planView) mesh.geometry.setAttribute('planDetailTop', new InstancedBufferAttribute(new Float32Array(pieces.map(p => planView.detailTop(p))), 1));
    // Shader displacement can enter from beyond the fixed camera's upper edge.
    mesh.frustumCulled = false;
    mesh.customDepthMaterial = depthMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.pieceIds = pieces.map(p => p.id);
    pieces.forEach((p, index) => {
      object.position.fromArray(p.position);
      object.rotation.set(0, p.rotationY, 0);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
      if(prototype)mesh.setColorAt(index,materials[p.material].color);
      instances.set(p.id, { mesh, index, finalMatrix: object.matrix.clone() });
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    root.add(mesh);
  }

  // One fixed coastal sun: front-left in the approved hero composition.
  const keyLight = new DirectionalLight('#fff5e6', 3);
  keyLight.position.set(-50, 68, 52);
  keyLight.target.position.set(0, 5, 0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -58; keyLight.shadow.camera.right = 58;
  keyLight.shadow.camera.top = 58; keyLight.shadow.camera.bottom = -58;
  keyLight.shadow.camera.near = 1; keyLight.shadow.camera.far = 180;
  keyLight.shadow.bias = -.00015;
  keyLight.shadow.normalBias = .025;
  keyLight.shadow.radius = 2.5;
  keyLight.shadow.intensity = .78;
  scene.add(keyLight, keyLight.target);
  scene.add(new HemisphereLight('#f8f4ee', '#b6a394', .65));
  scene.add(new AmbientLight('#fff5e8', .12));
  const fill = new DirectionalLight('#edf1fa', .25);
  fill.position.set(45, 25, -30); scene.add(fill);

  const groundGeometry = new PlaneGeometry(300, 300);
  const groundMaterial = new ShadowMaterial({ color: new Color('#6c523c'), opacity: .16 });
  // The studio shadow catcher must not occlude the preview's shallow sand/water edges.
  if (coast) groundMaterial.depthWrite = false;
  const ground = new Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.07;
  ground.receiveShadow = true; scene.add(ground);

  // A soft studio contact shadow, not a landscape or additional model surface.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(82,60,36,.19)');
  gradient.addColorStop(.5, 'rgba(82,60,36,.1)');
  gradient.addColorStop(1, 'rgba(82,60,36,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new CanvasTexture(shadowCanvas);
  const contactMaterial = new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
  const contactGeometry = new PlaneGeometry(86, 68);
  const contact = new Mesh(contactGeometry, contactMaterial);
  contact.rotation.x = -Math.PI / 2; contact.position.set(1, -.05, 2); scene.add(contact);

  const camera = new OrthographicCamera(-50, 50, 50, -50, .1, 400);
  // Development-only orthographic views make reference comparison reproducible.
  const qaView = import.meta.env.DEV ? new URLSearchParams(location.search).get('view') : null;
  const direction = qaView === 'plan' ? new Vector3(.001, 1, .001) :
    qaView === 'elevation' ? new Vector3(0, .05, 1) :
    qaView === 'rear' ? new Vector3(-1, 1.0, -1) :
    new Vector3(.6, Math.hypot(.6, 1) * Math.tan(35 * Math.PI / 180), 1);
  direction.normalize().multiplyScalar(110);

  const target=new Vector3(),point=new Vector3(),right=new Vector3(),up=new Vector3();
  const framing=definition.pieces.map(p=>({c:Math.cos(p.rotationY),s:Math.sin(p.rotationY),hw:p.size[0]/2,hh:p.size[1]/2+.18,hd:p.size[2]/2}));
  function fitCamera(width: number, height: number) {
    target.set(0,15,0);
    camera.position.copy(target).add(direction);
    camera.lookAt(target); camera.updateMatrixWorld();

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const view = camera.matrixWorldInverse.elements;
    definition.pieces.forEach((p, i) => {
      const f=framing[i],c=f.c,sn=f.s;
      // Always fit the completed model at its approved hero orientation.
      // Falling pieces and root rotation must never change camera framing.
      point.fromArray(p.position).applyMatrix4(camera.matrixWorldInverse);
      const co=c,si=sn;
      const {hw,hh,hd}=f;
      const ex=Math.abs(view[0]*co-view[8]*si)*hw+Math.abs(view[4])*hh+Math.abs(view[0]*si+view[8]*co)*hd;
      const ey=Math.abs(view[1]*co-view[9]*si)*hw+Math.abs(view[5])*hh+Math.abs(view[1]*si+view[9]*co)*hd;
      minX=Math.min(minX,point.x-ex); maxX=Math.max(maxX,point.x+ex);
      minY=Math.min(minY,point.y-ey); maxY=Math.max(maxY,point.y+ey);
    });
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const offset = right.multiplyScalar((minX + maxX) / 2).add(up.multiplyScalar((minY + maxY) / 2));
    camera.position.add(offset); target.add(offset); camera.lookAt(target);
    // Fit the approved composition, then render extra ground below it. Extending
    // only the lower frustum keeps every existing world point at the same pixel
    // position while the canvas covers the short desktop frame all the way down.
    // This is resize-only; construction, rotation and the shared clock are intact.
    const compositionHeight = container.closest('.exhibit')!.getBoundingClientRect().height / .8 - 112;
    const aspect = width / compositionHeight;
    let vertical = Math.max((maxY - minY) * 1.13, (maxX - minX) / aspect * 1.11);
    // Keep the hero angle and centre, with the temple 20% smaller on screen.
    // This static projection is shared by the entire build and completed hold.
    vertical *= 1.25;
    if (qaView === 'closeup') vertical *= .57;
    camera.left = -vertical * aspect / 2; camera.right = vertical * aspect / 2;
    camera.top = vertical / 2;
    camera.bottom = -vertical / 2 - Math.max(0, height - compositionHeight) * vertical / compositionHeight;
    camera.updateProjectionMatrix();
    planView?.fitInteraction(camera, width, height);
  }

  let disposed = false, scheduledFrame = 0, renderCount = 0;
  let viewportWidth = 0, viewportHeight = 0;
  let running = false, started = 0, deadline = 0, warming = true, openingFrame = false;
  let coastStarted: number | undefined, coastAllowed = false, coastAnimating = false;
  let frameCount=0,frameTotal=0,maxFrame=0,lastFrame=0;
  let pointerOnCanvas = false, pointerX = 0, pointerY = 0, hoverInside = false, keyboardFocus = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const rebuild = () => {
    if (disposed || warming) return;
    planView?.reset();
    pointerOnCanvas = hoverInside = keyboardFocus = false;
    if (coast) { coastStarted = undefined; coastAllowed = true; coast.setReveal(0); }
    clearTimeout(deadline);
    started = performance.now(); lastFrame = started; frameCount=0;frameTotal=0;maxFrame=0;
    openingFrame=true;
    running = !reduced.matches; clock.value = running ? 0 : duration;
    container.dataset.state = running ? 'building' : 'complete';
    container.dispatchEvent(new CustomEvent('buildstate', { detail: running }));
    if (running) deadline = window.setTimeout(requestRender, duration);
    cancelAnimationFrame(scheduledFrame); scheduledFrame=0; render();
  };
  const render = (frameTime?: number) => {
    scheduledFrame = 0;
    if (disposed || warming) return;
    const { width, height } = container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    // One display clock drives physics, rotation, scenery, border and audio.
    // Timers must never cancel or race a pending presentation. rAF's timestamp
    // also avoids turning callback scheduling jitter into uneven motion steps.
    const now = frameTime ?? performance.now();
    if (running) {
      const delta=now-lastFrame; if(delta>0){frameCount++;frameTotal+=delta;maxFrame=Math.max(maxFrame,delta);} lastFrame=now;
      clock.value = reduced.matches ? duration : openingFrame ? 0 : Math.min(duration, now-started);
      openingFrame=false;
      if (clock.value >= duration) {
        running=false; clearTimeout(deadline);
        container.dataset.state='complete';
        container.dataset.durationMs=String(now-started);
        container.dataset.maxFrameMs=String(maxFrame);
        container.dataset.averageFps=String(Math.round(1000*frameCount/frameTotal));
        container.dataset.finalOffset=String(prototype ? Math.max(...prototype.map(m=>landingOffset(m,clock.value))) : Math.max(...motions.map(m=>remaining(m,clock.value)*m.drop)));
        container.dispatchEvent(new CustomEvent('buildstate', {detail:false}));
      }
    }
    if (!running && (coastAnimating || planView?.animating)) lastFrame = now;
    root.rotation.y = prototype ? prototypeAngle(clock.value,duration) : turnAngle(clock.value);
    if (coast) {
      // Scenery emerges on a separate clock while the unchanged build continues.
      if (coastAllowed && clock.value >= COAST_START_MS) coastStarted ??= started + COAST_START_MS;
      const elapsed = coastStarted === undefined ? 0 : now - coastStarted;
      const reveal = reduced.matches && coastAllowed ? 1 : coastReveal(elapsed);
      coast.setReveal(reveal);
      coastAnimating = coastStarted !== undefined && !reduced.matches && elapsed < COAST_REVEAL_MS;
      container.dataset.landscape = reveal === 1 ? 'complete' : reveal > 0 ? 'revealing' : 'hidden';
      container.dataset.landscapeReveal = String(reveal);
    }
    if (planView) {
      syncPlanInput(now);
      planView.update(now);
      coast?.setPlanEmphasis(planView.emphasis);
      container.dataset.viewMode = planView.animating ? planView.timeline.target === 1 ? 'cutting' : 'restoring' : planView.timeline.progress === 1 ? 'plan' : 'exterior';
      container.dataset.planProgress = String(planView.timeline.progress);
      renderer.domElement.setAttribute('aria-pressed', String(planView.timeline.target === 1));
      renderer.domElement.setAttribute('aria-disabled', String(!readyForPlan()));
      renderer.domElement.setAttribute('aria-label', 'Shore Temple. Hover or focus to reveal its architectural plan; leave or move focus away to restore the exterior.');
    }
    if (width !== viewportWidth || height !== viewportHeight) {
      renderer.setSize(width, height, false); viewportWidth=width; viewportHeight=height;
      fitCamera(width, height);
    }
    const cpuStart = performance.now();
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    container.dataset.cpuFrameMs=String(performance.now()-cpuStart);
    container.dataset.visibility=document.visibilityState;
    container.dataset.ready = 'true';
    container.dataset.pieceCount = String(definition.pieces.length);
    container.dataset.renderCount = String(++renderCount);
    container.dataset.triangles = String(renderer.info.render.triangles);
    container.dataset.drawCalls = String(renderer.info.render.calls);
    container.closest('figure')?.setAttribute('aria-busy', 'false');
    container.dispatchEvent(new Event('templeframe'));
    container.dispatchEvent(new CustomEvent('buildprogress', {detail:{elapsed:clock.value,building:running,timelineSampleTime:now,renderedAt:performance.now()}}));
    if (running || coastAnimating || planView?.animating) requestRender();
  };
  const requestRender = () => {
    if (scheduledFrame || disposed) return;
    scheduledFrame = requestAnimationFrame(render);
  };
  const readyForPlan = () => !warming && !running && container.dataset.state === 'complete' && (!coast || container.dataset.landscape === 'complete');
  const syncPlanInput = (now: number) => {
    if (!planView) return false;
    hoverInside = pointerOnCanvas && planView.containsPointer(pointerX, pointerY, hoverInside);
    return planView.setRevealed(readyForPlan() && (hoverInside || keyboardFocus), now, reduced.matches);
  };
  const updatePlanInput = () => { if (syncPlanInput(performance.now())) requestRender(); };
  const onPlanPointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerOnCanvas = true; pointerX = event.clientX - rect.left; pointerY = event.clientY - rect.top;
    updatePlanInput();
  };
  const onPlanLeave = () => { pointerOnCanvas = hoverInside = false; updatePlanInput(); };
  const onPlanFocus = () => { keyboardFocus = renderer.domElement.matches(':focus-visible'); updatePlanInput(); };
  const onPlanBlur = () => { keyboardFocus = false; updatePlanInput(); };
  const onPlanKey = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); keyboardFocus = true; updatePlanInput(); }
    if (event.key === 'Escape') { renderer.domElement.blur(); }
  };
  if (planView) {
    renderer.domElement.removeAttribute('aria-hidden');
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('role', 'button');
    renderer.domElement.addEventListener('pointerenter', onPlanPointer);
    renderer.domElement.addEventListener('pointermove', onPlanPointer);
    renderer.domElement.addEventListener('pointerleave', onPlanLeave);
    renderer.domElement.addEventListener('pointercancel', onPlanLeave);
    renderer.domElement.addEventListener('focus', onPlanFocus);
    renderer.domElement.addEventListener('blur', onPlanBlur);
    renderer.domElement.addEventListener('keydown', onPlanKey);
  }
  const observer = new ResizeObserver(requestRender);
  observer.observe(container);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    container.dataset.ready = 'false';
  });
  renderer.domElement.addEventListener('webglcontextrestored', requestRender);
  const onReduced = () => {
    if (running && reduced.matches) { clock.value=duration; started=performance.now()-duration; requestRender(); }
    if (planView?.animating && reduced.matches) { planView.timeline.finish(); requestRender(); }
  };
  reduced.addEventListener('change', onReduced);
  const onVisible = () => { if (!document.hidden && (running || coastAnimating || planView?.animating)) requestRender(); };
  document.addEventListener('visibilitychange', onVisible);
  planView?.prepareWarmup();
  renderer.compileAsync(scene, camera).then(() => {
    if(disposed)return;
    // Warm the actual screen/depth programs, not an offscreen colour-space variant.
    // Hide the canvas until the empty opening has replaced this private warm-up draw.
    renderer.domElement.style.visibility='hidden';
    const bounds=container.getBoundingClientRect();
    viewportWidth=Math.max(1,bounds.width);viewportHeight=Math.max(1,bounds.height);
    renderer.setSize(viewportWidth,viewportHeight,false);
    fitCamera(viewportWidth,viewportHeight);renderer.shadowMap.needsUpdate=true;
    renderer.render(scene,camera);renderer.getContext().finish();renderer.clear();
    planView?.reset();
    warming=false;
    if(qaView){render();renderer.domElement.style.visibility='';}
    else {
      // Present the empty canvas once before starting the clock: first-presentation
      // compositor work must not consume a chunk of the visible construction.
      clock.value=reduced.matches?duration:0;render();
      renderer.domElement.style.visibility='';
      scheduledFrame=requestAnimationFrame(()=>{scheduledFrame=0;if(!disposed)rebuild();});
    }
  });

  return {
    root, camera, instances, rebuild,
    capturePostcard() {
      if (disposed || warming || running || (coast && container.dataset.landscape !== 'complete')) throw new Error('The miniature is still assembling.');
      // A dedicated scene render, not a screenshot of the page or its canvas.
      // Reuse this context, environment and light resources; create no new loop.
      const size=renderer.getSize(new Vector2()),ratio=renderer.getPixelRatio();
      const previewCamera=postcardCamera(camera,definition.pieces,1662/1230);
      const temporaryCoast=coast ? undefined : createCoastalLandscape();
      if(temporaryCoast){temporaryCoast.setReveal(1);scene.add(temporaryCoast.group);}
      const emphasis=planView?.emphasis??0;
      const output=document.createElement('canvas');output.width=1662;output.height=1230;
      const draw=()=>{
        renderer.setPixelRatio(1);renderer.setSize(output.width,output.height,false);
        renderer.shadowMap.needsUpdate=true;renderer.render(scene,previewCamera);
        output.getContext('2d')!.drawImage(renderer.domElement,0,0);
      };
      coast?.setPlanEmphasis(0);
      try { if(planView)planView.withExterior(draw);else draw(); }
      finally {
        temporaryCoast?.dispose();coast?.setPlanEmphasis(emphasis);
        renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);
        renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
      }
      return output;
    },
    ...(planView ? { resetPlanView() { pointerOnCanvas = hoverInside = keyboardFocus = false; planView.reset(); requestRender(); } } : {}),
    ...(coast ? { landscape:coast.group, resetLandscape() {
      coastAllowed = false; coastStarted = undefined; coastAnimating = false;
      coast.setReveal(0); requestRender();
    } } : {}),
    dispose() {
      disposed = true; clearTimeout(deadline); reduced.removeEventListener('change', onReduced); document.removeEventListener('visibilitychange', onVisible); cancelAnimationFrame(scheduledFrame); observer.disconnect();
      root.traverse(o => { if (o instanceof InstancedMesh) { o.geometry.dispose(); o.dispose(); } });
      Object.values(materials).forEach(m => m.dispose());stoneMaterial.dispose();
      depthMaterial.dispose(); disposeGeometries();
      planView?.dispose();
      renderer.domElement.removeEventListener('pointerenter', onPlanPointer);
      renderer.domElement.removeEventListener('pointermove', onPlanPointer);
      renderer.domElement.removeEventListener('pointerleave', onPlanLeave);
      renderer.domElement.removeEventListener('pointercancel', onPlanLeave);
      renderer.domElement.removeEventListener('focus', onPlanFocus);
      renderer.domElement.removeEventListener('blur', onPlanBlur);
      renderer.domElement.removeEventListener('keydown', onPlanKey);
      coast?.dispose();
      environmentMap.dispose(); groundGeometry.dispose(); groundMaterial.dispose();
      contactGeometry.dispose(); contactMaterial.dispose(); shadowTexture.dispose();
      renderer.dispose(); renderer.domElement.remove();
    },
  };
}
