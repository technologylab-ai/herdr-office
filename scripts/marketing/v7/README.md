# Machine floors chapter

V7 adds an Opus 5.5 chapter immediately after the campus reveal: a Herdr session is the building, and each connected machine is a floor in that building. The footage shows the native Floor control, a move from Studio Mac to Build Node, then a return to Studio Mac before the existing walk. Both fictional floors have 18 companies, six rows and 72 agents.

The accepted V6 glass cards are copied unchanged, with matching source and destination hashes. Existing footage, terminal speed ranges and later bookmark explanations are retained. Only the four new chapter HUDs are rendered. Their colors, copy, placement and animation come from Opus; the compositor applies the same local backdrop blur and contrast treatment as V6.

Start the isolated synthetic demo with `npm run demo`. Never record the live office or real bridge.

```sh
node --experimental-strip-types scripts/marketing/v7/capture-floors.mjs
node scripts/marketing/v7/prepare-plates.mjs
node scripts/marketing/v7/render-cards.mjs
node scripts/marketing/v7/composite-huds.mjs
node scripts/marketing/v7/assemble.mjs /path/to/suno-export.mp3
```

The capture uses actual controls. Native Floor presses are visible; selecting the destination runs the app's normal change handler. Intermediate camera setup is excluded, followed by a settled destination showing its native machine name. The return joins two genuine plates with a six-frame dissolve. Capture reports retain selection events, camera traces and the original parts.

The assembler keeps one continuous soundtrack interval beginning at 15 seconds, strips personal metadata and artwork, and checks a complete audio/video decode. The final cut lasts 83.3 seconds. Outputs and review evidence stay in ignored `artifacts/marketing/v7/`. Review the native floor labels, visible control presses, readable captions, large floors and the arrival back on Studio Mac before the preserved walk; metrics alone do not establish a clear story.
