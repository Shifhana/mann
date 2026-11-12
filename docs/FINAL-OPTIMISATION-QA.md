# Final production optimisation and QA

Date: 12 November 2026. Branch: `feature/final-optimisation`.
Baseline: `704e2c28cc444d51ca0a326ffb8d2e855bb8ca6f`.
Changes are uncommitted for review; nothing was pushed or merged.

## Preserved experience

All **1,911 pieces**, architectural records, interiors, final transforms, materials,
camera, layout, five-second choreography and original sound design are preserved.
There are no physics, landing-timeline, sound-asset or UI changes. The existing GPU motion
shader still drives the independent gravity falls and damped seating response.

## Measurement method

Windows desktop, Chrome 157, Intel HD Graphics 630, hardware-accelerated ANGLE/D3D11,
four logical CPU threads. Main viewport: **1600 × 1000**, DPR 1. Both versions were
served as production builds, with sound enabled. No software renderer was used.

Frame gaps below are intervals between actual application render-completion events,
not an FPS estimate rounded by the UI. FPS is 1000 divided by the mean gap; percentiles
use nearest ranks. The initial opening presentation and completed presentation are
included. These measurements do not establish physical monitor scanout timing.

Two complementary comparisons were made:

- A visible desktop Chrome window, two complete replays per version.
- A repeatable hardware-accelerated headless desktop renderer, four complete replays
  per version. This isolates renderer changes from window-compositor variability.

Replays in these comparisons invoke the actual button handler without CDP mouse
injection. Real mouse-button interaction is tested separately. GPU timer queries,
CPU sampling and recording are disabled in the main comparisons. No build or test
process runs alongside these measurements.

## Before and after

### Visible desktop window, without recording

| Metric | Approved baseline | Optimised |
|---|---:|---:|
| Average FPS | 57.7 | **59.4** |
| Median frame gap | 18.2 ms | **16.8 ms** |
| P95 frame gap | 19.5 ms | **18.3 ms** |
| P99 frame gap | 20.3 ms | **19.0 ms** |
| Maximum frame gap | 32.8 ms | **30.2 ms** |

The final 30.2 ms outlier is the first interval of one Rebuild; the next largest gap
is 21.1 ms. Neither comparison has a main-thread long task. This is near-60 FPS,
not a claim that every frame on this machine always meets 16.67 ms.

### Controlled desktop renderer, without recording

| Metric | Approved baseline | Optimised |
|---|---:|---:|
| Average FPS | 56.0 | **59.8** |
| Median frame gap | 18.3 ms | **16.7 ms** |
| P95 frame gap | 19.7 ms | **18.0 ms** |
| P99 frame gap | 27.0 ms | **19.1 ms** |
| Maximum frame gap | 35.7 ms | **20.6 ms** |
| Render work, median | 1.4 ms | **1.0 ms** |
| Render work, P95 | 2.4 ms | **2.3 ms** |
| Main-thread long tasks | 0 | 0 |

There are 1,122 baseline and 1,198 final gap samples over four replays each.
An additional **1920 × 1080**, DPR 1, two-replay production check measured 59.7 FPS,
P50 16.8 ms, P95 18.0 ms, P99 18.7 ms and maximum 19.1 ms.

The automatic initial-load construction was also checked without a warm Rebuild:
59.6 FPS, P95 18.1 ms, P99 18.5 ms, maximum render-event gap 19.5 ms; completed in
5,015.6 ms with all final offsets zero. Its rounded in-app maximum statistic is a
different frame-start measurement and is not substituted for these event gaps.

### Actual 1× capture overhead

| Metric during recording | Approved baseline | Optimised |
|---|---:|---:|
| Average scene FPS | 55.2 | **58.2** |
| Median frame gap | 18.6 ms | **17.2 ms** |
| P95 frame gap | 21.3 ms | **19.7 ms** |
| P99 frame gap | 23.2 ms | **21.1 ms** |
| Maximum frame gap | 26.9 ms | **24.9 ms** |
| Measured construction completion | 5,016.6 ms | **5,001.7 ms** |

These are one captured run each. Capture uses real-time frame sampling, canvas readback,
compositing and encoding plus captured AudioContext output. Its lower scene FPS is
reported separately rather than attributed to normal playback or audio scheduling.
The delivered 60 FPS video container does not imply 60 distinct application frames.
Neither the picture nor the sound was sped up.

## Profile findings and retained optimisations

1. **Frame pacing:** the visibility fallback previously waited a complete 16.67 ms
   after render work. In the controlled environment this handled most presentations,
   adding roughly 1–2 ms to each interval. The fallback now budgets from the preceding
   frame start, and near-duplicate timer/rAF submissions are suppressed. Native rAF
   remains preferred. Completion and stationary rendering behaviour are preserved.
2. **Draw submission:** identical part geometry was split by four material colours.
   Per-instance linear colours now share one otherwise identical material. A coplanar
   precedence graph retains the approved face ordering and splits cyclic cases back
   into separate colour batches. Draw calls fall from **222 to 162** per rendered frame
   (including shadow work). No parts are merged or deleted.
