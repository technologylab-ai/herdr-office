/* Claude Opus 5.5 V4 editorial plan and transparent playful office HUD palette. */
export const palette = {
  "background": "#FFF3E2",
  "text": "#1E2A4A",
  "muted": "#7D6B5D",
  "accent": "#FF9A76",
  "secondary": "#2B3A67",
  "wood": "#C68B59",
  "fontTitle": "Avenir Next Heavy",
  "fontBody": "Avenir Next Medium",
  "fontMono": "SF Mono",
  "cornerRadius": "28px",
  "motion": {
    "enter": "360ms easeOutBack, rise24px, scale0.96→1, panel/text fade in",
    "exit": "240ms fade/down16px, clear6frames before scene end"
  },
  "motifs": [
    "Localized translucent cream HUD",
    "Navy text and peach outline",
    "Small angled header squircle",
    "Genuine office background remains visible"
  ],
  "why": "Localized cream/navy/peach animated HUD panels over genuine live office backgrounds. Outside the HUD is fully transparent. No full-frame cream or forest fades; actual game stays visible through and around each panel.",
  "cardBackground": "#FFF3E2"
};
export const hudDesign = {
  "overlayFormat": "{id}-hud.mov qtrle argb 1920x1080 30fps CFR, straight (unpremultiplied) alpha, full-range 0–255 sRGB. Frame counts: cover120 walk90 talk90 find90 needs60 work90 bookmark60 end180. Alpha must be 0 everywhere outside the cards; check the corners and the center on frames 0, mid and last.",
  "hud": {
    "panelFill": "#FFF3E2",
    "opacity": 0.78,
    "stroke": "2px #F2A07B @1.0",
    "radius": 28,
    "text": "navy #1D2B4F, padding 36, soft navy shadow 0.18 only under the card, optional 40px line icon",
    "fontSizes": {
      "title": "Avenir Heavy 88 (72–104 to fit)",
      "body": "Avenir Medium 34, line-height 1.2"
    }
  },
  "placements": {
    "cover": [
      460,
      96,
      1000,
      250
    ],
    "walk": [
      64,
      620,
      700,
      280
    ],
    "talk": [
      1076,
      640,
      780,
      270
    ],
    "find": [
      1176,
      656,
      680,
      250
    ],
    "needs": [
      64,
      660,
      720,
      240
    ],
    "work": [
      48,
      640,
      840,
      270
    ],
    "bookmark": [
      64,
      660,
      760,
      240
    ],
    "end": [
      64,
      560,
      820,
      340
    ],
    "rule": "[x,y,w,h]. Keep within y≥96 and y≤910. Check the first frame of each background; if a card overlaps a face, terminal or map, mirror its x."
  },
  "motion": "Enter 360ms: easeOutBack, rise 24px, scale 0.96→1, opacity 0→0.78. Icon pops once. Exit 240ms fade down, ending 6 frames before the clip ends. No loops.",
  "backgroundTransitions": "Hard cut at each ID boundary. No crossfades, no full-frame cream fades, no freeze frames, no teleports.",
  "cursor": {
    "height": 26,
    "clickCue": "Approved: a peach #F2A07B ring, 3px, starting at the real mouseDown coordinates only. Scale 0.6→1, alpha 0.7→0. Hidden during pointer lock.",
    "size": 32,
    "durationMs": 250
  },
  "backgroundContract": "{id}-bg.mp4 H.264 yuv420p BT.709 limited range, tagged, 1920x1080 30fps CFR, exact frame counts. Continuous live recording that starts after setup. Composite with ffmpeg overlay (straight alpha), then encode yuv420p BT.709."
};
export const sequence = [
  {
    "id": "cover",
    "duration": 4,
    "kind": "card",
    "card": {
      "eyebrow": "technologylab.ai",
      "title": "Herdr Office",
      "subtitle": "A 3D office for your Herdr sessions",
      "footer": "Demo · fictional, scripted output"
    },
    "action": "Localized translucent cream/navy HUD panel and text rise24px with a soft pop over360ms, then fade/drop over240ms, leaving the genuine game background visible. No illustrated props or opaque background.",
    "transitionRule": "Semi-transparent animated editorial HUD over stable genuine app footage. Setup is off-record; no opaque masks, freeze frames, or fake animated in-app travel.",
    "backgroundFile": "cover-bg.mp4",
    "overlayFile": "cover-hud.mov"
  },
  {
    "id": "campus",
    "duration": 9,
    "kind": "footage",
    "card": null,
    "action": "Producer macro: raise 65m, move back z−20, pitch down 49°, then wheel/drag until all 18 offices in 6 rows read clearly. Real pointer and a tiny fictional disclosure only.",
    "transitionRule": "Same-pose HUD/action boundaries are continuous cuts. Only specified viewpoint-change boundaries use six-frame editorial dissolves; no intermediate setup views.",
    "editorialFrames": [
      0,
      45
    ],
    "editorialNote": "Retain first45frames (1.5seconds) of the genuine9second source panorama; raw capture duration remains9. Foursecond cover already shows the campus. Trim only static hold."
  },
  {
    "id": "walk-card",
    "duration": 3,
    "kind": "card",
    "card": {
      "eyebrow": "01 · Walk",
      "title": "Walk the office.",
      "subtitle": "Shift+W to run. Mouse to look.",
      "footer": ""
    },
    "action": "Localized translucent cream/navy HUD panel and text rise24px with a soft pop over360ms, then fade/drop over240ms, leaving the genuine game background visible. No illustrated props or opaque background.",
    "transitionRule": "Semi-transparent animated editorial HUD over stable genuine app footage. Setup is off-record; no opaque masks, freeze frames, or fake animated in-app travel.",
    "backgroundFile": "walk-card-bg.mp4",
    "overlayFile": "walk-card-hud.mov"
  },
  {
    "id": "run",
    "duration": 18,
    "kind": "footage",
    "card": null,
    "action": "Real F/W/Shift run from x−13.333,z31 facing+Z, with occupied glass offices on BOTH sides; travel to z69.1, turn+X toward Basalt first department, turn+Z and physically walk inside toward the human. Measured targets, slow turns, natural walk-first pacing; no exterior empty floor.",
    "transitionRule": "Same-pose HUD/action boundaries are continuous cuts. Only specified viewpoint-change boundaries use six-frame editorial dissolves; no intermediate setup views."
  },
  {
    "id": "talk-card",
    "duration": 3,
    "kind": "card",
    "card": {
      "eyebrow": "02 · Talk",
      "title": "Talk to an agent",
      "subtitle": "Click any agent to see its output.",
      "footer": ""
    },
    "action": "Localized translucent cream/navy HUD panel and text rise24px with a soft pop over360ms, then fade/drop over240ms, leaving the genuine game background visible. No illustrated props or opaque background.",
    "transitionRule": "Semi-transparent animated editorial HUD over stable genuine app footage. Setup is off-record; no opaque masks, freeze frames, or fake animated in-app travel.",
    "backgroundFile": "talk-card-bg.mp4",
    "overlayFile": "talk-card-hud.mov"
  },
  {
    "id": "talk",
    "duration": 6,
    "kind": "footage",
    "card": null,
    "action": "Click the actual human (raycast). The terminal/prompt panel opens and the camera does not move.",
    "transitionRule": "Same-pose HUD/action boundaries are continuous cuts. Only specified viewpoint-change boundaries use six-frame editorial dissolves; no intermediate setup views."
  },
  {
    "id": "find-card",
    "duration": 3,
    "kind": "card",
    "card": {
      "eyebrow": "03 · Find",
      "title": "Find agents by task or project.",
      "subtitle": "Hover the map or search.",
      "footer": ""
    },
    "action": "Localized translucent cream/navy HUD panel and text rise24px with a soft pop over360ms, then fade/drop over240ms, leaving the genuine game background visible. No illustrated props or opaque background.",
    "transitionRule": "Semi-transparent animated editorial HUD over stable genuine app footage. Setup is off-record; no opaque masks, freeze frames, or fake animated in-app travel.",
    "backgroundFile": "find-card-bg.mp4",
    "overlayFile": "find-card-hud.mov"
  },
  {
    "id": "map",
    "duration": 5,
    "kind": "footage",
    "card": null,
    "action": "Large map of all 18 offices. Hover the blocked 'Migrate orders schema' agent, then select it.",
    "transitionRule": "Same-pose HUD/action boundaries are continuous cuts. Only specified viewpoint-change boundaries use six-frame editorial dissolves; no intermediate setup views."
  },
  {
    "id": "needs-card",
    "duration": 2,
    "kind": "card",
    "card": {
      "eyebrow": "03 · Find",
      "title": "Who needs you?",
      "subtitle": "",
      "footer": ""
    },
    "action": "Localized translucent cream/navy HUD panel and text rise24px with a soft pop over360ms, then fade/drop over240ms, leaving the genuine game background visible. No illustrated props or opaque background.",
    "transitionRule": "Semi-transparent animated editorial HUD over stable genuine app footage. Setup is off-record; no opaque masks, freeze frames, or fake animated in-app travel.",
    "backgroundFile": "needs-card-bg.mp4",
    "overlayFile": "needs-card-hud.mov"
  },
  {
    "id": "blocked",
    "duration": 5,
    "kind": "footage",
    "card": null,
    "action": "Stable front pose of the Migrate agent standing, shown as blocked. No permission is answered.",
    "transitionRule": "Same-pose HUD/action boundaries are continuous cuts. Only specified viewpoint-change boundaries use six-frame editorial dissolves; no intermediate setup views."
  },
  {
    "id": "roster",
    "duration": 6,
    "kind": "footage",
    "card": null,
    "action": "Roster search by project name, results narrow, release, select.",
    "transitionRule": "Same-pose HUD/action boundaries are continuous cuts. Only specified viewpoint-change boundaries use six-frame editorial dissolves; no intermediate setup views."
  },
  {
    "id": "work-card",
    "duration": 3,
    "kind": "card",
    "card": {
      "eyebrow": "04 · Work",
      "title": "Watch it work. Then steer.",
      "subtitle": "Prompt it when it's ready.",
      "footer": ""
    },
    "action": "Localized translucent cream/navy HUD panel and text rise24px with a soft pop over360ms, then fade/drop over240ms, leaving the genuine game background visible. No illustrated props or opaque background.",
    "transitionRule": "Semi-transparent animated editorial HUD over stable genuine app footage. Setup is off-record; no opaque masks, freeze frames, or fake animated in-app travel.",
    "backgroundFile": "work-card-bg.mp4",
    "overlayFile": "work-card-hud.mov"
  },
  {
    "id": "watch",
    "duration": 12.5,
    "kind": "footage",
    "card": null,
    "action": "Real panel resize to 960 / font 24. Output updates on ~1.5s polls: Reading → Comparing → Missing migration → Done.",
    "transitionRule": "Same-pose HUD/action boundaries are continuous cuts. Only specified viewpoint-change boundaries use six-frame editorial dissolves; no intermediate setup views."
  },
  {
    "id": "steer",
    "duration": 16.5,
    "kind": "footage",
    "card": null,
    "action": "Type 'Add migration and rollback notes first.' for real, then Send. Status goes Writing → Checking → Done.",
    "transitionRule": "Same-pose HUD/action boundaries are continuous cuts. Only specified viewpoint-change boundaries use six-frame editorial dissolves; no intermediate setup views."
  },
  {
    "id": "bookmark-card",
    "duration": 2,
    "kind": "card",
    "card": {
      "eyebrow": "05 · Bookmark",
      "title": "Star it. Jump back.",
      "subtitle": "Across floors.",
      "footer": ""
    },
    "action": "Localized translucent cream/navy HUD panel and text rise24px with a soft pop over360ms, then fade/drop over240ms, leaving the genuine game background visible. No illustrated props or opaque background.",
    "transitionRule": "Semi-transparent animated editorial HUD over stable genuine app footage. Setup is off-record; no opaque masks, freeze frames, or fake animated in-app travel.",
    "backgroundFile": "bookmark-card-bg.mp4",
    "overlayFile": "bookmark-card-hud.mov"
  },
  {
    "id": "bookmark",
    "duration": 9,
    "kind": "footage",
    "card": null,
    "action": "Star the selected agent 'Check release notes' on Studio Mac. Switch to Build Node (4 agents). Press the bookmark shortcut to return to 'Check release notes'. Never star the floor.",
    "transitionRule": "Show actual selected hero star, Build Node, then returned Check release notes/main star/Studio Mac panel held3s target(2s minimum). Six-frame editorial transitions only between settled floor/return views, no second rear/front correction flash."
  },
  {
    "id": "end",
    "duration": 6,
    "kind": "card",
    "card": {
      "eyebrow": "Runs locally with Herdr",
      "title": "Herdr Office",
      "subtitle": "github.com/technologylab-ai/herdr-office",
      "footer": "The demo runs without Herdr. Live sessions need Herdr. All agents and output shown are fictional and scripted."
    },
    "action": "Localized translucent cream/navy HUD panel and text rise24px with a soft pop over360ms, then fade/drop over240ms, leaving the genuine game background visible. No illustrated props or opaque background.",
    "transitionRule": "Semi-transparent animated editorial HUD over stable genuine app footage. Setup is off-record; no opaque masks, freeze frames, or fake animated in-app travel.",
    "backgroundFile": "end-bg.mp4",
    "overlayFile": "end-hud.mov"
  }
];
export const terminalFontSize = 24;
export const terminalPanelWidth = 960;
export const sourceDuration = 113;
export const editedSourceDuration = 105.5;
export const totalDuration = 105.1;
export const chapterDissolves = [{"from": "map", "to": "needs-card", "frames": 6, "seconds": 0.2}, {"from": "roster", "to": "work-card", "frames": 6, "seconds": 0.2}];
