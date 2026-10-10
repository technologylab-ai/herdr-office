import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocateAvatarStyles, avatarIdentityKey, type AvatarIdentity, type AvatarStyle } from './appearance';

function roster(count: number, connectionId = 'local:test-only'): AvatarIdentity[] {
  return Array.from({ length: count }, (_, index) => ({ connectionId, paneId: `w1:p${index}`, terminalId: `test-terminal-${index}` }));
}
const femaleCount = (styles: ReadonlyMap<string, AvatarStyle>) => [...styles.values()].filter(style => style >= 2).length;

test('fresh small and large agent rosters have half female artwork, with odd counts rounded up', () => {
  for (const size of [0, 1, 2, 3, 4, 7, 11, 16, 99, 100]) {
    const identities = roster(size), styles = allocateAvatarStyles(identities);
    assert.equal(styles.size, size);
    assert.equal(femaleCount(styles), Math.ceil(size / 2));
    assert.deepEqual(new Set(styles.keys()), new Set(identities.map(avatarIdentityKey)));
  }
  assert.deepEqual(new Set(allocateAvatarStyles(roster(4)).values()), new Set([0, 1, 2, 3]));
});

test('styles are deterministic under snapshot reordering and live status changes', () => {
  const identities = roster(11);
  const original = allocateAvatarStyles(identities);
  const shuffled = [identities[7], identities[2], identities[10], identities[0], identities[9], identities[4], identities[8], identities[1], identities[6], identities[3], identities[5]];
  assert.deepEqual(allocateAvatarStyles(shuffled), original);
  const changedStatus = identities.map((identity, index) => ({ ...identity, agent_status: index % 2 ? 'working' : 'idle', title: 'A new task caption' }));
  assert.deepEqual(allocateAvatarStyles(changedStatus), original);
});

test('new agents fill the gender and style deficits without changing any retained appearance', () => {
  const identities = roster(12), previous = allocateAvatarStyles(identities.slice(0, 4));
  const before = [...previous];
  const expanded = allocateAvatarStyles(identities, previous);
  for (const [key, style] of previous) assert.equal(expanded.get(key), style);
  assert.deepEqual([...previous], before, 'The caller-owned cache must not be mutated.');
  assert.equal(femaleCount(expanded), 6);
  for (const style of [0, 1, 2, 3] as const) assert.equal([...expanded.values()].filter(value => value === style).length, 3);
});

test('removing agents prunes absent identities and preserves every survivor even when that leaves an imbalance', () => {
  const identities = roster(8), previous = allocateAvatarStyles(identities);
  const survivors = identities.filter(identity => previous.get(avatarIdentityKey(identity))! < 2);
  const reduced = allocateAvatarStyles(survivors, previous);
  assert.equal(reduced.size, 4);
  assert.equal(femaleCount(reduced), 0);
  for (const identity of survivors) assert.equal(reduced.get(avatarIdentityKey(identity)), previous.get(avatarIdentityKey(identity)));
  const additions = roster(4, 'ssh:test-newcomers');
  const restored = allocateAvatarStyles([...survivors, ...additions], reduced);
  assert.equal(femaleCount(restored), 4);
  for (const identity of survivors) assert.equal(restored.get(avatarIdentityKey(identity)), reduced.get(avatarIdentityKey(identity)));
});

test('connection, pane and terminal all participate in identity and delimiter-like IDs cannot collide', () => {
  const identities: AvatarIdentity[] = [
    { connectionId: 'a:b', paneId: 'c', terminalId: 'd' },
    { connectionId: 'a', paneId: 'b:c', terminalId: 'd' },
    { connectionId: 'a:b', paneId: 'c', terminalId: 'new-terminal' },
    { connectionId: 'other-floor', paneId: 'c', terminalId: 'd' },
  ];
  assert.equal(new Set(identities.map(avatarIdentityKey)).size, 4);
  const old = new Map<string, AvatarStyle>([[avatarIdentityKey(identities[0]), 3]]);
  const replacement = allocateAvatarStyles([identities[2]], old);
  assert.equal(replacement.has(avatarIdentityKey(identities[0])), false);
  assert.deepEqual([...replacement], [...allocateAvatarStyles([identities[2]])]);
});

test('duplicate snapshot identities never create extra assignments or change the balance', () => {
  const identities = roster(7);
  assert.deepEqual(allocateAvatarStyles([...identities, identities[0], identities[3]]), allocateAvatarStyles(identities));
});

test('historical styles from other floors do not influence current balance and reappearing occupants keep their style', () => {
  const firstFloor = roster(8), secondFloor = roster(6, 'ssh:test-second-floor');
  const history = allocateAvatarStyles(firstFloor);
  const secondStyles = allocateAvatarStyles(secondFloor, history);
  assert.equal(femaleCount(secondStyles), 3);
  assert.equal(secondStyles.size, secondFloor.length);
  for (const [key, style] of secondStyles) history.set(key, style);
  const returning = allocateAvatarStyles(firstFloor, history);
  assert.deepEqual(returning, allocateAvatarStyles(firstFloor));
  assert.equal(femaleCount(returning), 4);
  assert.equal(history.size, 14, 'Historical caching remains under caller control.');
});
