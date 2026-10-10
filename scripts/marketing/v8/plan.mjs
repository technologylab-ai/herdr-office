/** Opus 5.5 V8: preserve V7, replace only the secondary machine's three appearances with its compact campus floor. */
import * as accepted from '../v7/plan.mjs';

export const palette = structuredClone(accepted.palette);
export const glassDesign = structuredClone(accepted.glassDesign);
const changedBuildScenes = new Set(['floors-buildnode', 'floors-return', 'bookmark-floor-jump']);
export const sequence = structuredClone(accepted.sequence).map(scene => {
  if (scene.kind !== 'card') return scene;
  if (!changedBuildScenes.has(scene.id)) return { ...scene, reuseFile: `artifacts/marketing/v7/${scene.id}.mp4` };
  const updated = {
    ...scene,
    backgroundSource: `artifacts/marketing/v8/raw/${scene.id}.mp4`,
    backgroundRanges: [{ sourceFrames: [0, Math.round(scene.duration * 30)], outputFrames: Math.round(scene.duration * 30) }],
    evidence: scene.id === 'floors-return'
      ? 'Compact Build Node selector activation, then the unchanged accepted Studio Mac arrival plate.'
      : 'Live campus Build Node: Northstar API, Builds and Load Tests, four human agents. Native compact overview framing matches both visits.',
  };
  delete updated.reuseFile;
  return updated;
});
export const chapterDissolves = structuredClone(accepted.chapterDissolves);
export const disclosure = structuredClone(accepted.disclosure);
export const cursor = structuredClone(accepted.cursor);
export const totalDuration = accepted.totalDuration;
export const sourceDuration = accepted.sourceDuration;
export const musicSourceStart = accepted.musicSourceStart;
export const musicSourceEnd = accepted.musicSourceEnd;
export const demoLayout = 'campus';
export const floorInventory = {
  studio: { machine: 'Studio Mac', companies: 18, departments: 30, rows: 6, agents: 72 },
  build: { machine: 'Build Node', companies: 1, departments: 2, agents: 4 },
};
