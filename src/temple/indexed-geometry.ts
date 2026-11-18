import { BufferGeometry, Float32BufferAttribute } from 'three';

/** Reuse only bit-identical Float32 vertex records; triangle order and surfaces stay intact. */
export function indexExactGeometry(geometry: BufferGeometry) {
  if (geometry.index) return geometry;
  const attributes = Object.entries(geometry.attributes);
  if (attributes.some(([, a]) => !(a.array instanceof Float32Array))) throw Error('Expected static Float32 part geometry');
  const count = geometry.getAttribute('position').count;
  const unique = new Map<string, number>(), indices: number[] = [];
  const values = attributes.map(() => [] as number[]);

  for (let vertex = 0; vertex < count; vertex++) {
    let key = '';
    // Include every attribute so sharp normals and UV seams remain separate.
    // Preserve signed zero rather than rounding or welding nearby coordinates.
    for (const [, attribute] of attributes) for (let c = 0; c < attribute.itemSize; c++) {
      const v = attribute.array[vertex * attribute.itemSize + c];
      key += (Object.is(v, -0) ? '-0' : String(v)) + ',';
    }
    let index = unique.get(key);
    if (index === undefined) {
      index = unique.size;
      unique.set(key, index);
      attributes.forEach(([, a], j) => {
        for (let c = 0; c < a.itemSize; c++) values[j].push(a.array[vertex * a.itemSize + c]);
      });
    }
    indices.push(index);
  }

  attributes.forEach(([name, a], j) => geometry.setAttribute(name, new Float32BufferAttribute(values[j], a.itemSize, a.normalized)));
  geometry.setIndex(indices);
  return geometry;
}
