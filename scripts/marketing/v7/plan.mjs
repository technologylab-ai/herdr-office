/** Opus 5.5 adds one machines/floors chapter; accepted V6 visuals and actions are reused. */
import * as accepted from '../v6/plan.mjs';

export const palette = structuredClone(accepted.palette);
export const glassDesign = structuredClone(accepted.glassDesign);
Object.assign(glassDesign.placementsByScene, {
  'floors-card': [112, 652, 820, 280],
  'floors-select': [112, 762, 780, 150],
  'floors-buildnode': [112, 762, 780, 150],
  'floors-return': [112, 762, 780, 150],
});

const chapter = [
  {
    id: 'floors-card', duration: 2.5, action: false,
    card: { eyebrow: 'FLOORS', title: 'One machine. One floor.',
      subtitle: 'Your session is the building. Each machine gets its floor.', footer: '' },
    expectedNativeFloorHeader: 'Studio Mac',
    evidence: 'Settled live huge Studio Mac floor; no main-agent bookmark or terminal work has happened yet.',
  },
  {
    id: 'floors-select', duration: 2.5, action: true,
    card: { eyebrow: 'FLOORS', title: 'Pick a machine',
      subtitle: 'The floor selector switches to Build Node.', footer: '' },
    expectedNativeFloorHeader: 'Studio Mac',
    evidence: 'Real native Floor-selector activation. Actual selection follows at the editorial cut; the next settled plate proves Build Node.',
  },
  {
    id: 'floors-buildnode', duration: 2.5, action: true,
    card: { eyebrow: 'FLOORS', title: 'New machine, new floor',
      subtitle: "Build Node's agents live here. Same building.", footer: '' },
    expectedNativeFloorHeader: 'Build Node',
    evidence: 'Settled live huge Build Node floor with the native machine label visible and no main-agent bookmark.',
  },
  {
    id: 'floors-return', duration: 1.5, action: true,
    card: { eyebrow: 'FLOORS', title: 'Back to Studio Mac',
      subtitle: "Now let's walk this floor.", footer: '' },
    expectedNativeFloorHeader: 'Build Node → Studio Mac',
    evidence: 'Real Floor-selector activation and an editorial arrival at the huge Studio Mac floor before the already accepted walking chapter.',
  },
].map(scene => ({
  ...scene, kind: 'card', sourceDuration: scene.duration, rawSourceDuration: scene.duration,
  backgroundSource: `artifacts/marketing/v7/raw/${scene.id}.mp4`,
  backgroundRanges: [{ sourceFrames: [0, Math.round(scene.duration * 30)], outputFrames: Math.round(scene.duration * 30) }],
  glassMaskFile: `${scene.id}-glass-mask.png`, hudFile: `${scene.id}-hud.mov`, backgroundFile: `${scene.id}-bg.mp4`,
  animation: scene.action ? structuredClone(glassDesign.shortActionAnimation) : undefined,
  speedPolicy: 'Real app footage at 1x. The caption explains the visible machine/floor action; setup camera motion is excluded.',
}));

export const sequence = structuredClone(accepted.sequence).map(scene => scene.kind === 'card'
  ? { ...scene, reuseFile: `artifacts/marketing/v6/${scene.id}.mp4` }
  : scene);
sequence.splice(sequence.findIndex(scene => scene.id === 'campus') + 1, 0, ...chapter);

export const chapterDissolves = [
  ...structuredClone(accepted.chapterDissolves),
  { between: ['campus', 'floors-card'], overlap: .2 },
  { between: ['floors-select', 'floors-buildnode'], overlap: .2 },
  { between: ['floors-return', 'walk-card'], overlap: .2 },
];
export const disclosure = structuredClone(accepted.disclosure);
export const cursor = structuredClone(accepted.cursor);
export const totalDuration = sequence.reduce((sum, scene) => sum + scene.duration, 0)
  - chapterDissolves.reduce((sum, transition) => sum + transition.overlap, 0);
export const sourceDuration = sequence.reduce((sum, scene) => sum + (scene.rawSourceDuration || scene.duration), 0);
export const musicSourceStart = accepted.musicSourceStart;
export const musicSourceEnd = musicSourceStart + totalDuration;
