# Coastal material and reveal preview

Development URL: `/?preview=coast`. The production experience remains unchanged.

The existing scenery geometry and all four tree anchors are preserved. Material-only
refinements add low-contrast sand tones, contact shading around the temple base and
small growth-synchronised tree contact shadows. The sea grades from pale shallows to
a deeper muted blue with restrained static highlights, wet-sand colouring and a
softly defined curved shoreline. Tree greens and satin material response are richer;
no lights or scenery objects were added.

The landscape begins at two seconds and develops through smooth opacity transitions
for 4.5 seconds, settling around 6.5 seconds overall. The ground stays stationary.
The existing tree-growth schedule and exact final transforms remain unchanged.
Rebuild cancels/reset the landscape, and reduced motion shows the completed scene.

Production build and all 60 tests passed. Browser QA measured onset at 2,015.6 ms and
completion at 6,514.8 ms, preserving all 84 construction sound events, exact temple
instance transforms, fixed camera/terrain, idle rendering and clean replay reset.
All 21 scenery objects and their geometry/final transforms match the previous version.
Protected temple, renderer, physics, sound, border, viewport and UI source hashes are
unchanged. No browser errors were recorded.

Review artifacts are in `.qa/coastal-depth/`: `complete.png`, `browser-qa.json`,
`geometry-proof.json`, `tests.log` and `recording/construction-1x.mp4`. The final
recording captures wall-clock playback and actual sound at 1×, with a 30 FPS capture
rate to reduce recording overhead. Only empty/calibration pre-roll is trimmed.

Changes remain uncommitted for visual review.
