import * as THREE from 'three';

export const INTERACTION_REACH = 3.2;

function visiblePane(object: THREE.Object3D): string | undefined {
  let paneId: string | undefined;
  for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
    if (!ancestor.visible) return;
    paneId ??= ancestor.userData.paneId;
  }
  return paneId;
}

/** Pick actual visible geometry along a ray, never a nearby off-axis desk. */
export function paneAlongRay(raycaster: THREE.Raycaster, clickables: THREE.Object3D[]): string | undefined {
  // Raycaster does not exclude invisible parents; a hidden avatar pose must not
  // intercept its visible counterpart or a neighbouring desk.
  const visible = clickables.filter(object => {
    for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
      if (!ancestor.visible) return false;
    }
    object.updateWorldMatrix(true, true);
    return true;
  });
  for (const hit of raycaster.intersectObjects(visible, true)) {
    const paneId = visiblePane(hit.object);
    if (paneId) return paneId;
  }
}

export function gazePane(
  camera: THREE.PerspectiveCamera,
  clickables: THREE.Object3D[],
  raycaster: THREE.Raycaster,
): string | undefined {
  camera.updateMatrixWorld();
  raycaster.near = 0;
  raycaster.far = INTERACTION_REACH;
  raycaster.setFromCamera(CENTER, camera);
  return paneAlongRay(raycaster, clickables);
}

const CENTER = new THREE.Vector2(0, 0);
