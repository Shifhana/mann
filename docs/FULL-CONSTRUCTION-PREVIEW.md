Current development preview: see [READABILITY-REFINEMENT.md](READABILITY-REFINEMENT.md) for the 1,911-piece refinement. The figures below describe the preserved 2,145-piece comparison baseline.

# Five-second independent construction preview

Open `/?preview=construction` on the Vite development server. The normal experience
and production construction remain unchanged. All 2,145 original pieces, final geometry,
materials, camera scale/angle and desktop layout are preserved.

## Choreography

The previous serial cursor is replaced with independent structural arrival windows:
foundation, floors and plinth first, then walls/interiors/roofs, tower courses and crowns.
Neighbouring regions and individual pieces receive deterministic timing offsets.
A footprint dependency graph moves an arrival later whenever a lower overlapping
piece has not finished seating. Nothing moves as a rigid layer.

Gravity is consistent at 550 model units/s², from a source height of 70 studs, above
the fixed viewport. Rebounds use the same gravity: small pieces seat in 32 ms;
26 substantial foreground pieces receive an 80 ms, 0.44-stud rebound. All pieces
land at their exact original transforms. Duration is derived from the latest arrival,
not by scaling the former 92-second schedule: last seating at 4,898.4 ms, full
rotation eased to rest by 4,979 ms. There is no camera animation or final reframing.

Small parts are staggered over a wider window to avoid identical arrival sheets.
41 actual substantial landings receive recorded plastic contact/locking accents.
The original small details remain small at the fixed camera scale; the prominent
landings provide the main readable rhythm.

## Performance

Instancing and immutable final matrices are retained. Per-instance flight, rebound
duration and bounce amplitude run in both colour and depth shaders. Unreleased
instances collapse outside the clip volume, avoiding their rasterisation and shadows.
Audio schedules only the next 220 ms, cancels on replay/mute and skips missed events
after a delayed frame. No per-frame per-piece matrices or physics allocations are used.

## Verification (2026-11-12)

- `npm run build`: passed (existing bundle-size advisory remains).
- `npm test`: 35/35 passed, including preservation, parallel regions, support order,
  constant gravity, ballistic rebound, exact final pose and audio lifecycle checks.
- Final 1× recording: **4,985.8 ms**, **58 average FPS**, **29.7 ms maximum frame gap**.
  No multi-second stalls or browser errors in this final run.
- Two playback checks with sound, without recording: 4,986.7/4,980.3 ms,
  57/56 FPS; maximum frame gaps 25.3/28.6 ms.
- All final offsets zero. Final desktop screenshot is byte-identical to the approved
  completed desktop screenshot (SHA-256
  `0fec7d0a3e57ca928e65357516d955f65899478c1f4634177a70ece058aea6e1`).

## Review

`.qa/five-second-construction/construction-1x.mp4` contains a clean empty opening,
complete real-time construction, captured playback sound and stationary completed hold.
Video uses actual wall-clock frame timestamps at 30 FPS capture. Audio/video capture
origins were aligned by a constant +296.961 ms during muxing. Neither track was sped up;
no offline re-animation or replacement soundtrack was used.

Metrics, unrecorded checks and frame sheet are in `.qa/five-second-construction/`.
Sound source credits remain in `public/audio/landing-prototype/LICENSE.md` (CC0).
Changes are uncommitted for visual review. This remains a development-only preview.
