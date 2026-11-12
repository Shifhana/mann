import { consolidatePieces, type ConsolidationMode } from './consolidate.ts';
import { CATALOGUE } from './catalogue.ts';
import type { BrickRecord, MaterialRole, PartShape, StructuralRole, TempleDefinition } from './types.ts';

// Dimensions are in stud pitches. One plate = .4; one brick = 1.2.
// +X is east, +Z is south. Plan offsets are intentional, not a symmetry error.
export const PLATE = 0.4;
export const BRICK = 1.2;
export const LAYOUT = {
  main: { x: 8, z: 2, width: 18, depth: 18, wall: 4, floor: 4, ceiling: 11.2 },
  secondary: { x: -22, z: -4, width: 10, depth: 10, wall: 3, floor: 3.6, ceiling: 9.6 },
  vishnu: { x: -13, z: 3, width: 8, depth: 14, wall: 2, floor: 2.8, ceiling: 7.6 },
} as const;

export const SECTION_PATH = [
  { fromX: -34, toX: -17, z: -4 },
  { fromX: -17, toX: -8, z: 3 },
  { fromX: -8, toX: 36, z: 2 },
] as const;

/** Conservative membership, including the jogs of the future stepped section. */
export function sectionMembership(x: number, z: number, width: number, depth: number): BrickRecord['section'] {
  const paths = SECTION_PATH.filter(p => x + width / 2 > p.fromX && x - width / 2 < p.toX);
  if (paths.every(p => z + depth / 2 <= p.z + 0.001)) return 'retained';
  if (paths.every(p => z - depth / 2 >= p.z - 0.001)) return 'near-side';
  return 'crossing';
}

type Footprint = (x: number, z: number) => boolean;
const rect = (x: number, z: number, w: number, d: number): Footprint =>
  (px, pz) => Math.abs(px - x) < w / 2 && Math.abs(pz - z) < d / 2;
const union = (...shapes: Footprint[]): Footprint => (x, z) => shapes.some(s => s(x, z));
const ring = (x: number, z: number, w: number, d: number, t: number): Footprint => {
  const outer = rect(x, z, w, d), inner = rect(x, z, w - t * 2, d - t * 2);
  return (px, pz) => outer(px, pz) && !inner(px, pz);
};

class ModelBuilder {
  pieces: BrickRecord[] = [];
  private serials = new Map<string, number>();

  part(shape: PartShape, x: number, y: number, z: number, w: number, h: number, d: number,
    material: MaterialRole, group: string, stage: number, role: StructuralRole = 'detail', studs = false, rotationY = 0) {
    // Standardise decorative masonry to reusable stud-grid elements.
    if (shape === 'box') {
      w = [1,2,3,4,6,8].reduce((a,b) => Math.abs(b-w)<Math.abs(a-w)?b:a);
      d = [1,2,4,6,8].reduce((a,b) => Math.abs(b-d)<Math.abs(a-d)?b:a);
      h = Math.max(.4, Math.round(h/.4)*.4);
      if (h > 1.21 || Math.abs(h-.8)<.01) {
        let remaining=h, base=y;
        while (remaining>.01) {
          const height=remaining>=1.19?1.2:.4;
          this.part(shape,x,base,z,w,height,d,material,group,stage,role,studs,rotationY);
          base+=height; remaining-=height;
        }
        return;
      }
    }
    let catalogueId: string | null = null;
    if (shape === 'box') {
      const candidates=CATALOGUE.filter(p=>Math.abs(p.size[1]-h)<.01 &&
        ((p.size[0]===w&&p.size[2]===d)||(p.size[0]===d&&p.size[2]===w)));
      const match=candidates.find(p=>p.studs===studs) ?? candidates[0];
      if (match) {
        catalogueId=match.id; studs=match.studs;
        if (w!==match.size[0]) { [w,d]=[d,w]; rotationY+=Math.PI/2; }
      }
    }
    if (shape === 'slope') {
      // 3039 / 3040b: one-brick-high 45-degree roof, two studs deep.
      w=w>=1.5?2:1; h=1.2; d=2; studs=true;
      catalogueId=w===2?'3039':'3040b';
    }
    if (shape === 'cylinder' || shape === 'pot' || shape === 'barrel') {
      shape='cylinder'; w=1; d=1; h=h>.6?1.2:.4; studs=true;
      catalogueId=h===1.2?'3062b':'6141';
    }
    if (shape === 'cone' && w>.5) {
      w=1;d=1;h=1.2;catalogueId='4589';
    }
    const index = this.serials.get(group) ?? 0;
    this.serials.set(group, index + 1);
    const c = Math.abs(Math.cos(rotationY)), s = Math.abs(Math.sin(rotationY));
    this.pieces.push({
      id: `${group}.${String(index).padStart(4, '0')}`, shape, catalogueId,
      size: [w, h, d], position: [x, y + h / 2, z], rotationY, studs,
      material, group, structuralRole: role, assemblyStage: stage,
      section: sectionMembership(x, z, w * c + d * s, d * c + w * s),
    });
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number,
    mat: MaterialRole, group: string, stage: number, role: StructuralRole = 'detail', studs = false, rotation = 0) {
    this.part('box', x, y, z, w, h, d, mat, group, stage, role, studs, rotation);
  }

