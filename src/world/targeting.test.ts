import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { gazePane } from './targeting';

function target(paneId: string, x: number, z: number) {
  const parent = new THREE.Group();
  parent.userData.paneId = paneId;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.4, .8, .4));
  mesh.position.set(x, 1.6, z);
  parent.add(mesh);
  return parent;
}
function camera() {
  const result = new THREE.PerspectiveCamera(68, 1, .07, 350);
  result.position.set(0, 1.6, 0);
  return result;
}

test('gaze selects a farther agent in sight instead of a closer off-axis agent', () => {
  const closer = target('closer', .9, -1.2), lookedAt = target('looked-at', 0, -2.7);
  assert.equal(gazePane(camera(), [closer, lookedAt], new THREE.Raycaster()), 'looked-at');
});

test('looking away or beyond reach never falls back to a nearby agent', () => {
  const nearby = target('nearby', .9, -1.2), distant = target('distant', 0, -4);
  assert.equal(gazePane(camera(), [nearby, distant], new THREE.Raycaster()), undefined);
});

test('hidden avatar poses are ignored, including an invisible mesh child', () => {
  const hiddenPose = target('hidden-pose', 0, -1), hiddenChild = target('hidden-child', 0, -1.5);
  hiddenPose.visible = false;
  hiddenChild.children[0].visible = false;
  assert.equal(gazePane(camera(), [hiddenPose, hiddenChild, target('visible', 0, -2)], new THREE.Raycaster()), 'visible');
});

test('changing the gaze immediately changes the selected agent without a render', () => {
  const eye = camera(), targets = [target('left', -.8, -2), target('right', .8, -2)];
  eye.lookAt(-.8, 1.6, -2);
  assert.equal(gazePane(eye, targets, new THREE.Raycaster()), 'left');
  eye.lookAt(.8, 1.6, -2);
  assert.equal(gazePane(eye, targets, new THREE.Raycaster()), 'right');
});
