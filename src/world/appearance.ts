import type { AgentStatus } from '../types';

// Original office avatars; colors describe the artwork, not a real person's identity.
import { visualTheme } from './visualTheme';
function hash(value: string) {
  let h = 0;
  for (const c of value) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
}

export type AvatarStyle = 0 | 1 | 2 | 3;
export interface AvatarIdentity {
  connectionId: string;
  paneId: string;
  terminalId: string;
}

/** Identify an office occupant by connection, pane and terminal. */
export function avatarIdentityKey(identity: AvatarIdentity): string {
  return JSON.stringify([identity.connectionId, identity.paneId, identity.terminalId]);
}

function styleOrder(key: string): number {
  // Mix adjacent pane IDs so the female/male artwork is spread around the floor.
  let value = hash(key + ':avatar');
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

/** Allocate artwork only for supplied live agents. Styles 2/3 are the female
 * models; 0/1 are male. A fresh roster has ceil(N/2) female models. Retained
 * occupants keep their styles, and newcomers restore balance when possible.
 * Removal alone can leave an imbalance: stability takes precedence over
 * changing the appearances of surviving occupants. Gone identities are pruned. */
export function allocateAvatarStyles(
  identities: readonly AvatarIdentity[],
  existing: ReadonlyMap<string, AvatarStyle> = new Map(),
): Map<string, AvatarStyle> {
  const keys = [...new Set(identities.map(avatarIdentityKey))];
  keys.sort((a, b) => styleOrder(a) - styleOrder(b) || (a < b ? -1 : a > b ? 1 : 0));
  const assignments = new Map<string, AvatarStyle>();
  const counts = [0, 0, 0, 0];
  for (const key of keys) {
    const style = existing.get(key);
    if (style !== undefined && [0, 1, 2, 3].includes(style)) {
      assignments.set(key, style);
      counts[style]++;
    }
  }
  const femaleTarget = Math.ceil(keys.length / 2);
  for (const key of keys) {
    if (assignments.has(key)) continue;
    const first: AvatarStyle = counts[2] + counts[3] < femaleTarget ? 2 : 0;
    const second = (first + 1) as AvatarStyle;
    const style = counts[first] < counts[second] ? first
      : counts[second] < counts[first] ? second
        : hash(key + ':variant') % 2 === 0 ? first : second;
    assignments.set(key, style);
    counts[style]++;
  }
  return assignments;
}

export function avatarAppearance(identity: string, slot = 0, department = identity) {
  return {
    skin: visualTheme.avatarSkin[(hash(department + ':skin') + slot) % visualTheme.avatarSkin.length],
    hair: visualTheme.avatarHair[(hash(department + ':hair') + slot * 5) % visualTheme.avatarHair.length],
    shirt: visualTheme.avatarShirt[(hash(department + ':shirt') + slot) % visualTheme.avatarShirt.length],
    style: (hash(department + ':style') + slot) % 4,
  };
}
export function agentPose(status: AgentStatus): 'seated' | 'standing' {
  return status === 'blocked' ? 'standing' : 'seated';
}
