# Contrast and explanation edit

V6 keeps the original pink accent and frosted-glass material. Opus 5.5 selected a stronger neutral tint, a dark translucent chip behind the pink labels and brighter white text. The glass compositor applies local blur and brightness adjustment to the actual office video; it leaves the rest of the game sharp.

Map and roster footage now remove their idle middle spans while retaining the real hover, query and selection press. Small explanatory HUDs stay visible during these actions. The bookmark sequence explains its cause and effect directly over the footage: star this agent to save a shortcut, visit another machine's floor, click the saved shortcut, then return to the same agent and terminal context.

Existing V5 walking, agent interaction and the 11-second terminal edit are preserved. Both fictional floors still contain 18 companies, six rows and 72 agents. The only newly recorded scene is the bookmark demonstration, including a real floor-selector action and a visible shortcut press. Intermediate app camera setup is excluded from the edited ranges.

Start the isolated demo with `npm run demo`, then capture the bookmark sources:

```sh
node --experimental-strip-types scripts/marketing/v6/capture-bookmark.mjs
```

The selected source ranges, source filenames, explanatory copy and animation timings are in `plan.mjs`. Preserve native V6 bookmark clips under `artifacts/marketing/v6/raw/` before compositing; the preparation script reads those copies when a raw action and its final annotated scene share a filename.

```sh
node scripts/marketing/v6/prepare-plates.mjs
node scripts/marketing/v6/render-cards.mjs
node scripts/marketing/v6/composite-huds.mjs
node scripts/marketing/v6/assemble.mjs /path/to/suno-export.mp3
```

The preparation script records source hashes and frame ranges. The glass compositor preserves the alpha channel, follows each scene's entrance and exit envelope, and converts the RGB result to BT.709 video. The assembler keeps one continuous soundtrack interval beginning at 15 seconds, strips input artwork and personal tags, and performs a complete decode check. It does not publish the film or change repository visibility.

Outputs and review evidence remain under ignored `artifacts/marketing/v6/`. The final `herdr-office-teaser-v6.mp4` is 74.9 seconds. Review explanation coverage during the actual action, readable contrast at full and half resolution, visible shortcut activation, and the exclusion of the native rear-camera/navigation tails. Technical correctness alone does not establish that viewers understand the sequence.
