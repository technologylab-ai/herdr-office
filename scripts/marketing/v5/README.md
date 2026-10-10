# Glass HUD teaser

V5 records the isolated `showcase` world: **both** Studio Mac and Build Node have 18 companies, six rows and 72 agents. There is no small-floor exception in the film. Existing default demo layouts remain unchanged.

Claude Opus 5.5 chooses the material, palette, typography, chapter copy and pacing. The editorial HUDs use actual local blur of the moving office, a faint neutral tint, thin reflective edges, light lettering and coral accents. There are no cream or green editorial panels. The small disclosure is plain light text with a shadow and no filled badge.

Start the fictional demo:

```sh
npm ci
npm run demo
```

Record the actual app with hardware Chrome on macOS:

```sh
node --experimental-strip-types scripts/marketing/v5/capture.mjs all
```

The script verifies the isolated server on `127.0.0.1:5186`, blocks external browser requests and checks the selected floor's reported and rendered inventory for each shot. It never connects to the user's live bridge or sends instructions to a real agent. Camera moves and clicks use the real application controls.

The HUD renderer creates `{scene}-hud.mov` as transparent qtrle/ARGB video and `{scene}-glass-mask.png` as a rounded matte. The compositor blurs the actual background video, limits the effect to the animated mask, then adds the tint, rim and typography. Outside the glass region the game remains sharp. The RGB composition is explicitly converted to BT.709 limited-range video.

```sh
node scripts/marketing/v5/render-cards.mjs
node scripts/marketing/v5/composite-huds.mjs
node scripts/marketing/v5/assemble.mjs /path/to/suno-export.mp3
```

All sources and exports stay in ignored `artifacts/marketing/v5/`. Earlier cuts are preserved. The final output is `herdr-office-teaser-v5.mp4`.

The story introduces the map immediately before using the map, explains why agents needing input stand beside their desks, then introduces search immediately before typing in the roster. Clicking a person opens their terminal. Normal prompts are sent when the agent is ready. The main-agent bookmark demonstrates a genuinely large second floor and a return to the same completed result.

The 29-second native terminal recording is edited to 11 seconds using the explicit `editorialSpeedRanges` in `plan.mjs`. The complete typed instruction, Send click and response remain visible. The important missing-notes finding and final completed result retain live reading holds. Only accelerated terminal sequences are labeled time-compressed. Playback is not presented as real agent execution speed.

The soundtrack is one continuous source interval starting at 15 seconds, with no rearrangement or tempo change. Input metadata and attached artwork are stripped, audio is normalized to approximately −14 LUFS, and the final video undergoes a complete decode check. Source hashes, ranges, speeds, glass masks and measurements are recorded in the composition and assembly reports. Acceptance is tied to the user's explicit material, floor-size, chapter/action and pacing requirements, with dense frame review around selections.
