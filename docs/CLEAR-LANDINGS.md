Latest physics/audio polish: see [LANDING-POLISH.md](LANDING-POLISH.md). The 1,911-piece geometry below remains unchanged.

# Clear individual landings — motion-only refinement

Development preview: `/?preview=construction`.
All 1,911 piece records, geometry, inventory, materials, camera and layout are unchanged.
The final desktop screenshot matches the previous 1,911-piece preview byte for byte:
`9bacb8ca9ed4834bb984842159f1361fdf1d48da62f1c92b83b7567c1b61503d`.

## Choreography

- Structural bricks retain their long sky-to-model falls and prominent contact/lock accents.
- 689 small/medium decorative parts use independent short approaches. Small details
  travel 3.2–4.6 studs in roughly 108–129 ms; medium details travel 9–12 studs in
  roughly 181–209 ms. Gravity remains 550 model units/s² throughout.
- Short approaches smoothly gain coverage over their first 40–45 ms, reaching full
  coverage before contact. They remain full-size rigid parts; no scale growth, shared
  falling groups or instantaneous visibility switch. Coverage uses the existing
  screen-door transparency in both colour and shadow passes; resting materials are unchanged.
- Extra release constraints keep a short approach above any overlapping falling support.
  Lower pieces still finish seating before upper contacts. Existing final geometry
  intersections are preserved.
- Foundation landings begin at 519 ms. Earlier structural windows allow walls and
  shrine spaces to emerge while large bricks remain readable overhead.
- Small rebounds last 26 ms; prominent rebounds retain 80 ms. Clicks remain scheduled
  from actual contact and locking times. There are 42 substantial landing accents.
- Peak airborne count falls from 544 to 333 (39% reduction). Every part still has its
  own event, final transform and gravity-driven trajectory.
- The preview retains a 5,000 ms rotation/build timeline; all parts seat before its end.

## Verification

Production build passed; all 41 tests passed. New tests cover unchanged model records,
reduced airborne load, continuous entry coverage, full opacity at contact and support
clearance for short approaches. Final offsets are zero; no browser errors.

Final recording: 5,007.7 ms completion, 52 average FPS, 75.2 ms maximum frame interval
on this machine. The small details are intentionally less prominent; this is a visual
trade-off in favour of larger LEGO landings, not a reduction in final detail.

## Review

`.qa/clear-landings/construction-1x.mp4` shows the complete 1× build with live recorded
playback sound, empty opening and finished hold. Wall-clock video timestamps are
preserved. A constant -8.600 ms audio capture-origin alignment was applied during
muxing; no playback-speed adjustment or replacement soundtrack.

Metrics, final screenshot and review sheet are alongside the video. Changes are
uncommitted. The normal production experience and the separate small prototype remain
unchanged; this choreography is development-only.