  /** Greedy catalogue-backed courses; never cover a doorway or chamber void. */
  course(shape: Footprint, y: number, height: number, mat: MaterialRole, group: string, stage: number,
    role: StructuralRole, studs = false, rowDepth = 2) {
    const used = new Set<string>();
    for (let z = -24; z < 26; z++) for (let x = -34; x < 36; x++) {
      if (!shape(x + .5, z + .5) || used.has(`${x},${z}`)) continue;
      const covers = (w: number, d: number) => {
        for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) {
          if (!shape(x + dx + .5, z + dz + .5) || used.has(`${x + dx},${z + dz}`)) return false;
        }
        return true;
      };
      const isBrick=height>=1.19;
      const kind=isBrick?'brick':(!studs && role==='floor'?'tile':'plate');
      const candidates=CATALOGUE.filter(p=>p.kind===kind && p.size[2] <= (rowDepth===1?1:isBrick?2:8))
        .flatMap(p=>[[p.size[0],p.size[2]],[p.size[2],p.size[0]]])
        .sort((a,b)=>b[0]*b[1]-a[0]*a[1]);
      let width=1, depth=1;
      for (const [w,d] of candidates) {
        if(covers(w,d)) { width=w;depth=d;break; }
      }
      for (let dz = 0; dz < depth; dz++) for (let dx = 0; dx < width; dx++) used.add(`${x + dx},${z + dz}`);
      this.box(x + width / 2, y, z + depth / 2, width, height, depth, mat, group, stage, role, studs);
    }
  }

  band(x: number, y: number, z: number, w: number, d: number, height: number,
    thickness: number, mat: MaterialRole, group: string, stage: number, studs = false) {
    this.course(ring(x, z, w, d, thickness), y, height, mat, group, stage, 'roof', studs, 1);
  }

  // Local facade coordinates: tangential width on X, outward depth on Z.
  face(shape: PartShape, cx: number, cz: number, face: number, offset: number, radius: number,
    y: number, w: number, h: number, d: number, mat: MaterialRole, group: string, stage: number, studs = false) {
    const a = face * Math.PI / 2;
    this.part(shape, cx + Math.sin(a) * radius + Math.cos(a) * offset,
      y, cz + Math.cos(a) * radius - Math.sin(a) * offset,
      w, h, d, mat, group, stage, 'detail', studs, a);
  }
}

