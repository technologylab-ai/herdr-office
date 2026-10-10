# Campus teaser with game HUDs

V4 records a consistent fictional campus: 18 companies, six rows and 72 agents on Studio Mac, plus four agents on Build Node. The first view shows the full campus, using actual camera controls; the application's Overview button normally frames one row. The first-person route starts in an occupied inner corridor, turns into another lane and approaches an agent inside an office.

Claude Opus 5.5 directs the visual design, copy and editing. The cover and chapter cues are animated, translucent office-themed HUDs over actual game footage. Warm cream, navy, peach and wood replace the earlier green cards. No full-frame card backgrounds replace the office. HUD backgrounds are separate genuine clips, staged before recording so camera setup and intermediate selection views do not appear through the overlays.

Start the isolated demo from the repository root:

```sh
npm ci
npm run demo
```

With macOS Google Chrome and ffmpeg installed, capture the fictional app footage and HUD backgrounds:

```sh
node scripts/marketing/v4/capture.mjs all
```

The capture is restricted to `127.0.0.1:5186`, verifies the isolated demo identity, blocks external requests and requires hardware WebGL. The default Studio Mac still has three companies; the default demo has 16 agents across two floors. The capture opts into the larger `campus` layout through `/api/demo/reset`. It never accesses the user's live bridge or sends instructions to a real agent.

Render the transparent animated HUD layers, composite them over the recorded game backgrounds, then assemble the film:

```sh
node scripts/marketing/v4/render-cards.mjs
node scripts/marketing/v4/composite-huds.mjs
node scripts/marketing/v4/assemble.mjs /path/to/suno-export.mp3
```

The renderer writes `{scene}-hud.mov` with a real alpha channel; each corresponding `{scene}-bg.mp4` is footage of the app. The compositor checks transparency and performs explicit RGB-to-BT.709 conversion. The editorial plan lives in `plan.mjs`; source videos, proof files and the final `herdr-office-teaser-v4.mp4` stay under ignored `artifacts/marketing/v4/`. Existing V2 and V3 exports are preserved.

Feature wording is checked against the app. Roster search matches agents on the selected floor by task, provider, terminal caption, working directory, workspace or tab. The film says “task or project”; it does not imply a file browser or a separate team model. Clicking a person opens their terminal and prompt controls without moving the camera. Normal prompts can be sent when the agent is idle or done. The main-agent star is a bookmark stored in the current browser, with a shortcut across floors.

Console footage demonstrates the actual panel resize to 960 pixels, text enlargement to 24 pixels, polling updates and a typed follow-up instruction followed by its simulated result. Fictional-data disclosures remain visible. Review motion around every map, roster and floor selection; isolated proof images are insufficient to detect brief intermediate views.

Scan every decoded frame of the raw footage/backgrounds, or export a dense final-film selection window:

```sh
node scripts/marketing/v4/qa-motion.mjs --all
node scripts/marketing/v4/qa-motion.mjs artifacts/marketing/v4/herdr-office-teaser-v4.mp4 \
  --window map-arrival:43:45.7
```

The scores identify possible abrupt changes and one-to-three-frame flashes. Acceptance still requires reviewing the indexed frame windows and recorded camera/input traces; an empty candidate list does not prove semantic correctness. The final edit removes 7.5 seconds of the mostly static panorama, retaining a clear 1.5-second view after the 4-second cover HUD. Two central six-frame editorial dissolves reduce the remaining source clips to a 105.1-second film.

The soundtrack uses one continuous interval of the supplied audio, starting at 15 seconds. It is never rearranged or sped up. The assembly applies the opening and closing fades and approximately −14 LUFS normalization, strips source metadata and attached artwork, and performs a full decode check. Assembly and HUD reports record durations, source hashes and audio measurements. No capture or assembly script publishes a post or changes repository visibility.
