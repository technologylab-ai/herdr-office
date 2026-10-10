export const WALK_SPEED = 6;
export const RUN_SPEED = 14;
export interface GroundPoint { x: number; z: number }
export interface Obstacle extends GroundPoint { w: number; d: number }
export interface WalkableFloor { width: number; depth: number }

export function canStandAt(point: GroundPoint, floor: WalkableFloor, obstacles: readonly Obstacle[]) {
  const { x, z } = point;
  if (!Number.isFinite(x) || !Number.isFinite(z) || x < -floor.width / 2 + .5 ||
    x > floor.width / 2 - .5 || z < .8 || z > floor.depth - .7) return false;
  return !obstacles.some(b => Math.abs(x - b.x) < b.w / 2 + .24 && Math.abs(z - b.z) < b.d / 2 + .24);
}

/** Short steps prevent fast walking or a wheel burst from crossing thin partitions.
 * Resolve each axis separately so a glancing approach slides along furniture. */
export function moveOnFloor(start: GroundPoint, delta: GroundPoint, canOccupy: (point: GroundPoint) => boolean): GroundPoint {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.z)) return { ...start };
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / .10));
  const point = { ...start }, dx = delta.x / steps, dz = delta.z / steps;
  for (let i = 0; i < steps; i++) {
    if (canOccupy({ x: point.x + dx, z: point.z })) point.x += dx;
    if (canOccupy({ x: point.x, z: point.z + dz })) point.z += dz;
  }
  return point;
}

/** Scroll up approaches what you are looking at. Normalize lines/pages as well
 * as trackpad pixels; cap each event so large device deltas stay controllable. */
export function wheelTravel(delta: number, mode: number, pageHeight: number, fast: boolean) {
  if (!Number.isFinite(delta)) return 0;
  const pixels = delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
  return Math.max(-6, Math.min(6, -pixels * .025)) * (fast ? 2 : 1);
}
