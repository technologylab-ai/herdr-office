# Continuous arrival into walking

V9 replaces the fleeting Studio Mac return and unrelated aisle shot with a complete spatial sequence. The viewer sees the real Floor control press, recognizes the large Studio Mac floor during a steady arrival hold, follows an actual 3D wheel descent into the walking aisle, then reads the walking caption at eye level before the run begins. Build Node remains compact: one company, two departments and four agents.

Opus 5.5 reviewed ordered frames from the prior edit and chose the new shot structure, caption windows and transitions. The arrival caption appears only once Studio Mac is visible. It exits during the aim drag, leaving the descent clear. A half-second matched dissolve covers only the app's final overview-to-eye-level height step, using settled plates at the same location and orientation. The walking caption starts after that transition has cleared.

The capture uses actual mouse, wheel and keyboard controls in the isolated synthetic demo on port 5186. It records camera traces and action timing. Its arrival target matches the accepted run's measured starting position, view and visible cast; intermediate machine-switch camera setup is excluded. A read-only observer of WebGL view-matrix uploads supplies precise camera measurements for the real wheel-braking input. It passes the original GPU upload values through unchanged and validates the observed pose against the app's own published pose. Actual UI controls perform the switch and descent; there is no camera setter or synthetic camera interpolation.

Start the demo with `npm run demo`, then capture and assemble:

```sh
node --experimental-strip-types scripts/marketing/v9/capture-return.mjs
node scripts/marketing/v9/prepare-plates.mjs
node scripts/marketing/v9/render-cards.mjs
node scripts/marketing/v9/composite-huds.mjs
node scripts/marketing/v9/assemble.mjs /path/to/suno-export.mp3
node scripts/marketing/v9/review-temporal.mjs
```

Review the entire machine chapter into walking in temporal context, including clean recognition time, uninterrupted descent, caption timing, a calm arrival and the join into the run. Sampled frames and camera traces are evidence, not a claim that an external model played the MP4. A technically valid dissolve or matching file hash alone does not establish a good edit.

The glass compositor supports delayed entrance and an early caption exit. The assembler uses frame-aligned overlap durations from the plan, retains a single continuous soundtrack interval beginning at 15 seconds, strips personal music tags and artwork, and checks a full audio/video decode. The final film lasts 96.433333 seconds (2,893 frames at 30fps), using the full measured continuous take. Both machine changes use a cut motivated by the visible Floor-control action; the early two-floor overlap is removed. The 11-second terminal demonstration and all 21 other source scenes remain unchanged. Artifacts and review reports remain in ignored `artifacts/marketing/v9/`.
