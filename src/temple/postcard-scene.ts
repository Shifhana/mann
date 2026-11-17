import { DirectionalLight, InstancedMesh, Material, Mesh, Object3D, Scene } from 'three';
import { createCoastalLandscape } from './coastal-preview.ts';

/** Finished exterior snapshot. Geometry/textures are shared read-only; mutable
 * materials, instance buffers, lights and scenery belong to this capture only. */
export function createPostcardScene(source: Scene, exclude: ReadonlySet<Object3D>) {
  const materials = new Map<Material, Material>();
  const cloneMaterial = (material: Material) => {
    let copy = materials.get(material);
    if (!copy) {
      // Material.clone intentionally drops onBeforeCompile: no build clock or
      // plan clipping is carried into the completed exterior photograph.
      copy = material.clone();
      materials.set(material, copy);
    }
    return copy;
  };
  const clone = (object: Object3D): Object3D => {
    const copy = object.clone(false);
    if (copy instanceof Mesh) {
      copy.material = Array.isArray(copy.material) ? copy.material.map(cloneMaterial) : cloneMaterial(copy.material);
    }
    for (const child of object.children) if (!exclude.has(child)) copy.add(clone(child));
    return copy;
  };
  const scene = clone(source) as Scene;
  // Scene.clone clones environment textures. Reuse the existing immutable map
  // instead of allocating another PMREM or texture for every download.
  scene.environment = source.environment;
  scene.background = source.background;
  const coast = createCoastalLandscape();
  coast.setReveal(1);
  scene.add(coast.group);
  return {
    scene,
    dispose() {
      coast.dispose();
      scene.traverse(object => {
        if (object instanceof InstancedMesh) object.dispose();
        if (object instanceof DirectionalLight) object.shadow.dispose();
      });
      materials.forEach(material => material.dispose());
      scene.clear();
    },
  };
}
