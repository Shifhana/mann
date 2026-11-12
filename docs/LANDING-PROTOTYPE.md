# Individual landing prototype — readability refinement

Open `/?preview=landing` on the Vite development server. Normal and production
construction retain their existing behaviour.

The sample now uses **12 existing standard cornice plates**, 6–10 studs long, from
main tower courses 2 and 4. These replace the small decorative and finial sample.
All 2,145 model pieces, final transforms, materials, camera and layout are preserved.
The other 2,133 pieces remain assembled as context.

- Independent accelerating vertical falls: 600 ms, previously 400 ms.
- One 120 ms rebound, previously 60 ms; peak rise 0.48 stud, previously 0.075.
- Fall and rebound have matching ballistic acceleration (266.7 model units/s²).
- Contacts spaced 190 ms apart. Last part locks at 2,830 ms; rotation stops at 3,000 ms.
- A dry recorded plastic contact on impact and a quieter snap at the exact locking time.
- Source credits: `public/audio/landing-prototype/LICENSE.md` (CC0 LEGO recordings).

Validation: production build passed; 30/30 tests passed. Tests cover original part
identity, acceleration, rebound/contact continuity, exact final transforms, descent
clearance, support order, audio timing, mute, replay and stale asynchronous loading.

Real browser capture: 3,014.5 ms to the final presented frame; 54 average FPS during
recording, 44.6 ms maximum frame interval. A separate replay measured 59 FPS.
Final offset is zero. The fixed 3,000 ms timeline is displayed on the next available frame.

Review: `.qa/landing-prototype-v2/landing-1x.mp4` includes live sound at 1× speed,
with the complete scene held afterwards. Video uses actual wall-clock timestamps.
The captured audio clock origin was aligned by -14.329 ms during muxing; no speed
change or substituted soundtrack. All 24 contact/lock attacks are present, within
0.9 ms of the schedule after alignment. Visual timing is quantised to rendered frames.

Evidence: `metrics.json`, `parity.json`, `av-verification.json` and `review.jpg` in the
same directory. Far-side final contacts remain partly occluded by the unchanged
architecture; the long plates are visible during descent. This limitation is retained
rather than changing the approved camera or hiding surrounding architecture.

Changes remain uncommitted. Full-model simplification and rollout have not begun.