function foundation(b: ModelBuilder) {
  const plan: Footprint = (x, z) => {
    const inMain = x >= -10 && x < 33 && z >= -21 && z < 23;
    const inWest = x >= -31 && x < -10 && z >= -12 && z < 12;
    const corner = (x > 30 && (z < -18 || z > 20)) || (x < -28 && (z < -9 || z > 9));
    return (inMain || inWest) && !corner;
  };
  b.course(plan, 0, .4, 'brown', 'base.foot', 0, 'foundation');
  b.course(plan, .4, .4, 'toasted', 'base.edge', 1, 'foundation');
  b.course(plan, .8, .4, 'sandstone', 'base.upper', 2, 'foundation');
  b.course(plan, 1.2, .4, 'honey', 'base.paving', 3, 'floor');

  // Studs on the architectural base edge, not a field of studs across the court.
  const studRim: Footprint = (x, z) => plan(x, z) &&
    (!plan(x - 1, z) || !plan(x + 1, z) || !plan(x, z - 1) || !plan(x, z + 1));
  b.course(studRim, 1.6, .4, 'sandstone', 'base.stud-rim', 4, 'floor', true, 1);

  const mainPad = (w: number, d: number) => union(rect(8, 2, w, d), rect(23, 2, 10, 14));
  b.course(mainPad(30, 30), 1.6, .4, 'toasted', 'main.plinth-foot', 10, 'foundation');
  b.course(mainPad(28, 28), 2, .4, 'sandstone', 'main.plinth-lower', 11, 'foundation');
  b.course(mainPad(28, 28), 2.4, .4, 'sandstone', 'main.plinth-body', 12, 'foundation');
  b.course(mainPad(26, 26), 2.8, .4, 'honey', 'main.plinth-bead', 13, 'foundation');
  b.course(mainPad(28, 28), 3.2, .4, 'sandstone', 'main.plinth-cornice', 14, 'foundation');
  b.course(mainPad(28, 28), 3.6, .4, 'honey', 'main.plinth-paving', 15, 'floor');
  b.course(ring(8, 2, 28, 28, 1), 4, .4, 'sandstone', 'main.plinth-studs', 16, 'detail', true, 1);

  for (let i = 0; i < 5; i++) {
    b.course(rect(30 - i * .5, 2, i + 2, 6), 1.6 + i * .4, .4,
      i % 2 === 0 ? 'sandstone' : 'honey', 'main.steps', 15, 'foundation');
  }
  for (let i = 0; i < 5; i++) {
    const width = i === 0 ? 16 : i === 4 ? 16 : 14;
    b.course(rect(-22, -4, width, width), 1.6 + i * .4, .4,
      i === 0 ? 'toasted' : i === 4 ? 'honey' : 'sandstone', 'secondary.plinth', 10 + i, 'foundation');
  }
  b.course(ring(-22, -4, 16, 16, 1), 3.6, .4, 'sandstone', 'secondary.plinth-studs', 16, 'detail', true, 1);
  for (let i = 0; i < 4; i++) b.course(rect(-30 + i * .5, -4, i + 2, 4), 1.6 + i * .4, .4,
    'sandstone', 'secondary.steps', 14, 'foundation');

  for (let i = 0; i < 3; i++) b.course(rect(-13, 3, i === 0 ? 12 : 10, i === 0 ? 18 : 16),
    1.6 + i * .4, .4, i === 0 ? 'toasted' : 'sandstone', 'vishnu.plinth', 10 + i, 'foundation');
}

