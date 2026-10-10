import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canStandAt, moveOnFloor, wheelTravel } from './navigation';

test('fast movement cannot tunnel through a thin partition', () => {
  const floor = { width: 100, depth: 100 }, obstacles = [{ x: 0, z: 10, w: 20, d: .1 }];
  const result = moveOnFloor({ x: 0, z: 5 }, { x: 0, z: 14 }, p => canStandAt(p, floor, obstacles));
  assert.ok(result.z < 9.76 && result.z > 9.5);
});
test('diagonal movement slides along furniture and stays inside the floor', () => {
  const floor = { width: 20, depth: 20 }, obstacles = [{ x: 0, z: 10, w: 10, d: .1 }];
  const result = moveOnFloor({ x: 0, z: 9.5 }, { x: 3, z: 3 }, p => canStandAt(p, floor, obstacles));
  assert.ok(result.x > 2.9 && result.z < 9.76);
  const edge = moveOnFloor({ x: 9, z: 3 }, { x: 20, z: 0 }, p => canStandAt(p, floor, []));
  assert.ok(edge.x <= 9.5);
});
test('wheel devices agree on direction, modifiers and bounded distance', () => {
  assert.equal(wheelTravel(-120, 0, 800, false), 3);
  assert.equal(wheelTravel(120, 0, 800, false), -3);
  assert.ok(Math.abs(wheelTravel(-3, 1, 800, false) - 1.2) < 1e-10);
  assert.equal(wheelTravel(-120, 0, 800, true), 6);
  assert.equal(wheelTravel(-1, 2, 800, false), 6);
  assert.equal(wheelTravel(Infinity, 0, 800, false), 0);
});
