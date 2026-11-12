import { pieceBounds } from './consolidate.ts';
import { geometryKey } from './geometry.ts';
import type { BrickRecord, MaterialRole } from './types.ts';

// Match the approved renderer's material creation order at coincident faces.
const priority: Record<MaterialRole, number> = { sandstone: 0, honey: 1, toasted: 2, brown: 3 };
const EPS = .001;

/** Batch colours together only when their coplanar-face ordering can be preserved. */
export function planBatches(pieces: BrickRecord[]) {
  const records = pieces.map(p => ({ p, key: geometryKey(p), bounds: pieceBounds(p), rank: priority[p.material] }));
  const constraints: [number, number][] = [];
  const graph = new Map<string, Set<string>>();
  for (const r of records) if (!graph.has(r.key)) graph.set(r.key, new Set());

  for (let i = 0; i < records.length; i++) for (let j = 0; j < i; j++) {
    const a = records[i], b = records[j];
    if (a.rank === b.rank) continue;
    if (a.bounds.min.some((v, k) => v >= b.bounds.max[k] - EPS || a.bounds.max[k] <= b.bounds.min[k] + EPS)) continue;
    if (!a.bounds.min.some((v, k) => Math.abs(v - b.bounds.min[k]) < EPS || Math.abs(a.bounds.max[k] - b.bounds.max[k]) < EPS)) continue;
    const [lo, hi] = a.rank < b.rank ? [i, j] : [j, i];
    constraints.push([lo, hi]);
    if (records[lo].key !== records[hi].key) graph.get(records[lo].key)!.add(records[hi].key);
  }

  // Tarjan's strongly connected components identify geometry sets that cannot
  // share one cross-colour draw without changing at least one visible face.
  const split = new Set<string>();
  const index = new Map<string, number>(), low = new Map<string, number>();
  const stack: string[] = [], active = new Set<string>();
  let next = 0;
  function visit(key: string) {
    index.set(key, next);
    low.set(key, next++);
    stack.push(key);
    active.add(key);
    for (const to of graph.get(key)!) {
      if (!index.has(to)) {
        visit(to);
        low.set(key, Math.min(low.get(key)!, low.get(to)!));
      } else if (active.has(to)) {
        low.set(key, Math.min(low.get(key)!, index.get(to)!));
      }
    }
    if (low.get(key) === index.get(key)) {
      const component: string[] = [];
      let item: string;
      do {
        item = stack.pop()!;
        active.delete(item);
        component.push(item);
      } while (item !== key);
      if (component.length > 1) component.forEach(k => split.add(k));
    }
  }
  for (const key of graph.keys()) if (!index.has(key)) visit(key);

  const keyFor = (r: typeof records[number]) => r.key + (split.has(r.key) ? ':' + r.p.material : '');
  const batches = new Map<string, BrickRecord[]>();
  const edges = new Map<string, Set<string>>(), indegree = new Map<string, number>();
  for (const r of records) {
    const key = keyFor(r), batch = batches.get(key) ?? [];
    batch.push(r.p);
    batches.set(key, batch);
    if (!edges.has(key)) {
      edges.set(key, new Set());
      indegree.set(key, 0);
    }
  }
  for (const [lo, hi] of constraints) {
    const a = keyFor(records[lo]), b = keyFor(records[hi]);
    if (a !== b && !edges.get(a)!.has(b)) {
      edges.get(a)!.add(b);
      indegree.set(b, indegree.get(b)! + 1);
    }
  }

  // Set explicit renderOrder values; Three.js must not reorder coplanar draws.
  const queue = [...batches.keys()].filter(k => indegree.get(k) === 0);
  const order = new Map<string, number>();
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i];
    order.set(key, i);
    for (const to of edges.get(key)!) {
      indegree.set(to, indegree.get(to)! - 1);
      if (indegree.get(to) === 0) queue.push(to);
    }
  }
  if (order.size !== batches.size) throw Error('Unresolved coplanar material order');
  for (const batch of batches.values()) batch.sort((a, b) => priority[a.material] - priority[b.material]);
  return { batches, order, split };
}