function shrineWalls(b: ModelBuilder, name: 'main' | 'secondary' | 'vishnu') {
  const s = LAYOUT[name];
  const innerW = s.width - s.wall * 2, innerD = s.depth - s.wall * 2;
  const courses = Math.round((s.ceiling - s.floor) / BRICK);
  for (let i = 0; i < courses; i++) {
    const outer = rect(s.x, s.z, s.width, s.depth), inner = rect(s.x, s.z, innerW, innerD);
    const shape: Footprint = (x, z) => {
      if (!outer(x, z) || inner(x, z)) return false;
      const inDoor = name === 'secondary' ? x < s.x && Math.abs(z - s.z) < 1.51 : x > s.x && Math.abs(z - s.z) < 2.01;
      if (i < (name === 'vishnu' ? 3 : 4) && inDoor) return false;
      // Recesses remove actual outer masonry, preserving the wall behind them.
      if (i > 0 && i < courses - 1 && name !== 'vishnu') {
        const nicheOffsets = name === 'main' ? [-5, 0, 5] : [0];
        if (Math.abs(x - s.x) > s.width / 2 - 1.01 && nicheOffsets.some(o => Math.abs(z - s.z - o) < 1)) return false;
        if (Math.abs(z - s.z) > s.depth / 2 - 1.01 && nicheOffsets.some(o => Math.abs(x - s.x - o) < 1)) return false;
      }
      return true;
    };
    b.course(shape, s.floor + i * BRICK, BRICK, 'sandstone', `${name}.wall`, 20 + i, 'wall', false, 1);
  }

  // Tile the chamber floor separately; roof mass is supported by the thick walls.
  b.course(rect(s.x, s.z, innerW, innerD), s.floor - .4, .4, 'honey', `${name}.floor`, 18, 'floor');
  b.course(rect(s.x, s.z, s.width, s.depth), s.ceiling, .4, 'toasted', `${name}.ceiling`, 39, 'roof');

  const baseRadius = s.width / 2;
  const faceCount = 4;
  for (let face = 0; face < faceCount; face++) {
    const radius = face % 2 === 0 ? s.depth / 2 : baseRadius;
    const span = face % 2 === 0 ? s.width : s.depth;
    const offsets = name === 'main' ? [-7, -3, 3, 7] : name === 'secondary' ? [-3.7, 3.7] : [-span / 2 + 1, span / 2 - 1];
    for (const offset of offsets) {
      const group = `${name}.pilasters`;
      b.face('box', s.x, s.z, face, offset, radius + .22, s.floor, 1.2, .4, .85, 'honey', group, 30);
      b.face('box', s.x, s.z, face, offset, radius + .17, s.floor + .4, .75, s.ceiling - s.floor - 1.2, .7, 'sandstone', group, 31);
      b.face('box', s.x, s.z, face, offset, radius + .24, s.ceiling - .8, 1.2, .4, .9, 'honey', group, 32);
      b.face('box', s.x, s.z, face, offset, radius + .22, s.ceiling - .4, 1.5, .4, 1, 'sandstone', group, 33);
    }
    if (name === 'vishnu') continue;
    const entryFace = name === 'main' ? 1 : 3;
    const niches = name === 'main' ? [-5, 0, 5] : [0];
    for (const offset of niches) {
      if (face === entryFace && Math.abs(offset) < 2) continue;
      const group = `${name}.niches`;
      b.face('box', s.x, s.z, face, offset, radius - .86, s.floor + 1.2, 1.65, 3.1, .16, 'toasted', group, 28);
      b.face('box', s.x, s.z, face, offset, radius - .35, s.floor + 1.1, 1.95, .4, 1, 'honey', group, 29);
      b.face('box', s.x, s.z, face, offset - 1, radius - .1, s.floor + 1.5, .35, 2.8, .65, 'sandstone', group, 30);
      b.face('box', s.x, s.z, face, offset + 1, radius - .1, s.floor + 1.5, .35, 2.8, .65, 'sandstone', group, 30);
      b.face('slope', s.x, s.z, face, offset, radius - .05, s.floor + 4.3, 2, .8, 1, 'sandstone', group, 32);
      // Restrained relief: a stepped vertical motif, kept within the niche.
      b.face('box', s.x, s.z, face, offset, radius - .67, s.floor + 1.65, .7, .4, .3, 'sandstone', group, 29);
      b.face('box', s.x, s.z, face, offset, radius - .66, s.floor + 2.05, .5, 1.2, .34, 'sandstone', group, 30);
      b.face('barrel', s.x, s.z, face, offset, radius - .64, s.floor + 3.25, .5, .4, .32, 'honey', group, 31);
    }
  }

  // Rectangular, nested stone door frames, not invented arched entrances.
  const face = name === 'secondary' ? 3 : 1;
  const doorWidth = name === 'secondary' ? 3 : 4;
  const doorHeight = name === 'vishnu' ? 3.6 : 4.8;
  for (const offset of [-doorWidth / 2 - .35, doorWidth / 2 + .35]) {
    b.face('box', s.x, s.z, face, offset, baseRadius + .15, s.floor, .7, doorHeight, .7, 'honey', `${name}.portal`, 31);
    b.face('box', s.x, s.z, face, offset + Math.sign(offset) * .5, baseRadius + .08, s.floor, .4, doorHeight + .4, .55, 'sandstone', `${name}.portal`, 31);
  }
  b.face('box', s.x, s.z, face, 0, baseRadius + .2, s.floor + doorHeight,
    doorWidth + 2.4, .4, 1, 'honey', `${name}.portal`, 33);
}

