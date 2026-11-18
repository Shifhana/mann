import { BufferGeometry, Color, DataTexture, DoubleSide, Float32BufferAttribute, Group, LinearFilter, Mesh, MeshStandardMaterial, RedFormat, Vector4, type OrthographicCamera } from 'three';
import { partGeometry, geometryKey } from './geometry.ts';
import { PLAN_CUT_HEIGHT, PlanTimeline, planCutHeight } from './plan-timeline.ts';
import type { BrickRecord, TempleDefinition, Vec3 } from './types.ts';
import { createTempleHoverRegion } from './plan-hover.ts';
import { createCutEdgeField, isSectionRelief, rasterCutEdges } from './plan-edges.ts';
import { CUT_BASE, CUT_EDGE, CUT_FILL, CUT_ROUGHNESS, createPlanDepthZones, planContactGLSL, planEmphasis } from './plan-style.ts';
import { INTERIOR_FLOOR, INTERIOR_THRESHOLD, INTERIOR_FLOOR_MIX, INTERIOR_THRESHOLD_MIX, createPlanInteriorRegions, planInteriorGLSL, planInteriorContourGLSL } from './plan-interiors.ts';

type Point = [number, number];
type Solid = { vertices: Vec3[]; edges: [number, number][]; min: Vec3; max: Vec3; pieceId: string };
type Shader = { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string };
const EPS = 1e-6;

export function planEligible(p: BrickRecord) {
  // Retain the existing sacred fittings whole as conventional plan furnishings.
  // Everything architectural uses precisely the same horizontal cutting level.
  return p.structuralRole !== 'sacred';
}

/** Partition the actual rendered triangles into their connected body/stud shells.
 * Position welding is for topology only: slice vertices retain the rendered coordinates.
 * In particular, never bridge neighbouring studs with one convex hull. */
function componentTopology(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position'), index = geometry.index;
  const vertices: Vec3[] = [], welded = new Map<string, number>(), remap: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const v: Vec3 = [position.getX(i), position.getY(i), position.getZ(i)];
    const key = v.map(n => Math.round(n * 1e5)).join(',');
    let id = welded.get(key);
    if (id === undefined) { id = vertices.length; vertices.push(v); welded.set(key, id); }
    remap.push(id);
  }
  const parent = vertices.map((_, i) => i), edgeMap = new Map<string, [number, number]>();
  const find = (v: number): number => { while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; } return v; };
  const count = index?.count ?? position.count;
  for (let i = 0; i < count; i += 3) {
    const ids = [0, 1, 2].map(j => remap[index ? index.getX(i + j) : i + j]);
    for (let j = 0; j < 3; j++) {
      const a = ids[j], b = ids[(j + 1) % 3];
      if (a === b) continue;
      parent[find(a)] = find(b);
      edgeMap.set(`${Math.min(a, b)},${Math.max(a, b)}`, [a, b]);
    }
  }
  const parts = new Map<number, { vertices: Vec3[]; edges: [number, number][]; remap: Map<number, number> }>();
  for (const [a, b] of edgeMap.values()) {
    const key = find(a);
    const part: { vertices: Vec3[]; edges: [number, number][]; remap: Map<number, number> } = parts.get(key) ?? { vertices: [], edges: [], remap: new Map() };
    const local = [a, b].map(id => {
      let n = part.remap.get(id);
      if (n === undefined) { n = part.vertices.length; part.vertices.push(vertices[id]); part.remap.set(id, n); }
      return n;
    });
    part.edges.push([local[0], local[1]]); parts.set(key, part);
  }
  return [...parts.values()].map(({ vertices, edges }) => ({ vertices, edges }));
}

export function createPlanSolids(pieces: BrickRecord[]): Solid[] {
  const cache = new Map<string, ReturnType<typeof componentTopology>>(), solids: Solid[] = [];
  for (const p of pieces.filter(planEligible)) {
    if(isSectionRelief(p))continue;
    const key = geometryKey(p);
    let components = cache.get(key);
    if (!components) { components = componentTopology(partGeometry(p)); cache.set(key, components); }
    const c = Math.cos(p.rotationY), s = Math.sin(p.rotationY);
    for (const component of components) {
      const vertices = component.vertices.map(([x, y, z]): Vec3 => [p.position[0] + c * x + s * z, p.position[1] + y, p.position[2] - s * x + c * z]);
      const min = [0, 1, 2].map(i => Math.min(...vertices.map(v => v[i]))) as Vec3;
      const max = [0, 1, 2].map(i => Math.max(...vertices.map(v => v[i]))) as Vec3;
      if (max[1] < PLAN_CUT_HEIGHT) continue;
      solids.push({ vertices, edges: component.edges, min, max, pieceId: p.id });
    }
  }
  return solids;
}

