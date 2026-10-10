# Capture the fictional demo

For the large campus film with animated translucent game HUDs, use the [V4 guide](v4/README.md). The original screenshot workflow below retains the smaller default fixture.

For the revised film with dedicated cover/end slides, a real first-person run,
live terminal work and prompting, use the [V2 workflow](v2/README.md). Its primary
cut is 93.3 seconds with one continuous musical excerpt; the original 40-second
workflow below remains available for comparison.

The screenshots and teaser use the real app with the isolated, in-memory demo API. No capture step connects to Herdr, SSH, Ollama or a real agent. Prompts and responses are clearly labeled as fictional. The capture script refuses any URL except `http://127.0.0.1:5186`, verifies `/api/demo/info`, and blocks external browser requests.

This optional production workflow requires macOS, Google Chrome at its standard application path, and `ffmpeg` on PATH. Chrome must report hardware rendering through ANGLE Metal. Install the project's development dependencies with `npm ci`.

Start the synthetic demo in one terminal:

```sh
npm run demo
```

In another terminal, run:

```sh
node scripts/marketing/capture.mjs all
node scripts/marketing/repair-standing.mjs
```

Use `video` or `screenshots` in place of `all` to capture one set. The script resets the demo and performs real mouse/keyboard interactions: wheel glide, drag look, overview, map travel, roster search, terminal font changes, panel resize, a simulated prompt, the main-agent bookmark, and a floor switch. It does not set the camera directly or interpolate office animation.

Outputs are written under the ignored `artifacts/marketing/` directory:

- `herdr-office-teaser-1080p.mp4`: 40 seconds, 1920 × 1080, 30 fps, H.264 with limited-range BT.709 YUV420P and fast start. This picture master has no soundtrack.
- `herdr-office-picture-final.mp4`: the picture master with Claude's approved editorial end-card hold. Actual interactions stay untouched through 37.5 seconds; a 300 ms dissolve leads to the actual captured end-card frame, held until the final fade. It has no soundtrack.
- `herdr-office-picture-reviewed.mp4`: the reviewed picture edit. The separate repair command records a real map click and a real front view of the standing agent with a small wheel glide, then replaces 12.5–17.5 seconds exactly. The slow camera orbit is removed for pacing; this is actual moving browser footage, not a still image. Prompt, floor, bookmark and end-card timings remain unchanged.
- `demo-overview.png`, `demo-desk.png`, `demo-roster.png`, `demo-floors.png`: 3200 × 1800 captures of the fictional office.
- `capture-report.json`: hardware renderer, action timestamps and attempted external requests.
- `take/`: actual Chrome paint frames with a concat manifest preserving their original timing. Static office frames repeat normally in the 30 fps export; movement stays as captured.

Visual direction, caption styling, wording, scene order and cursor treatment were developed with Claude Opus 5.5. The recording-only overlays never change the shipped app. The plain cursor tracks actual input coordinates, disappears during pointer lock and has no click effects.

Review the video and screenshots before copying the PNGs to `docs/images/`. They should contain only the demo's `Launch Studio`, `Studio Mac`, `Build Node`, `/demo/` paths and fictional tasks. Do not substitute a live bridge for the demo server.

An independently generated, approved soundtrack can be added after editing it to the same 40-second, 96 BPM cue grid. For example:

```sh
ffmpeg -i artifacts/marketing/herdr-office-picture-reviewed.mp4 \
  -i soundtrack-40s.wav -map 0:v:0 -map 1:a:0 -map_metadata -1 -map_chapters -1 -c:v copy \
  -af 'loudnorm=I=-14:TP=-1:LRA=7' -c:a aac -b:a 192k \
  -t 40 -movflags +faststart artifacts/marketing/herdr-office-teaser-with-music.mp4
```

The capture command creates local artifacts only. It does not upload files, publish a post, or change repository visibility.

The release's supplied 163-second Suno take was edited separately with Claude's source-based selection: 15–35 s, 62.5–75 s, 150–155 s and 160–162.5 s. The stronger source passage at 70 seconds lands on the video's prompt send at 27.5 seconds. `mix-audio.mjs` reproduces that specific edit with short source-handle crossfades, two-pass loudness normalization and an AAC decode check:

```sh
node scripts/marketing/mix-audio.mjs /path/to/suno-export.mp3
```

It writes `herdr-office-teaser.mp4` and a local `soundtrack-report.json`. The supplied source audio and its attached artwork are not distributed in the repository. Another track needs its own source selection; the specific source timestamps above should not be applied blindly. The mixer maps audio explicitly, drops source metadata and artwork, and checks the encoded result against approximately −14 LUFS and a −1 dBTP ceiling.