function cornice(b: ModelBuilder, x: number, z: number, y: number, width: number, depth: number, group: string, stage: number) {
  b.band(x, y, z, width, depth, .4, 1, 'toasted', group, stage);
  b.band(x, y + .4, z, width + 2, depth + 2, .4, 2, 'sandstone', group, stage + 1);
  b.band(x, y + .8, z, width + 2, depth + 2, .4, 1, 'honey', group, stage + 2, true);
}

function miniatureRoof(b: ModelBuilder, cx: number, cz: number, face: number, offset: number,
  radius: number, y: number, _size: number, group: string, stage: number, _corner: boolean) {
  // A reusable three-piece assembly: 1x2 plate, 1x1 brick, 2x2 roof slope.
  b.face('box', cx, cz, face, offset, radius, y, 2, .4, 1, 'sandstone', group, stage);
  b.face('box', cx, cz, face, offset, radius, y + .4, 1, 1.2, 1, 'sandstone', group, stage, true);
  b.face('slope', cx, cz, face, offset, radius, y + 1.6, 2, .8, 2, 'honey', group, stage + 1);
}

function tower(b: ModelBuilder, name: 'main' | 'secondary') {
  const s = LAYOUT[name], isMain = name === 'main';
  cornice(b, s.x, s.z, s.ceiling, s.width, s.depth, `${name}.body-cornice`, 40);
  const widths = isMain ? [19, 16, 13, 10, 7] : [11, 8, 5];
  const step = isMain ? 4 : 2.4;
  let y = s.ceiling + 1.2;
  widths.forEach((width, level) => {
    const stage = 50 + level * 10;
    const group = `${name}.tier-${level + 1}`;
    const bodyHeight = step - 1.2;
    b.course(rect(s.x, s.z, width - 2, width - 2), y, bodyHeight,
      'sandstone', `${group}.core`, stage, 'roof');
    b.band(s.x, y, s.z, width, width, .4, 1, 'toasted', `${group}.frieze`, stage);

    // Inward-sloping kapota eaves: small modules instead of a giant square slab.
    for (let face = 0; face < 4; face++) {
      const span = width - 2;
      for (let p = -span / 2 + 1; p < span / 2; p += 2) {
        b.face('slope', s.x, s.z, face, p, width / 2 - .6, y + bodyHeight,
          2, .8, 2, 'sandstone', `${group}.eaves`, stage + 2);
      }
      const count = width >= 10 ? 3 : 1;
      for (let n = 0; n < count; n++) {
        const offset = count === 1 ? 0 : (n / (count - 1) - .5) * (width - 3);
        miniatureRoof(b, s.x, s.z, face, offset, width / 2 - .7,
          y + .4, isMain ? 1.6 : 1.4, `${group}.aedicules`, stage + 1, n === 0 || n === count - 1);
      }

    }
    b.band(s.x, y + step - .4, s.z, width, width, .4, 1,
      'honey', `${group}.coping`, stage + 3, true);
    y += step;
  });

  const neck = isMain ? 4 : 3;
  b.course(rect(s.x, s.z, neck, neck), y, .8, 'sandstone', `${name}.neck`, 105, 'roof');
  b.band(s.x, y + .8, s.z, neck + 1, neck + 1, .4, 1, 'honey', `${name}.neck-coping`, 106);
  // The octagonal, domed Dravida cap is distinct from the stepped tower below it.
  const diameter = isMain ? 5 : 3.8, capHeight = isMain ? 2.6 : 2;
  b.part('dome', s.x, y + 1.2, s.z, diameter, capHeight, diameter,
    'sandstone', `${name}.octagonal-cap`, 110, 'roof');
  const capTop = y + 1.2 + capHeight;
  b.part('cylinder', s.x, capTop, s.z, isMain ? 1.2 : .9, .35, isMain ? 1.2 : .9, 'toasted', `${name}.finial`, 115);
  b.part('pot', s.x, capTop + .35, s.z, isMain ? 1.15 : .9, .8, isMain ? 1.15 : .9, 'honey', `${name}.finial`, 116);
  b.part('cone', s.x, capTop + 1.15, s.z, .65, isMain ? 1.3 : 1, .65, 'toasted', `${name}.finial`, 117);
}

