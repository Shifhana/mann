Latest motion-only refinement: see [CLEAR-LANDINGS.md](CLEAR-LANDINGS.md). The model and inventory below are preserved.

# Readability refinement — development preview

Open `/?preview=construction` for the refined 1,911-piece collectible.
Use `/?preview=construction&detail=original` for the original detailed 2,145-piece model.
The normal URL and production build retain the approved original model.

## Selective geometry changes

- 120 adjacent 2×2 eave slopes become 60 standard 2×4 slopes (3037), with the same
  roof envelope. Remaining odd slopes stay 3039; no giant continuous roof slabs.
- Of 72 repeated miniature roof assemblies, retain the 52 flanking/single features
  and omit 20 redundant central repetitions. Each retained feature uses one 1×2 brick
  (3004) plus the existing 2×2 slope (3039), replacing the tiny tile and 1×1 pillar.
  The replacement miniature roof is 0.4 stud shorter; the principal eaves are unchanged.
- 93 stacked small pillar bricks become 31 standard 1×1×3 bricks (14716), preserving
  their exact occupied volumes and architectural depth, with fewer horizontal joints.

Result: **234 fewer pieces (10.9%)**. Small footprints (≤2 square studs) fall from
882 to 728. No new custom part forms were added. The three shrine spaces, interior
voids, portals, principal cornices, setbacks, crowns, finials and warm materials remain.

3037 is verified against the official LDraw header in `preview-slope-3037.json`.
3004, 3039 and 14716 were already verified in the repository's parts evidence.
The approved original definition is never mutated; preview replacements are isolated
in `refine-collectible.ts`.

## Motion and verification

Independent spatial waves sweep across the shrines rather than scattering neighbouring
arrivals at random. Per-piece jitter remains, with support dependencies checked after
replacement. Equal-gravity trajectories, individual rebound/seating, fixed camera,
continuous rotation, muted-by-default recorded contact/lock audio and Rebuild remain.
41 substantial arrivals receive audible accents; there is no continuous rattle bed.

- Production build: passed. All **38 tests passed**.
- Logical timeline: 5,053 ms. Recorded completion: **5,067.1 ms**.
- Recorded average rendering: **57 FPS**; maximum frame interval **47.7 ms**.
- All final position offsets zero; no browser errors.
- Matching hero, elevation and close-up screenshots inspected for tower profile,
  depth, brick scale and the risk of flat/boxy replacement surfaces.

## Review artifacts

`.qa/readable-collectible/` contains:

- `hero-before.png`, `hero-after.png`: identical camera and layout.
- `closeup-before.png`, `closeup-after.png`: matching tower/entrance detail view.
- `elevation-before.png`, `elevation-after.png`: profile comparison.
- `construction-1x.mp4`: complete real-time 1× sequence with actual captured audio,
  empty opening and stationary completed hold.
- `inventory.json`, `metrics.json`, `review.jpg`: inventory and capture evidence.

The recording uses actual wall-clock video timestamps. The independently captured
playback audio bus received a constant +195.720 ms capture-origin alignment during
muxing; neither track was sped up and no soundtrack was substituted. Audio credits
remain in `public/audio/landing-prototype/LICENSE.md`.

This is deliberately a restrained reduction, not a piece-count target. Tiny original
Nandi/sacred details remain, and far-side contacts can be partly occluded. No full
production rollout or changes to the approved normal experience. All changes uncommitted.
