import * as THREE from 'three';

export const DEPARTMENT_WALL_THICKNESS = .16;

/** Wall signs stay parallel to their wall face. A camera-facing sprite
 * rotates through its surface at oblique views and can show through inside. */
export function createWallPlaque(texture: THREE.Texture, width: number, wall: { x: number; y: number; z: number }, face: 'exterior' | 'interior') {
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true,
    depthTest: true, depthWrite: false, side: THREE.FrontSide });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 224 / 768), material);
  const direction = face === 'exterior' ? 1 : -1;
  // Give the interior capsule a little more clearance than the artwork board.
  const clearance = face === 'exterior' ? .02 : .03;
  plaque.position.set(wall.x, wall.y, wall.z + direction * (DEPARTMENT_WALL_THICKNESS / 2 + clearance));
  // PlaneGeometry faces +Z; the inside copy faces into the room, toward -Z.
  if (face === 'interior') plaque.rotation.y = Math.PI;
  return plaque;
}
