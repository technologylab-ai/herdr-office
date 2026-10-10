/** Claude Opus 5.5 V6: contrast-backed original pink glass and explanations during actual actions. */
export const palette = {
  "tint": "#101113",
  "tintOpacity": 0.4,
  "text": "#F8F9FA",
  "muted": "rgba(248,249,250,.90)",
  "accent": "#FF5A7A",
  "borderHighlight": "#FFFFFF",
  "borderOpacity": 0.24,
  "fontTitle": "SF Pro Display",
  "fontBody": "SF Pro Text",
  "titleWeight": 400,
  "titleSize": 64,
  "bodySize": 26,
  "eyebrow": "18px, weight 600, tracking 0.16em, uppercase, accent; only accent use besides cursor ring",
  "subtitleWeight": 500,
  "chapterTint": "linear-gradient(90deg, rgba(16,17,19,.42) 0%, rgba(16,17,19,.40) 60%, rgba(16,17,19,.30) 100%)",
  "actionTint": "linear-gradient(90deg, rgba(16,17,19,.46) 0%, rgba(16,17,19,.42) 60%, rgba(16,17,19,.34) 100%)",
  "textShadow": "0 1px 2px rgba(0,0,0,.62), 0 0 1px rgba(0,0,0,.40), 0 0 14px rgba(0,0,0,.34)",
  "eyebrowTextShadow": "0 1px 1px rgba(0,0,0,.45)",
  "eyebrowChipFill": "rgba(12,13,15,0.75)",
  "eyebrowChipBorder": "1px solid rgba(255,90,122,0.45)",
  "subtitle": "rgba(248,249,250,.96)",
  "footer": "rgba(248,249,250,.90)",
  "chapterEyebrowSize": 16,
  "actionEyebrowSize": 13,
  "chapterSubtitleSize": 26,
  "actionSubtitleSize": 21,
  "actionTitleSize": 32,
  "actionTitleWeight": 500
};
export const glassDesign = {
  "blurSigma": 22,
  "radius": 28,
  "saturate": 1.05,
  "rim": "1px inner stroke white @0.24; top-edge specular white 0.5→0 across first 40% width; inner top sheen white 0.06→0 over 30% height; optional shadow 0 16px 40px rgba(0,0,0,0.16)",
  "placementsByScene": {
    "cover": [
      480,
      300,
      960,
      260
    ],
    "walk-card": [
      112,
      652,
      820,
      280
    ],
    "talk-card": [
      988,
      652,
      820,
      280
    ],
    "map-card": [
      112,
      652,
      820,
      280
    ],
    "needs-card": [
      112,
      608,
      860,
      316
    ],
    "search-card": [
      112,
      608,
      820,
      316
    ],
    "work-card": [
      112,
      652,
      820,
      250
    ],
    "bookmark-card": [
      112,
      608,
      820,
      316
    ],
    "end": [
      480,
      320,
      960,
      400
    ],
    "map": [
      112,
      762,
      780,
      150
    ],
    "roster": [
      112,
      762,
      780,
      150
    ],
    "bookmark-star-switch": [
      112,
      762,
      780,
      150
    ],
    "bookmark-floor-jump": [
      112,
      762,
      780,
      150
    ],
    "bookmark-return": [
      112,
      762,
      780,
      150
    ]
  },
  "maskPolicy": "Static rounded alpha mask per scene. Root blurs and darkens only the real live game underneath the animated glass, then composites tint/rim/text. Every action HUD persists through the real interaction.",
  "enter": "Panel opacity 0→1 over 0.35s easeOutCubic. Text fades in and slides up 12px, staggered eyebrow/title/subtitle/footer at 0.08s steps",
  "exit": "Text fades over 0.25s, then the panel fades over 0.30s, ending exactly at the scene cut",
  "tint": "#101113",
  "tintOpacity": 0.4,
  "border": "#FFFFFF",
  "borderOpacity": 0.24,
  "text": "#F6F7F9",
  "accent": "#FF5A7A",
  "backdropBrightness": 0.88,
  "blurBrightness": 0.88,
  "actionRadius": 20,
  "enterSeconds": 0.35,
  "exitSeconds": 0.3,
  "textExitSeconds": 0.55,
  "staggerSeconds": 0.08,
  "shortActionAnimation": {
    "enterSeconds": 0.2,
    "exitSeconds": 0.1,
    "textExitSeconds": 0.1,
    "staggerSeconds": 0.04
  }
};
export const sequence = [
  {
    "id": "cover",
    "duration": 3,
    "sourceDuration": 3,
    "kind": "card",
    "card": {
      "eyebrow": "HERDR OFFICE",
      "title": "An office for your agents",
      "subtitle": "See who's working and who needs you.",
      "footer": ""
    },
    "speedPolicy": "Live campus plate at 1x",
    "rawSourceDuration": 3,
    "glassMaskFile": "cover-glass-mask.png",
    "hudFile": "cover-hud.mov",
    "backgroundFile": "cover-bg.mp4",
    "backgroundSource": "artifacts/marketing/v5/cover-bg.mp4"
  },
  {
    "id": "campus",
    "duration": 1.5,
    "sourceDuration": 1.5,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x",
    "rawSourceDuration": 1.5,
    "sourceFile": "artifacts/marketing/v5/campus.mp4"
  },
  {
    "id": "walk-card",
    "duration": 2.5,
    "sourceDuration": 2.5,
    "kind": "card",
    "card": {
      "eyebrow": "01 · WALK",
      "title": "Walk the floor",
      "subtitle": "Shift+W to run. Mouse to look.",
      "footer": ""
    },
    "speedPolicy": "Live pre-roll of run at 1x",
    "rawSourceDuration": 2.5,
    "glassMaskFile": "walk-card-glass-mask.png",
    "hudFile": "walk-card-hud.mov",
    "backgroundFile": "walk-card-bg.mp4",
    "backgroundSource": "artifacts/marketing/v5/walk-card-bg.mp4"
  },
  {
    "id": "run",
    "duration": 18,
    "sourceDuration": 18,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x, approved busy cut",
    "rawSourceDuration": 18,
    "sourceFile": "artifacts/marketing/v5/run.mp4"
  },
  {
    "id": "talk-card",
    "duration": 2.5,
    "sourceDuration": 2.5,
    "kind": "card",
    "card": {
      "eyebrow": "02 · TALK",
      "title": "Talk to an agent",
      "subtitle": "Walk up. Click. Talk.",
      "footer": ""
    },
    "speedPolicy": "Live pre-roll at 1x",
    "rawSourceDuration": 2.5,
    "glassMaskFile": "talk-card-glass-mask.png",
    "hudFile": "talk-card-hud.mov",
    "backgroundFile": "talk-card-bg.mp4",
    "backgroundSource": "artifacts/marketing/v5/talk-card-bg.mp4"
  },
  {
    "id": "talk",
    "duration": 5,
    "sourceDuration": 5,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x, direct click, camera unchanged",
    "rawSourceDuration": 5,
    "sourceFile": "artifacts/marketing/v5/talk.mp4"
  },
  {
    "id": "map-card",
    "duration": 3,
    "sourceDuration": 3,
    "kind": "card",
    "card": {
      "eyebrow": "03 · MAP",
      "title": "The floor map",
      "subtitle": "Every desk on this floor at a glance.",
      "footer": ""
    },
    "speedPolicy": "Live office plate before the map opens, 1x",
    "rawSourceDuration": 3,
    "glassMaskFile": "map-card-glass-mask.png",
    "hudFile": "map-card-hud.mov",
    "backgroundFile": "map-card-bg.mp4",
    "backgroundSource": "artifacts/marketing/v5/map-card-bg.mp4"
  },
  {
    "id": "map",
    "duration": 2.2,
    "sourceDuration": 2.2,
    "rawSourceDuration": 5,
    "kind": "card",
    "action": true,
    "card": {
      "eyebrow": "Map",
      "title": "Hover a dot.",
      "subtitle": "Click to visit an agent.",
      "footer": ""
    },
    "animation": {
      "enterSeconds": 0.2,
      "exitSeconds": 0.1,
      "textExitSeconds": 0.1,
      "staggerSeconds": 0.04
    },
    "backgroundSource": "artifacts/marketing/v5/map.mp4",
    "backgroundRanges": [
      {
        "sourceFrames": [
          0,
          48
        ],
        "outputFrames": 48
      },
      {
        "sourceFrames": [
          132,
          150
        ],
        "outputFrames": 18
      }
    ],
    "glassMaskFile": "map-glass-mask.png",
    "hudFile": "map-hud.mov",
    "backgroundFile": "map-bg.mp4",
    "speedPolicy": "Actual app interaction at 1x; explanatory glass stays over the action."
  },
  {
    "id": "needs-card",
    "duration": 3.5,
    "sourceDuration": 3.5,
    "kind": "card",
    "card": {
      "eyebrow": "04 · WHO NEEDS YOU",
      "title": "Needs your input",
      "subtitle": "Agents needing your input stand beside their desks.",
      "footer": ""
    },
    "speedPolicy": "Live pre-roll at 1x",
    "rawSourceDuration": 3.5,
    "glassMaskFile": "needs-card-glass-mask.png",
    "hudFile": "needs-card-hud.mov",
    "backgroundFile": "needs-card-bg.mp4",
    "backgroundSource": "artifacts/marketing/v5/needs-card-bg.mp4"
  },
  {
    "id": "blocked",
    "duration": 4,
    "sourceDuration": 4,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x",
    "rawSourceDuration": 4,
    "sourceFile": "artifacts/marketing/v5/blocked.mp4"
  },
  {
    "id": "search-card",
    "duration": 3,
    "sourceDuration": 3,
    "kind": "card",
    "card": {
      "eyebrow": "05 · SEARCH",
      "title": "Find an agent",
      "subtitle": "Search by task or project.",
      "footer": "Current floor only."
    },
    "speedPolicy": "Live pre-roll at 1x",
    "rawSourceDuration": 3,
    "glassMaskFile": "search-card-glass-mask.png",
    "hudFile": "search-card-hud.mov",
    "backgroundFile": "search-card-bg.mp4",
    "backgroundSource": "artifacts/marketing/v5/search-card-bg.mp4"
  },
  {
    "id": "roster",
    "duration": 2.2,
    "sourceDuration": 2.2,
    "rawSourceDuration": 6,
    "kind": "card",
    "action": true,
    "card": {
      "eyebrow": "Search",
      "title": "Search by task.",
      "subtitle": "Click a result.",
      "footer": ""
    },
    "animation": {
      "enterSeconds": 0.2,
      "exitSeconds": 0.1,
      "textExitSeconds": 0.1,
      "staggerSeconds": 0.04
    },
    "backgroundSource": "artifacts/marketing/v5/roster.mp4",
    "backgroundRanges": [
      {
        "sourceFrames": [
          0,
          48
        ],
        "outputFrames": 48
      },
      {
        "sourceFrames": [
          162,
          180
        ],
        "outputFrames": 18
      }
    ],
    "glassMaskFile": "roster-glass-mask.png",
    "hudFile": "roster-hud.mov",
    "backgroundFile": "roster-bg.mp4",
    "speedPolicy": "Actual app interaction at 1x; explanatory glass stays over the action."
  },
  {
    "id": "work-card",
    "duration": 2.5,
    "sourceDuration": 2.5,
    "kind": "card",
    "card": {
      "eyebrow": "06 · WORK",
      "title": "Watch and steer",
      "subtitle": "Read its terminal. Send the next prompt.",
      "footer": ""
    },
    "speedPolicy": "Live terminal-side plate at 1x",
    "rawSourceDuration": 2.5,
    "glassMaskFile": "work-card-glass-mask.png",
    "hudFile": "work-card-hud.mov",
    "backgroundFile": "work-card-bg.mp4",
    "backgroundSource": "artifacts/marketing/v5/work-card-bg.mp4"
  },
  {
    "id": "watch",
    "duration": 4,
    "sourceDuration": 12.5,
    "kind": "footage",
    "card": null,
    "speedPolicy": "Source0–6.6 at6x→1.1s;6.6–7.8 at1x→1.2s visibleMissing;7.8–12.5 at2.7647x→1.7s. Exact120outputframes. Source/data remain genuine and time-compressed disclosed.",
    "rawSourceDuration": 12.5,
    "editorialSpeedRanges": [
      {
        "sourceFrames": [
          0,
          198
        ],
        "outputFrames": 33,
        "speed": 6
      },
      {
        "sourceFrames": [
          198,
          234
        ],
        "outputFrames": 36,
        "speed": 1
      },
      {
        "sourceFrames": [
          234,
          375
        ],
        "outputFrames": 51,
        "speed": 2.764705882352941
      }
    ],
    "sourceFile": "artifacts/marketing/v5/watch.mp4"
  },
  {
    "id": "steer",
    "duration": 7,
    "sourceDuration": 16.5,
    "kind": "footage",
    "card": null,
    "speedPolicy": "Wholetypedprompt/source0–6 at2.5x→2.4s;6–6.5Sendat1x→.5s;6.5–14.7progressat3.5652x→2.3s;14.7–16.5completedresultat1x→1.8s. Exact210outputframes.",
    "rawSourceDuration": 16.5,
    "editorialSpeedRanges": [
      {
        "sourceFrames": [
          0,
          180
        ],
        "outputFrames": 72,
        "speed": 2.5
      },
      {
        "sourceFrames": [
          180,
          195
        ],
        "outputFrames": 15,
        "speed": 1
      },
      {
        "sourceFrames": [
          195,
          441
        ],
        "outputFrames": 69,
        "speed": 3.5652173913043477
      },
      {
        "sourceFrames": [
          441,
          495
        ],
        "outputFrames": 54,
        "speed": 1
      }
    ],
    "sourceFile": "artifacts/marketing/v5/steer.mp4"
  },
  {
    "id": "bookmark-star-switch",
    "duration": 2,
    "sourceDuration": 2,
    "rawSourceDuration": 2,
    "kind": "card",
    "action": true,
    "card": {
      "eyebrow": "Bookmark",
      "title": "Star this agent",
      "subtitle": "Your shortcut from any floor.",
      "footer": ""
    },
    "animation": {
      "enterSeconds": 0.2,
      "exitSeconds": 0.1,
      "textExitSeconds": 0.1,
      "staggerSeconds": 0.04
    },
    "backgroundSource": "artifacts/marketing/v6/bookmark-star-switch.mp4",
    "backgroundRanges": [
      {
        "sourceFrames": [
          0,
          60
        ],
        "outputFrames": 60
      }
    ],
    "glassMaskFile": "bookmark-star-switch-glass-mask.png",
    "hudFile": "bookmark-star-switch-hud.mov",
    "backgroundFile": "bookmark-star-switch-bg.mp4",
    "speedPolicy": "Actual app interaction at 1x; explanatory glass stays over the action."
  },
  {
    "id": "bookmark-floor-jump",
    "duration": 3.2,
    "sourceDuration": 3.2,
    "rawSourceDuration": 3.2,
    "kind": "card",
    "action": true,
    "card": {
      "eyebrow": "Bookmark",
      "title": "Another machine, same shortcut",
      "subtitle": "Click the starred agent to return.",
      "footer": ""
    },
    "animation": {
      "enterSeconds": 0.2,
      "exitSeconds": 0.1,
      "textExitSeconds": 0.1,
      "staggerSeconds": 0.04
    },
    "backgroundSource": "artifacts/marketing/v6/raw/bookmark-floor-jump-v2.mp4",
    "backgroundRanges": [
      {
        "sourceFrames": [
          0,
          96
        ],
        "outputFrames": 96
      }
    ],
    "glassMaskFile": "bookmark-floor-jump-glass-mask.png",
    "hudFile": "bookmark-floor-jump-hud.mov",
    "backgroundFile": "bookmark-floor-jump-bg.mp4",
    "speedPolicy": "Actual app interaction at 1x; explanatory glass stays over the action."
  },
  {
    "id": "bookmark-return",
    "duration": 2.6,
    "sourceDuration": 2.6,
    "rawSourceDuration": 2.6,
    "kind": "card",
    "action": true,
    "card": {
      "eyebrow": "Bookmark",
      "title": "Back to the same agent",
      "subtitle": "Same terminal. Same work.",
      "footer": ""
    },
    "animation": {
      "enterSeconds": 0.2,
      "exitSeconds": 0.1,
      "textExitSeconds": 0.1,
      "staggerSeconds": 0.04
    },
    "backgroundSource": "artifacts/marketing/v6/bookmark-return.mp4",
    "backgroundRanges": [
      {
        "sourceFrames": [
          0,
          78
        ],
        "outputFrames": 78
      }
    ],
    "glassMaskFile": "bookmark-return-glass-mask.png",
    "hudFile": "bookmark-return-hud.mov",
    "backgroundFile": "bookmark-return-bg.mp4",
    "speedPolicy": "Actual app interaction at 1x; explanatory glass stays over the action."
  },
  {
    "id": "end",
    "duration": 4,
    "sourceDuration": 4,
    "kind": "card",
    "card": {
      "eyebrow": "HERDR OFFICE",
      "title": "Herdr Office",
      "subtitle": "github.com/technologylab-ai/herdr-office",
      "footer": "Runs locally with Herdr · Fictional demo"
    },
    "speedPolicy": "1x genuine live returnedMainAgent closeup, samecamera24px/960panel pose asbookmarkend; no wide-floorclaim and no additionaljump.",
    "rawSourceDuration": 4,
    "glassMaskFile": "end-glass-mask.png",
    "hudFile": "end-hud.mov",
    "backgroundFile": "end-bg.mp4",
    "backgroundSource": "artifacts/marketing/v6/end-bg.mp4"
  }
];
export const disclosure = {
  "normal": "Fictional demo world",
  "terminal": "Fictional demo world · time-compressed",
  "fontSize": 20,
  "color": "rgba(255,255,255,0.86)",
  "textShadow": "0 1px 2px rgba(0,0,0,0.55), 0 0 12px rgba(0,0,0,0.35)",
  "position": "bottom-right, 40px margins",
  "hasBox": false
};
export const cursor = {
  "height": 28,
  "ringColor": "#FF5A7A",
  "size": 44,
  "duration": 0.28,
  "cue": "On real mousedown only: 2px ring, scale 0.6→1.0, opacity 0.9→0"
};
export const chapterDissolves = [
  {
    "between": [
      "map",
      "needs-card"
    ],
    "overlap": 0.2
  },
  {
    "between": [
      "roster",
      "work-card"
    ],
    "overlap": 0.2
  },
  {
    "between": [
      "bookmark-star-switch",
      "bookmark-floor-jump"
    ],
    "overlap": 0.2
  },
  {
    "between": [
      "bookmark-floor-jump",
      "bookmark-return"
    ],
    "overlap": 0.2
  }
];
export const totalDuration = 74.9;
export const sourceDuration = 100.3;
export const musicSourceStart = 15;
export const musicSourceEnd = 89.9;
