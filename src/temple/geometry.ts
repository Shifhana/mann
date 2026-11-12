import {
  BufferGeometry, CylinderGeometry, Float32BufferAttribute, LatheGeometry,
  Vector2,
} from 'three';
import { indexExactGeometry } from './indexed-geometry.ts';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BrickRecord } from './types.ts';

const geometryCache = new Map<string, BufferGeometry>();
export const geometryKey = (p: BrickRecord) => `${p.shape}:${p.size.map(v=>v.toFixed(3)).join(',')}:${p.studs}`;

function slope(w: number, h: number, d: number): BufferGeometry {
  // The eave rises toward local -Z (the temple), with a vertical rear face.
  const vertices = [
    [-w/2,-h/2,-d/2], [w/2,-h/2,-d/2], [w/2,-h/2,d/2], [-w/2,-h/2,d/2],
    [-w/2,h/2,-d/2], [w/2,h/2,-d/2],
    [-w/2,h/2,-d/2+.8], [w/2,h/2,-d/2+.8],
    [-w/2,-h/2+.4,d/2], [w/2,-h/2+.4,d/2],
  ];
  const faces = [0,2,1,0,3,2,0,1,5,0,5,4,4,5,7,4,7,6,
    6,7,9,6,9,8,3,8,9,3,9,2,0,4,6,0,6,8,0,8,3,1,2,9,1,9,7,1,7,5];
  const positions = faces.flatMap(i => vertices[i]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Array(faces.length * 2).fill(0), 2));
  g.computeVertexNormals();
  return g;
}

function barrel(w: number, h: number, d: number): BufferGeometry {
  // Rounded gable roof; deliberately architectural, not an arched doorway.
  const positions: number[] = [], uvs: number[] = [];
  const triangle = (a: number[], b: number[], c: number[]) => {
    positions.push(...a, ...b, ...c); uvs.push(0,0,1,0,0,1);
  };
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI, b = (i + 1) / 12 * Math.PI;
    const p = [Math.cos(a) * w/2, Math.sin(a) * h - h/2];
    const q = [Math.cos(b) * w/2, Math.sin(b) * h - h/2];
    triangle([p[0],p[1],d/2], [q[0],q[1],d/2], [0,-h/2,d/2]);
    triangle([q[0],q[1],-d/2], [p[0],p[1],-d/2], [0,-h/2,-d/2]);
    triangle([p[0],p[1],-d/2], [q[0],q[1],-d/2], [q[0],q[1],d/2]);
    triangle([p[0],p[1],-d/2], [q[0],q[1],d/2], [p[0],p[1],d/2]);
  }
  triangle([-w/2,-h/2,-d/2], [w/2,-h/2,-d/2], [w/2,-h/2,d/2]);
  triangle([-w/2,-h/2,-d/2], [w/2,-h/2,d/2], [-w/2,-h/2,d/2]);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

export function partGeometry(p: BrickRecord): BufferGeometry {
  const key = geometryKey(p), existing = geometryCache.get(key);
  if (existing) return existing;
  const [width, height, depth] = p.size;
  const w = width - .045, h = height - .025, d = depth - .045;
  let body: BufferGeometry;
  switch (p.shape) {
    case 'box': body = new RoundedBoxGeometry(w, h, d, 1, Math.min(.035, h / 5, w / 6, d / 6)); break;
    case 'slope': body = slope(w, h, d); break;
    case 'barrel': body = barrel(w, h, d); break;
    case 'cylinder': body = new CylinderGeometry(w / 2, w / 2, h, 16); break;
    case 'cone': body = new CylinderGeometry(.025, w / 2, h, 12); break;
    case 'dome': {
      const r = w / 2;
      body = new LatheGeometry([
        new Vector2(0, -h/2), new Vector2(r * .94, -h/2),
        new Vector2(r, -h * .35), new Vector2(r * .94, -h * .05),
        new Vector2(r * .76, h * .25), new Vector2(r * .4, h * .45),
        new Vector2(0, h / 2),
      ], 8, Math.PI / 8);
      break;
    }
    case 'pot': {
      const r = w / 2;
      body = new LatheGeometry([
        new Vector2(0, -h/2), new Vector2(r * .55, -h/2),
        new Vector2(r * .9, -h * .3), new Vector2(r, -h * .05),
        new Vector2(r * .8, h * .28), new Vector2(r * .4, h/2), new Vector2(0, h/2),
      ], 12);
      break;
    }
  }
  if (body.index) body = body.toNonIndexed();
  if (p.studs && ['box','slope','cylinder'].includes(p.shape)) {
    const components = [body];
    const nx = Math.max(1, Math.floor(width + .01)), nz = Math.max(1, Math.floor(p.shape === 'slope' ? 1 : depth + .01));
    for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      // The stud's bottom is buried inside its parent body. Omit that invisible cap.
      const cylinder = new CylinderGeometry(.3, .3, .18, 8);
      const indices = Array.from(cylinder.index!.array);
      cylinder.setIndex(cylinder.groups.filter(g=>g.materialIndex!==2)
        .flatMap(g=>indices.slice(g.start,g.start+g.count)));
      cylinder.clearGroups();
      const stud = cylinder.toNonIndexed(); cylinder.dispose();
      stud.translate(ix - (nx - 1) / 2, height / 2 + .08, iz - (nz - 1) / 2 + (p.shape === 'slope' ? -.5 : 0));
      components.push(stud);
    }
    body = mergeGeometries(components)!;
    components.forEach(c => c.dispose());
  }
  body=indexExactGeometry(body);
  body.computeBoundingBox();
  body.computeBoundingSphere();
  geometryCache.set(key, body);
  return body;
}

export function disposeGeometries() {
  geometryCache.forEach(g => g.dispose());
  geometryCache.clear();
}