function connectingRoof(b: ModelBuilder) {
  const s = LAYOUT.vishnu;
  cornice(b, s.x, s.z, s.ceiling, s.width, s.depth, 'vishnu.cornice', 40);
  b.course(rect(s.x, s.z, s.width, s.depth), s.ceiling + .4, .8,
    'sandstone', 'vishnu.roof-mass', 41, 'roof');
  b.course(rect(s.x, s.z, s.width - 2, s.depth - 2), s.ceiling + 1.2, .4,
    'honey', 'vishnu.roof-tiles', 43, 'roof');
  b.band(s.x, s.ceiling + 1.2, s.z, s.width + 2, s.depth + 2, .4, 1,
    'sandstone', 'vishnu.roof-edge', 43, true);

  // Low masonry junction to the northern shoulder of the main shrine.
  for (let i = 0; i < 4; i++) b.course(rect(-5, -2, 8, 2), 2.8 + i * 1.2, 1.2,
    'sandstone', 'vishnu.junction', 20 + i, 'wall');
  b.course(rect(-5, -2, 8, 4), 7.6, .4, 'honey', 'vishnu.junction-cap', 40, 'roof', true);
}

function entrancePorch(b: ModelBuilder) {
  // Compact east-facing vestibule. Its opening remains continuous with the sanctum.
  const footprint: Footprint = (x, z) => x >= 17 && x < 25 && z >= -3 && z < 7 &&
    (Math.abs(z - 2) >= 2 || (x >= 23 && Math.abs(z - 2) >= 2));
  for (let c = 0; c < 4; c++) b.course(footprint, 4 + c * 1.2, 1.2,
    'sandstone', 'main.vestibule-wall', 20 + c, 'wall', false, 1);
  for (const z of [-1, 5]) {
    b.box(24.6, 4, z, 1.2, .4, 1.4, 'honey', 'main.porch-pillars', 30);
    b.box(24.6, 4.4, z, .8, 4.4, .9, 'sandstone', 'main.porch-pillars', 31);
    b.box(24.6, 8.8, z, 1.5, .4, 1.7, 'honey', 'main.porch-pillars', 32);
  }
  b.course(rect(21, 2, 8, 10), 8.8, .4, 'toasted', 'main.vestibule-ceiling', 37, 'roof');
  b.course(rect(21, 2, 10, 12), 9.2, .4, 'sandstone', 'main.vestibule-cornice', 38, 'roof');
  b.course(rect(21, 2, 10, 12), 9.6, .4, 'honey', 'main.vestibule-roof', 39, 'roof');
  b.band(21, 10, 2, 10, 12, .4, 1, 'sandstone', 'main.vestibule-studs', 40, true);
}

function sacredInteriors(b: ModelBuilder) {
  for (const name of ['main', 'secondary'] as const) {
    const s = LAYOUT[name], scale = name === 'main' ? 1 : .65;
    const group = `${name}.lingam`;
    b.box(s.x, s.floor, s.z, 3 * scale, .4, 2.8 * scale, 'toasted', group, 27, 'sacred');
    b.part('cylinder', s.x, s.floor + .4, s.z, 2.5 * scale, .4, 2.5 * scale, 'brown', group, 28, 'sacred');
    b.box(s.x + 1.1 * scale, s.floor + .4, s.z, 1.3 * scale, .35, .6 * scale, 'brown', group, 28, 'sacred');
    b.part('cylinder', s.x, s.floor + .8, s.z, .9 * scale, 1.3 * scale, .9 * scale, 'brown', group, 29, 'sacred');
    b.part('dome', s.x, s.floor + .8 + 1.3 * scale, s.z, .9 * scale, .4 * scale, .9 * scale, 'brown', group, 30, 'sacred');
  }
  const s = LAYOUT.vishnu;
  b.box(s.x, s.floor, s.z, 2, .4, 8, 'toasted', 'vishnu.interior', 27, 'sacred');
  b.box(s.x, s.floor + .4, s.z - .1, 1.2, .65, 4.4, 'sandstone', 'vishnu.interior', 28, 'sacred');
  b.part('pot', s.x, s.floor + .4, s.z - 2.9, 1.25, .9, 1.25, 'honey', 'vishnu.interior', 28, 'sacred');
  b.box(s.x - .35, s.floor + .4, s.z + 2.9, .45, .4, 1.5, 'sandstone', 'vishnu.interior', 28, 'sacred');
  b.box(s.x + .35, s.floor + .4, s.z + 2.9, .45, .4, 1.5, 'sandstone', 'vishnu.interior', 28, 'sacred');
}

