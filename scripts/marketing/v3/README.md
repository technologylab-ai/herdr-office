# Second-lane navigation cut

This cut preserves the approved 93.3-second V2 edit and replaces only its 13-second first-person shot. Claude Opus 5.5 directed the route and the fictional second-row company names. The camera leaves Signal Lab, turns through the open cross aisle, turns into the next lane, and stops facing Bramble Pay. All movement uses the application's actual F, W, Shift and mouse controls.

The isolated demo API supports an optional `multi-lane` layout. It adds three fictional companies with matching room dimensions; existing companies keep their positions. The default demo remains unchanged. No live Herdr connection is used.

With the isolated demo running on port 5186, capture the replacement shot:

```sh
node scripts/marketing/v3/capture-run.mjs
```

Preserve the approved V2 export before assembling. Use V2's existing clips for every other scene and copy its encoded soundtrack without reordering or re-encoding:

```sh
node scripts/marketing/v2/assemble-v2.mjs \
  --run-file artifacts/marketing/v3/run.mp4 \
  --output-dir artifacts/marketing/v3 \
  --output-name herdr-office-teaser-v3.mp4 \
  --audio-from artifacts/marketing/v2/herdr-office-teaser-v2.mp4
```

Replacement cuts require a separate output directory, protecting the approved V2 assets. The new run occupies exactly 17–30 seconds. The assembly report records every source clip's SHA-256, frame ranges and timing, plus the copied soundtrack's loudness. Capture proofs and media exports remain under ignored `artifacts/marketing/v3/`.
