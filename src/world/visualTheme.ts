// The office palette, shared by the 3D scene (avatars, badges, rings) and the
// DOM chrome (CSS custom properties mirror these values; keep them in step).
//
// Avatars are original artwork. Colours describe the figure, never a real
// person. Lists are ordered for how appearance.ts indexes them per department:
// skin and shirt step by +1 per slot, hair by +5, so any four neighbouring
// slots get four clearly different values.
export const visualTheme = {
  // Fair to light-medium; slightly warm so they read under the wood-toned light.
  avatarSkin: ['#f6e0d0', '#eecab2', '#f3d6c3', '#e7bfa3', '#f8e6da', '#ebc5aa'],
  // Platinum, light brown, auburn, golden, dark brown, ash, brunette, strawberry.
  // With the +5 stride, slots 0–3 land on four tones that differ in both hue and depth.
  avatarHair: ['#e6d4a6', '#8a6142', '#9e4a2a', '#c99c55', '#3b2a20', '#b7a383', '#5c3f2c', '#c7855a'],
  // Office wardrobe: navy, oat, terracotta, sage, charcoal, chambray, burgundy, mustard.
  // Dark/light alternate so neighbouring desks never wear the same weight of colour.
  avatarShirt: ['#33476a', '#e3d6bd', '#b4603f', '#7e9a77', '#4a4f58', '#86a5c8', '#7b3946', '#d0a44a'],
  // Observed idle age, deliberately outside the status hues (amber working,
  // red needs-you, green done) and stepped in lightness as well as hue:
  // pale periwinkle (just idle) → iris (a while) → orchid (long, with a ring).
  idleColors: { fresh: '#c3cdf0', waiting: '#8f86ee', long: '#f08cc0' },
  // The user's bookmarked main agent: luminous aqua, the complement of the copper/wood warmth.
  mainAgent: '#5fdbe8',
};
