# Expanded demo film

This version preserves the original office, map, roster, terminal and bookmark story, adds a genuine first-person run between all three fictional projects, and gives the terminal enough time to show incremental work and a follow-up instruction. Claude Opus 5.5 directed the 104-second structure, dedicated cover/chapter/end cards, typography, colors, annotations, camera composition and music treatment.

The live clips use the actual application and the isolated demo API. No Herdr sessions, SSH connections, real agents or personal workspaces are accessed. The footage has a persistent fictional-demo disclosure. Terminal output progresses through the demo server's scripted activity; it is not text animated over a screenshot.

Start the demo from the repository root:

```sh
npm ci
npm run demo
```

With macOS Google Chrome and `ffmpeg` installed, capture the cards and staged clips:

```sh
node scripts/marketing/v2/capture.mjs all
```

The script uses ANGLE Metal, refuses software rendering, restricts browser traffic to the isolated `127.0.0.1:5186` server, and verifies its demo identity before recording. It moves the actual camera through normal mouse and keyboard controls. There is no camera setter, digital zoom, scene replacement or motion interpolation.

Individual shots can be recaptured with `office`, `run`, `map`, `roster`, `terminal`, `steer` or `bookmark` in place of `all`; `slides` renders only the four full-frame cards. Clips and proof files are written under the ignored `artifacts/marketing/v2/` directory. The `terminal` mode records both `watch.mp4` and `steer.mp4` in the same actual desk view. The standalone `steer` mode warms the scripted review during camera setup, waits for its actual completed output and retakes only the caption-free prompt and response sequence. Only the small fictional-output disclosure remains during steering.

| Output | Seconds | Behavior |
| --- | ---: | --- |
| cover.mp4 | 5 | Opaque forest cover with the product title |
| office.mp4 | 9 | Close-up reveal, then overview and workspace mapping |
| walk-card.mp4 | 3 | Dedicated first-person navigation chapter |
| run.mp4 | 13 | Actual F, W and Shift run: Orbit Studio → Northstar API → Signal Lab |
| map.mp4 | 10 | Hover and click a real map marker, then visit the standing blocked agent |
| roster.mp4 | 6 | Search for the release task and select its actual desk |
| terminal-card.mp4 | 3 | Dedicated watch-and-steer chapter |
| watch.mp4 | 18 | Resize to 960 px, set 19 px text and observe incremental work |
| steer.mp4 | 19 | Type a follow-up instruction, click Send and read the progress and completed result |
| bookmark.mp4 | 12 | Star the agent, inspect Build Node and return through the main-agent shortcut |
| end.mp4 | 6 | Opaque end slide with the repository URL |

The raw clips total exactly 104 seconds. The reviewed primary edit trims some static reading holds to 93.3 seconds; the full 104-second version can also be exported. The map sequence uses a short edit between an actual map click and actual footage from a front view reached through normal camera controls; it does not show a still image in place of the agent.

`capture-report.json` records the hardware renderer, attempted external requests and action timings. `run-proof.json` records actual keyboard events, pointer-lock state and camera positions. `watch-dom-proof.json` and `steer-dom-proof.json` record text and status changes from the actual rendered terminal, including font size, panel width, visible duration and scroll dimensions. Review the proof frames and exported video before distributing it.

Assemble the reviewed 93.3-second primary cut and add your soundtrack:

```sh
node scripts/marketing/v2/assemble-v2.mjs /path/to/suno-export.mp3
```

Add `--extended` to export the full 104-second cut. The primary version removes idle reading holds with frame-aligned cuts; typing, Send, every work phase and the continuous first-person run stay intact. The default output is `herdr-office-teaser-v2.mp4`; the extended output is `herdr-office-teaser-v2-extended.mp4`.

The primary soundtrack uses **one contiguous source interval, 15–108.3 seconds**; the extended version uses **15–119 seconds**. Neither has section splices, tempo changes or rearrangements. Only the approved 0.5-second opening fade, 2-second closing fade and loudness normalization are applied. Source audio and attached cover art stay outside the repository; exported audio maps exclude artwork and remove personal metadata. `assembly-report.json` records the final timeline, source frame ranges and encoded audio measurements.

The capture and assembly tools create local files only. They do not publish a post, upload a video or change repository visibility.