3. **GPU vertex work:** every part previously submitted repeated non-indexed vertices.
   Exact indexing reuses only matching complete position/normal/UV records, retaining
   sharp edges, UV seams, signed zero and original triangle order. Across the model,
   instance-weighted vertex records fall from **2,069,496 to 731,456**, a **64.7%**
   reduction. Per-frame triangles remain **1,379,668** including both render passes.
   This removed the sustained backpressure seen before indexing.

The CPU sample was mostly idle, with no large application long task. WebGL submission
and GPU work were more useful targets than replacing the approved motion shader.
GPU timer-query probes showed reduced GPU time, but also slowed the baseline playback;
their FPS is therefore excluded from the main table.

A CPU-updated motion-buffer experiment was rejected because uploads introduced stalls
without a consistent improvement. Naive colour batching was rejected because it
changed a visible coplanar seam. Pacing alone and batching alone did not resolve the
sustained GPU tail consistently. Only the retained combination is delivered.

Trusted automated mouse-click runs occasionally record 51–66 ms initial Rebuild gaps,
including 59 ms in the final interaction suite. They coincide with the first interval
after CDP input, with approximately 1 ms render work and no long task. They are kept as
separate evidence, not silently discarded or claimed to be a solved GPU bottleneck.
The input-free comparisons above remove that harness interaction while exercising the
same application handler. Hardware, browser scheduling and display setup can still
produce isolated gaps; universal 60 FPS is not claimed.

## Visual and motion preservation

The expanded triangle-attribute streams of all **52** unique approved part geometries
hash identically before and after exact indexing. No position, normal, UV or triangle
was removed or approximated. The logical brick records and transforms are unchanged.

Matched 1600 × 1000 snapshots were taken at 0, 700, 1,500, 2,500, 3,500, 4,500 and
5,000 ms using the same camera and timeline. Five images are pixel-identical. At
2,500 ms four pixels differ by at most 2/255; at completion seven pixels differ by
at most 5/255, consistent with the different instance-colour arithmetic. This is not
a claim of byte-identical final screenshots. Coplanar colours and architectural
detail remain visually intact.

Existing motion tests cover constant gravitational acceleration before contact,
continuous nonnegative offsets, damped rebound, exact final seating, support order,
deterministic replay and smooth continuous rotation. The recorded fall/contact/lock
crops were inspected across the foundation, walls, tower and crown. No new hovering,
entry popping or seating discontinuity was observed in those probes. The approved
intentional final mesh overlaps remain unchanged; this is not a new per-triangle
collision solver or an exhaustive collision proof.

## Audiovisual verification

The sound implementation and recordings are unchanged. Actual contact and locking
sounds still fire from the same landing records on the first displayed phase frame.

The final recording captures the actual playback bus. A capture-only calibration burst
before construction independently aligns audio/video clocks; the calibration pre-roll
is trimmed from both tracks. Decoded, pitch-adjusted source waveforms are correlated
with the captured sound, then compared with the actual rendered and encoded frames.

Sixteen impact/locking moments across eight pieces were audited. **Fifteen** have high
waveform confidence (correlation ≥0.8):

| Comparison | Worst absolute error |
|---|---:|
| Captured attack vs actual rendered contact/seating frame | **9.2 ms** |
| Captured attack vs corresponding delivered video frame | **12.7 ms** |

Clock uncertainty is approximately ±3 ms. These clear probes remain within one
60 Hz frame (16.67 ms), including that uncertainty. One tower locking click is masked
by overlap (correlation 0.446) and is not claimed as independently verified. Across
84 emitted voices, 79 pass the lower 0.5 correlation threshold; quiet overlapping
voices are not all independently resolved. This measures digital playback/capture,
not speaker or DAC latency.

## Build and interaction QA

- `npm run build`: passed.
- `npm test`: **50/50 passed**, including six new batching/indexing regressions.
- Muted default: no AudioContext created until enabled; six buffers load once.
- Three complete sound-enabled Rebuild cycles: 84 unique voices each, no duplicated
  playback, no lingering live voices and final offset zero.
- Mid-build mute immediately cancels voices; no sounds start while muted; unmute
  resumes future accents. Rebuild is disabled during construction as before.
- Initial automatic playback and complete playback verified.
- Stationary temple stops rendering; reduced-motion completion remains immediate.
- Browser error logs are empty.

## Local review evidence

All artifacts are in `.qa/final-qa/` (ignored local QA output):

- `after-recording/construction-1x.mp4`: complete real-time recording with captured sound
  and stationary final hold.
- `after-recording/landing-frame-checks.png`: recorded fall/contact/lock crops.
- `after-recording/sync-verification.json`: per-landing waveform alignment/confidence.
- `before-foreground.json`, `after-foreground.json`: visible desktop measurements.
- `before-renderer.json`, `indexed-renderer.json`: main controlled production runs.
- `summary.json`: controlled and recording statistics.
- `after-1080p.json`, `initial-load.json`, `production-controls.json`: additional QA.
- `geometry-proof.json`, `indexed-pixel-comparison.json`, `before-poses/`,
  `indexed-poses/`: geometry hashes and identical-time visual comparisons.

Profiling and capture instrumentation remains in local QA scripts, not the shipped
application. No model simplification, section interaction or new product feature is
included in this optimisation pass.
