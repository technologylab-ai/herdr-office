/** Claude Opus 5.5 V5 frosted glass, correct chapter order and time-compressed terminal. */
export const palette = {
  "tint": "#0F1115",
  "tintOpacity": 0.14,
  "text": "#F6F7F9",
  "muted": "rgba(246,247,249,0.72)",
  "accent": "#FF5A7A",
  "borderHighlight": "#FFFFFF",
  "borderOpacity": 0.24,
  "fontTitle": "SF Pro Display",
  "fontBody": "SF Pro Text",
  "titleWeight": 300,
  "titleSize": 64,
  "bodySize": 26,
  "eyebrow": "18px, weight 600, tracking 0.16em, uppercase, accent; only accent use besides cursor ring"
};
export const glassDesign = {
  "blurSigma": 22,
  "radius": 28,
  "saturate": 1.15,
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
      316
    ],
    "talk-card": [
      988,
      652,
      820,
      316
    ],
    "map-card": [
      112,
      652,
      820,
      316
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
    ]
  },
  "maskPolicy": "One static PNG per card: white rounded rect (radius 28, 1px antialias) at the scene's placement, black elsewhere, 1920x1080. Root multiplies the mask by the HUD panel alpha envelope, blurs the live game footage underneath, and composites. HUD .mov carries only the tint fill, rim and text. The panel never moves. Action scenes get no glass.",
  "enter": "Panel opacity 0→1 over 0.35s easeOutCubic. Text fades in and slides up 12px, staggered eyebrow/title/subtitle/footer at 0.08s steps",
  "exit": "Text fades over 0.25s, then the panel fades over 0.30s, ending exactly at the scene cut",
  "tint": "#0F1115",
  "tintOpacity": 0.14,
  "border": "#FFFFFF",
  "borderOpacity": 0.24,
  "text": "#F6F7F9",
  "accent": "#FF5A7A"
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
    "backgroundFile": "cover-bg.mp4"
  },
  {
    "id": "campus",
    "duration": 1.5,
    "sourceDuration": 1.5,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x",
    "rawSourceDuration": 1.5
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
    "backgroundFile": "walk-card-bg.mp4"
  },
  {
    "id": "run",
    "duration": 18,
    "sourceDuration": 18,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x, approved busy cut",
    "rawSourceDuration": 18
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
    "backgroundFile": "talk-card-bg.mp4"
  },
  {
    "id": "talk",
    "duration": 5,
    "sourceDuration": 5,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x, direct click, camera unchanged",
    "rawSourceDuration": 5
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
    "backgroundFile": "map-card-bg.mp4"
  },
  {
    "id": "map",
    "duration": 5,
    "sourceDuration": 5,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x",
    "rawSourceDuration": 5
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
    "backgroundFile": "needs-card-bg.mp4"
  },
  {
    "id": "blocked",
    "duration": 4,
    "sourceDuration": 4,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x",
    "rawSourceDuration": 4
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
    "backgroundFile": "search-card-bg.mp4"
  },
  {
    "id": "roster",
    "duration": 6,
    "sourceDuration": 6,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x",
    "rawSourceDuration": 6
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
    "backgroundFile": "work-card-bg.mp4"
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
    ]
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
    ]
  },
  {
    "id": "bookmark-card",
    "duration": 2.5,
    "sourceDuration": 2.5,
    "kind": "card",
    "card": {
      "eyebrow": "07 · BOOKMARK",
      "title": "Star it. Jump back.",
      "subtitle": "Roam another floor. Jump straight back.",
      "footer": ""
    },
    "speedPolicy": "Live pre-roll at 1x",
    "rawSourceDuration": 2.5,
    "glassMaskFile": "bookmark-card-glass-mask.png",
    "hudFile": "bookmark-card-hud.mov",
    "backgroundFile": "bookmark-card-bg.mp4"
  },
  {
    "id": "bookmark",
    "duration": 12,
    "sourceDuration": 12,
    "kind": "footage",
    "card": null,
    "speedPolicy": "1x: star selected Check release notes; actual hugeBuildNode18company/72agent overview; return to actualMainAgentCheckrelease notes/StudioMac closeup with24px/960panel held3.4s. Two internal editorial0.2s settledfloor dissolves; no rear/frontflash.",
    "rawSourceDuration": 12
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
    "backgroundFile": "end-bg.mp4"
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
  }
];
export const sourceDuration = 89;
export const totalDuration = 88.6;
export const musicSourceStart = 15;
export const musicSourceEnd = 103.6;
