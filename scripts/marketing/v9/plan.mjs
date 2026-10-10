/** Opus 5.5 V9: a recognized Studio arrival and genuine continuous flight into the walking aisle. */
import * as accepted from '../v8/plan.mjs';

export const palette = structuredClone(accepted.palette);
export const glassDesign = structuredClone(accepted.glassDesign);
glassDesign.placementsByScene['studio-arrival'] = [112, 762, 780, 150];
const originalWalk = accepted.sequence.find(scene => scene.id === 'walk-card');
const bridge = [
  {
    id: 'floors-return-select', duration: 1.2, kind: 'footage', card: null,
    sourceFile: 'artifacts/marketing/v9/raw/floors-return-select.mp4',
    speedPolicy: 'Actual compact Build floor selector activation; cut to Studio on the real selection, no two-grid dissolve or fake menu.',
  },
  {
    id: 'studio-arrival', duration: 119 / 30, kind: 'card', action: true,
    card: { eyebrow: 'FLOORS', title: 'Back to Studio Mac', subtitle: "Now let's walk this floor.", footer: '' },
    animation: { enterDelaySeconds: .3, enterSeconds: .3, endSeconds: 3.4, exitSeconds: .4, textExitSeconds: .4, staggerSeconds: 0 },
    backgroundSource: 'artifacts/marketing/v9/raw/studio-arrival.mp4',
    backgroundRanges: [{ sourceFrames: [0, 119], outputFrames: 119 }],
    expectedNativeFloorHeader: 'Studio Mac',
    evidence: 'Actual stable huge Studio recognition for 2.802 seconds, then a 1.019-second real aiming drag in one uninterrupted capture. Split at the measured first wheel event; caption exits before descent.',
    speedPolicy: '1x real live game capture, continuous into studio-descent.',
  },
  {
    id: 'studio-descent', duration: 257 / 30, kind: 'footage', card: null,
    sourceFile: 'artifacts/marketing/v9/raw/studio-descent.mp4',
    evidence: 'The same uninterrupted capture continues with the actual 6.760-second native 3D wheel descent and 1.029-second gradual leveling, preserving the complete measured 0.818-second stationary handoff tail. Ground endpoint matches the accepted run within 2.83mm.',
    speedPolicy: 'Uncut native camera motion at 1x; no synthetic camera or silent teleport.',
  },
  {
    ...structuredClone(originalWalk), duration: 3.5, sourceDuration: 3.5, rawSourceDuration: 3.5,
    animation: { enterDelaySeconds: .6, enterSeconds: .3, endSeconds: 3.3, exitSeconds: .3, textExitSeconds: .3, staggerSeconds: 0 },
    backgroundSource: 'artifacts/marketing/v9/raw/walk-card.mp4',
    backgroundRanges: [{ sourceFrames: [0, 105], outputFrames: 105 }],
    evidence: 'Stable 1.68m Studio aisle at the exact accepted run-start pose. The Walk caption appears after the 0.5-second matched Eye-height handoff and exits before actual F/run.',
    speedPolicy: '1x real settled ground-level pose; native Eye height/mode handoff only is bridged with a matched 15-frame dissolve.',
  },
].map(scene => ({
  ...scene, sourceDuration: scene.duration, rawSourceDuration: scene.duration,
  ...(scene.kind === 'card' ? { glassMaskFile: `${scene.id}-glass-mask.png`, hudFile: `${scene.id}-hud.mov`, backgroundFile: `${scene.id}-bg.mp4` } : {}),
}));
delete bridge.find(scene => scene.id === 'walk-card').reuseFile;
const preserved = structuredClone(accepted.sequence).filter(scene => !['floors-return', 'walk-card'].includes(scene.id))
  .map(scene => scene.kind === 'card' ? { ...scene, reuseFile: `artifacts/marketing/v8/${scene.id}.mp4` } : scene);
const insertion = preserved.findIndex(scene => scene.id === 'floors-buildnode') + 1;
export const sequence = [...preserved.slice(0, insertion), ...bridge, ...preserved.slice(insertion)];
export const chapterDissolves = [
  ...structuredClone(accepted.chapterDissolves).filter(transition => !transition.between.includes('floors-return') && transition.between.join(':') !== 'floors-select:floors-buildnode'),
  { between: ['studio-descent', 'walk-card'], overlap: .5 },
];
export const disclosure = structuredClone(accepted.disclosure);
export const cursor = structuredClone(accepted.cursor);
export const totalDuration = sequence.reduce((sum, scene) => sum + scene.duration, 0)
  - chapterDissolves.reduce((sum, transition) => sum + transition.overlap, 0);
export const sourceDuration = sequence.reduce((sum, scene) => sum + (scene.rawSourceDuration || scene.duration), 0);
export const musicSourceStart = accepted.musicSourceStart;
export const musicSourceEnd = musicSourceStart + totalDuration;
export const demoLayout = accepted.demoLayout;
export const floorInventory = structuredClone(accepted.floorInventory);
export const motionReviewContract = {
  reviewMethod: 'Ordered timestamped temporal frames of the actual assembled result plus source camera traces. Review every new boundary and the full teaser context; do not claim continuous playback or audio listening.',
  continuousRawSegments: ['studio-arrival', 'studio-descent'],
  studioRecognitionSeconds: 2.8,
  matchedEyeHeightDissolveFrames: 15,
  acceptedRunPose: { x: -13.481749051983114, z: 30.90053943699028, height: 1.68, yaw: Math.PI, pitch: -Math.atan(.33 / 7) },
  requiredChecks: ['Actual selector cause precedes Studio caption', 'No brief Studio aerial flash', 'Continuous descent and level look', 'Only matched-height handoff blends poses', 'Walk caption starts after handoff', 'Exact ground pose joins accepted run', 'All remaining chapters form a coherent final sequence'],
};