function hull(points: Point[]): Point[] {
  const sorted = points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unique = sorted.filter((p, i) => !i || Math.abs(p[0] - sorted[i - 1][0]) + Math.abs(p[1] - sorted[i - 1][1]) > EPS);
  if (unique.length < 3) return [];
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [], upper: Point[] = [];
  for (const p of unique) { while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= EPS) lower.pop(); lower.push(p); }
  for (const p of [...unique].reverse()) { while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= EPS) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop(); return lower.concat(upper);
}

export interface PlanFace { pieceId: string; height: number; polygon: Vec3[] }

/** All eligible body shapes are convex; studs are separate convex shells.
 * Cross-section hulls therefore match the source triangles, including bevels/slopes.
 * Their closed cap also seals the intentionally omitted, buried stud bottom. */
export function planFaces(solids: Solid[], height: number): PlanFace[] {
  const faces: PlanFace[] = [];
  for (const solid of solids) {
    if (solid.min[1] >= height - EPS || solid.max[1] <= height + EPS) continue;
    const points: Point[] = [];
    for (const [a, b] of solid.edges) {
      const u = solid.vertices[a], v = solid.vertices[b], da = u[1] - height, db = v[1] - height;
      if (Math.abs(da) < EPS) points.push([u[0], u[2]]);
      if ((da < 0) === (db < 0)) continue;
      const t = da / (da - db);
      points.push([u[0] + (v[0] - u[0]) * t, u[2] + (v[2] - u[2]) * t]);
    }
    const poly = hull(points).reverse(); // XZ winding with upward-facing normal.
    if (poly.length < 3) continue;
    faces.push({ pieceId: solid.pieceId, height, polygon: poly.map(([x, z]): Vec3 => [x, height, z]) });
  }
  return faces;
}

