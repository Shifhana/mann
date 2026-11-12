export type Vec3 = [number, number, number];
export type MaterialRole = 'sandstone' | 'honey' | 'toasted' | 'brown';
export type PartShape = 'box' | 'slope' | 'barrel' | 'cylinder' | 'cone' | 'dome' | 'pot';
export type SectionMembership = 'retained' | 'near-side' | 'crossing';
export type StructuralRole = 'foundation' | 'floor' | 'wall' | 'roof' | 'detail' | 'sacred';

/** One addressable, rigid LEGO-style piece. Studs belong to their parent piece. */
export interface BrickRecord {
  id: string;
  catalogueId: string | null;
  shape: PartShape;
  size: Vec3;
  position: Vec3;
  rotationY: number;
  studs: boolean;
  material: MaterialRole;
  group: string;
  structuralRole: StructuralRole;
  assemblyStage: number;
  section: SectionMembership;
}

export interface Chamber {
  name: string;
  center: [number, number];
  clearSize: [number, number];
  floorY: number;
  ceilingY: number;
  entrance: 'east' | 'west';
}

export interface TempleDefinition {
  pieces: BrickRecord[];
  chambers: Chamber[];
  sectionPath: { fromX: number; toX: number; z: number }[];
}
