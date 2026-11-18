import { OrthographicCamera, Vector3 } from 'three';
import type { BrickRecord } from './types.ts';

/** A separate, generously fitted exterior camera. Never mutates the live camera. */
export function postcardCamera(source: OrthographicCamera, pieces: BrickRecord[], aspect: number) {
  const camera = source.clone();
  camera.clearViewOffset(); camera.zoom = 1; camera.updateMatrixWorld(true);
  const point = new Vector3(), view = camera.matrixWorldInverse.elements;
  let left=Infinity, right=-Infinity, bottom=Infinity, top=-Infinity;
  for (const p of pieces) {
    const c=Math.cos(p.rotationY), s=Math.sin(p.rotationY), [w,h,d]=p.size;
    point.fromArray(p.position).applyMatrix4(camera.matrixWorldInverse);
    const x=Math.abs(view[0]*c-view[8]*s)*w/2+Math.abs(view[4])*(h/2+.2)+Math.abs(view[0]*s+view[8]*c)*d/2;
    const y=Math.abs(view[1]*c-view[9]*s)*w/2+Math.abs(view[5])*(h/2+.2)+Math.abs(view[1]*s+view[9]*c)*d/2;
    left=Math.min(left,point.x-x);right=Math.max(right,point.x+x);
    bottom=Math.min(bottom,point.y-y);top=Math.max(top,point.y+y);
  }
  const rightAxis=new Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  const upAxis=new Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  camera.position.add(rightAxis.multiplyScalar((left+right)/2)).add(upAxis.multiplyScalar((bottom+top)/2));
  const height=Math.max((top-bottom)*1.35,(right-left)*1.35/aspect);
  // Balance the long sun shadow within the export's tightly framed artwork.
  camera.position.add(new Vector3().setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar(height*aspect*.025));
  camera.left=-height*aspect/2;camera.right=height*aspect/2;
  camera.top=height/2;camera.bottom=-height/2;
  camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
  return camera;
}