function nandi(b: ModelBuilder, x: number, z: number, y: number, facing: number) {
  const group = 'enclosure.nandi', angle = facing * Math.PI / 2;
  const local = (shape: PartShape, ox: number, oy: number, oz: number, w: number, h: number, d: number, mat: MaterialRole) =>
    b.part(shape, x + ox * Math.cos(angle) + oz * Math.sin(angle), y + oy,
      z - ox * Math.sin(angle) + oz * Math.cos(angle), w, h, d, mat, group, 35, 'detail', false, angle);
  local('box', 0, 0, 0, 1.5, .3, 2.4, 'honey');
  local('box', 0, .3, -.15, 1.2, .7, 1.65, 'sandstone');
  local('pot', 0, .5, .35, 1, .85, 1, 'sandstone');
  local('box', 0, .8, .95, .8, .55, .8, 'sandstone');
  local('box', 0, .85, 1.4, .85, .3, .4, 'honey');
  local('cone', -.32, 1.35, .93, .22, .45, .22, 'toasted');
  local('cone', .32, 1.35, .93, .22, .45, .22, 'toasted');
  local('box', -.68, 1.1, .85, .35, .2, .45, 'sandstone');
  local('box', .68, 1.1, .85, .35, .2, .45, 'sandstone');
}

function enclosure(b: ModelBuilder) {
  const walls: Footprint = union(
    rect(10, -17, 40, 2), rect(10, 21, 40, 2),
    rect(30, -10, 2, 12), rect(30, 14, 2, 12),
    rect(28, -17, 6, 4), rect(28, 21, 6, 4),
    rect(-9, -14, 2, 8), rect(-9, 18, 2, 8),
  );
  b.course(walls, 1.6, .4, 'toasted', 'enclosure.foot', 10, 'foundation');
  for (let c = 0; c < 2; c++) b.course(walls, 2 + c * 1.2, 1.2,
    'sandstone', 'enclosure.wall', 20 + c, 'wall', false, 1);
  b.course(walls, 4.4, .4, 'honey', 'enclosure.coping', 30, 'roof');
  for (const x of [-5, 1, 7, 13, 19, 25]) {
    nandi(b, x, -17, 4.8, 0);
    nandi(b, x, 21, 4.8, 2);
  }
  // Low entrance ends preserve the view of the main east-facing doorway.
  for (const z of [-4, 8]) {
    b.course(rect(30, z, 4, 4), 1.6, .4, 'toasted', 'enclosure.entry-foot', 10, 'foundation');
    for (let c = 0; c < 3; c++) b.course(rect(30, z, 2, 2), 2 + c * 1.2, 1.2,
      'sandstone', 'enclosure.entry-piers', 21 + c, 'wall');
    b.course(rect(30, z, 4, 4), 5.6, .4, 'honey', 'enclosure.entry-caps', 31, 'roof', true);
  }
}

export function createTempleDefinition(mode: ConsolidationMode | 'benchmark' = 'balanced'): TempleDefinition {
  const b = new ModelBuilder();
  foundation(b);
  shrineWalls(b, 'main');
  shrineWalls(b, 'secondary');
  shrineWalls(b, 'vishnu');
  connectingRoof(b);
  entrancePorch(b);
  sacredInteriors(b);
  tower(b, 'main');
  tower(b, 'secondary');
  enclosure(b);
  return {
    pieces: mode === 'benchmark' ? b.pieces : consolidatePieces(b.pieces, mode, sectionMembership).pieces,
    chambers: (['main', 'secondary', 'vishnu'] as const).map(name => {
      const s = LAYOUT[name];
      return { name, center: [s.x, s.z], clearSize: [s.width - s.wall * 2, s.depth - s.wall * 2],
        floorY: s.floor, ceilingY: s.ceiling, entrance: name === 'secondary' ? 'west' : 'east' };
    }),
    sectionPath: SECTION_PATH.map(p => ({ ...p })),
  };
}