function capGeometry(faces: PlanFace[]) {
  const vertices: number[] = [], normals: number[] = [],importance:number[]=[];
  for (const face of faces) for (let i = 1; i < face.polygon.length - 1; i++) {
    vertices.push(...face.polygon[0], ...face.polygon[i], ...face.polygon[i + 1]);
    for (let j = 0; j < 3; j++) {normals.push(0, 1, 0);importance.push(face.pieceId.startsWith('enclosure.') ? .45 : 1);}
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('cutImportance',new Float32BufferAttribute(importance,1));
  geometry.computeBoundingSphere(); return geometry;
}

export function createPlanView(definition: TempleDefinition) {
  const solids = createPlanSolids(definition.pieces), timeline = new PlanTimeline();
  const edges=createCutEdgeField(definition.pieces,PLAN_CUT_HEIGHT),raster=rasterCutEdges(edges);
  const edgeTexture=new DataTexture(raster.data,raster.width,raster.height,RedFormat);
  edgeTexture.minFilter=edgeTexture.magFilter=LinearFilter;edgeTexture.generateMipmaps=false;edgeTexture.needsUpdate=true;
  const edgeAmount={value:1},[x0,z0,x1,z1]=edges.bounds;
  const uniforms = { planActive: { value: 0 }, planHeight: { value: planCutHeight(0) },planDepthStrength:{value:0} };
  const contactShader=planContactGLSL(createPlanDepthZones(definition));
  const interiorRegions=createPlanInteriorRegions(definition),interiorShader=planInteriorGLSL(interiorRegions);
  const material = new MeshStandardMaterial({ color: CUT_FILL, roughness: CUT_ROUGHNESS, metalness: 0, envMapIntensity: .28, side: DoubleSide });
  material.customProgramCacheKey=()=> 'architectural-cut-interiors-v3';
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{cutEdges:{value:edgeTexture},cutBounds:{value:new Vector4(x0,z0,1/(x1-x0),1/(z1-z0))},cutInk:{value:new Color(CUT_EDGE)},cutBase:{value:new Color(CUT_BASE)},cutInkAmount:edgeAmount});
    shader.vertexShader='attribute float cutImportance; varying float vCutImportance; varying vec2 vCutXZ;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCutXZ=position.xz; vCutImportance=cutImportance;');
    shader.fragmentShader='varying float vCutImportance; varying vec2 vCutXZ; uniform sampler2D cutEdges; uniform vec4 cutBounds; uniform vec3 cutInk; uniform vec3 cutBase; uniform float cutInkAmount;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      diffuseColor.rgb=mix(cutBase,diffuseColor.rgb,vCutImportance);
      ${planInteriorContourGLSL(interiorRegions)}
      float cutEdge=texture2D(cutEdges,(vCutXZ-cutBounds.xy)*cutBounds.zw).r*cutInkAmount*mix(.7,1.0,vCutImportance)*interiorContour;
      diffuseColor.rgb=mix(diffuseColor.rgb,cutInk,cutEdge);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.88,cutEdge);');
  };
  // A representative real cap warms the colour/depth programs in the renderer's
  // private opening pass, rather than stalling the first user-triggered section.
  const warmGeometry=capGeometry(planFaces(solids,PLAN_CUT_HEIGHT));
  const caps = new Mesh(warmGeometry, material);
  caps.name = 'section-poche'; caps.castShadow = true; caps.receiveShadow = true; caps.frustumCulled = false;
  const group = new Group(); group.name = 'architectural-plan'; group.visible = false; group.add(caps);
  let previous = -1;
  let hoverRegion: ReturnType<typeof createTempleHoverRegion> | undefined;
  return {
    group, timeline,
    fitInteraction(camera: OrthographicCamera, width: number, height: number) { hoverRegion = createTempleHoverRegion(definition, camera, width, height); },
    containsPointer(x: number, y: number, inside: boolean) { return hoverRegion?.contains(x, y, inside) ?? false; },
    prepareWarmup() { group.visible = true; },
    get animating() { return timeline.animating; },
    get emphasis() { return planEmphasis(timeline.progress); },
    /** Temporarily render an exterior image without advancing/resetting hover. */
    withExterior<T>(draw: () => T): T {
      const active=uniforms.planActive.value, depth=uniforms.planDepthStrength.value, visible=group.visible;
      uniforms.planActive.value=0;uniforms.planDepthStrength.value=0;group.visible=false;
      try { return draw(); }
      finally { uniforms.planActive.value=active;uniforms.planDepthStrength.value=depth;group.visible=visible; }
    },
    eligible: planEligible,
    detailTop(p: BrickRecord) { return isSectionRelief(p) ? p.position[1]+p.size[1]/2+(p.studs ? .18 : 0) : -1000; },
    setRevealed(revealed: boolean, now: number, reduced: boolean) { return timeline.setRevealed(revealed, now, reduced); },
    reset() { timeline.reset(); uniforms.planActive.value = 0; uniforms.planDepthStrength.value=0; group.visible = false; previous = -1; },
    update(now: number) {
      timeline.update(now);
      const progress = timeline.progress;
      uniforms.planActive.value = progress > 0 ? 1 : 0;
      uniforms.planDepthStrength.value=planEmphasis(progress);
      group.visible = progress > 0;
      if (progress === previous) return;
      previous = progress;
      uniforms.planHeight.value = planCutHeight(progress);
      const t=Math.max(0,Math.min(1,PLAN_CUT_HEIGHT+1-uniforms.planHeight.value));
      edgeAmount.value=t*t*(3-2*t);
      const next=progress===1?warmGeometry:capGeometry(progress>0?planFaces(solids,uniforms.planHeight.value):[]);
      if(caps.geometry!==warmGeometry)caps.geometry.dispose();
      caps.geometry=next;
    },
    patchShader(shader: Shader) {
      Object.assign(shader.uniforms, uniforms);
      Object.assign(shader.uniforms,{planFloorColor:{value:new Color(INTERIOR_FLOOR)},planThresholdColor:{value:new Color(INTERIOR_THRESHOLD)}});
      shader.vertexShader = 'attribute float planEligible; attribute float planDetailTop; varying float vPlanDetailTop; varying float vPlanEligible; varying float vPlanY; varying vec2 vPlanXZ; varying vec3 vPlanNormal;\n' + shader.vertexShader;
      // Parts have rigid Y rotations only; the raw geometry normal is also valid
      // in the depth program, which does not declare a lit objectNormal.
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', 'vPlanDetailTop = planDetailTop; vPlanEligible = planEligible; vec3 planPosition = (instanceMatrix * vec4(transformed, 1.0)).xyz; vPlanY = planPosition.y; vPlanXZ=planPosition.xz; vPlanNormal=normalize(mat3(instanceMatrix)*normal);\n#include <project_vertex>');
      shader.fragmentShader = 'uniform float planActive; uniform float planHeight; uniform float planDepthStrength; uniform vec3 planFloorColor; uniform vec3 planThresholdColor; varying float vPlanDetailTop; varying float vPlanEligible; varying float vPlanY; varying vec2 vPlanXZ; varying vec3 vPlanNormal;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (planActive > .5 && (vPlanDetailTop > planHeight || (vPlanEligible > .5 && vPlanY > planHeight))) discard;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float planInteriorFill=0.0;
        if(planDepthStrength>0.0){
          ${interiorShader}
          diffuseColor.rgb=mix(diffuseColor.rgb,planFloorColor,planFloor*${INTERIOR_FLOOR_MIX.toFixed(2)}*planDepthStrength);
          diffuseColor.rgb=mix(diffuseColor.rgb,planThresholdColor,planThreshold*${INTERIOR_THRESHOLD_MIX.toFixed(2)}*planDepthStrength);
          if(vPlanNormal.y>.9){${contactShader}}
          planInteriorFill=(planFloor*.035+planThreshold*.025+planWallFill*.08)*planDepthStrength;
        }`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*planInteriorFill;');
    },
    dispose() { if(caps.geometry!==warmGeometry)caps.geometry.dispose();warmGeometry.dispose();material.dispose();edgeTexture.dispose(); },
  };
}

export type PlanViewFactory = typeof createPlanView;
