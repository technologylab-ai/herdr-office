import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWallPlaque, DEPARTMENT_WALL_THICKNESS } from './signage';

test('rear plaque remains wholly outside the wall at frontal, oblique and elevated camera angles', () => {
  const wall = { x: 3, y: 2.3, z: 12 };
  const plaque = createWallPlaque(new THREE.Texture(), 5.4, wall, 'exterior');
  const positions = plaque.geometry.getAttribute('position');
  for (const eye of [[3, 2.3, 16], [8, 1.68, 14], [-2, 4, 14]]) {
    const camera = new THREE.PerspectiveCamera(); camera.position.set(...eye as [number, number, number]);
    camera.lookAt(plaque.position); camera.updateMatrixWorld(); plaque.updateMatrixWorld();
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(plaque.matrixWorld);
      assert.ok(vertex.z > wall.z + DEPARTMENT_WALL_THICKNESS / 2, 'Every corner must clear the wall, regardless of the view.');
      assert.equal(vertex.z, plaque.position.z, 'The sign must stay flat against the wall.');
    }
  }
  assert.equal(plaque.material.depthTest, true, 'Other offices must still occlude this sign.');
});

test('rear plaque faces exterior viewers and cannot bleed through to viewers inside the room', () => {
  const plaque = createWallPlaque(new THREE.Texture(), 5.4, { x: 0, y: 2.3, z: 12 }, 'exterior');
  plaque.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  for (const eye of [new THREE.Vector3(0, 2.3, 16), new THREE.Vector3(5, 1.68, 14)]) {
    ray.set(eye, plaque.position.clone().sub(eye).normalize());
    assert.ok(ray.intersectObject(plaque).length > 0, 'The complete outward face must be visible.');
  }
  const inside = new THREE.Vector3(0, 1.68, 8);
  ray.set(inside, plaque.position.clone().sub(inside).normalize());
  assert.equal(ray.intersectObject(plaque).length, 0, 'No backwards-facing sign may show inside.');
});

test('inside copy faces into the room, clears the interior wall, and uses the same readable texture', () => {
  const texture = new THREE.Texture(), wall = { x: 0, y: 2.7, z: 12 };
  const inside = createWallPlaque(texture, 3.2, wall, 'interior');
  const outside = createWallPlaque(texture, 5.4, wall, 'exterior');
  inside.updateMatrixWorld(); outside.updateMatrixWorld();
  assert.equal(inside.material.map, outside.material.map);
  const positions = inside.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(inside.matrixWorld);
    assert.ok(vertex.z < wall.z - DEPARTMENT_WALL_THICKNESS / 2);
  }
  const eye = new THREE.Vector3(-4, 1.68, 8), ray = new THREE.Raycaster(eye, inside.position.clone().sub(eye).normalize());
  assert.ok(ray.intersectObject(inside).length > 0, 'Interior viewers must see the interior sign.');
  assert.equal(ray.intersectObject(outside).length, 0, 'The exterior copy must stay hidden from inside.');
  const rear = new THREE.Vector3(0, 2.3, 16);
  ray.set(rear, inside.position.clone().sub(rear).normalize());
  assert.equal(ray.intersectObject(inside).length, 0, 'The interior copy must stay hidden from outside.');
});
