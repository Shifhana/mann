# Cinematic construction verification

## Delivered behavior

The approved 2,145-piece model is unchanged. Deep equality against `.qa/cinematic/approved-model.json` passes, including geometry records, transforms, colours, groups and interior/section membership. No architectural, material, editorial UI or final hero-camera changes were made.

The supplied LEGO video informed the controlled downward arrivals, continuous rotation and overlapping construction rhythm. The new deterministic 3,500 ms timeline builds foundations, shrine walls, tower courses, crowns and finials. Full-size pieces descend with subtle entry-height/timing variation, with no sideways scatter. Small decorative and sacred assemblies share rigid trajectories while remaining separate logical pieces. A spatial dependency pass orders vertically overlapping masonry. A 0.055-unit final seating movement is monotone, without bounce or overshoot. Every piece seats by 3,400 ms, before the rotation ends. Entries use a short 120 ms dither fade rather than abrupt visibility changes.

The root rotates approximately 25.7 degrees in one direction, with constant cruise speed and a continuous 400 ms deceleration into the unchanged hero angle. Dynamic framing accommodates falling pieces and returns to the original final framing. Initial load and Rebuild start empty and use the same plan. Reduced motion shows the completed model immediately.

## Performance and verification

- `npm test`: all 15 tests pass, covering timing, deterministic replay, seating continuity, overlapping stage activity, rotation, rigid small assemblies, architecture, interiors and catalogue geometry.
- `npm run build`: passes. Vite retains its existing >500 kB bundle-size advisory (578.46 kB JavaScript before gzip).
- Initial-load measured run: 3,504.1 ms, 60 average render updates/second, 20.4 ms maximum frame interval.
- Final recorded replay at 1440 × 960: 3,500.6 ms, 59 average render updates/second, 61.4 ms maximum frame interval. The occasional longer frame remains a limitation under simultaneous recording/build load; this is not a universal 60 FPS guarantee.
- Final displacement: exactly zero for all 2,145 pieces. 220 draw calls; approximately 1.42 million triangles. No browser console errors observed.
- GPU instance attributes drive motion without per-frame instance-matrix rewrites. Cached camera vectors and corner data avoid repeated allocations. Screen and shadow programs warm before the visible opening. Both native frame callbacks and the visible-surface fallback stop after completion.
- Visual review of the complete capture and extracted progression found no obvious final-frame popping, hovering, architectural penetration or long stage pauses. Dense foundation arrivals remain more visually crowded than the upper tower courses. Brief entry dithering is intentional.

## Review files

- `.qa/cinematic/shore-temple-rain-1x.mp4`: real-time 1× live-canvas capture, 1440 × 960, 30 FPS presentation, 5.57 seconds including approximately 0.25 seconds of empty opening and 1.8 seconds of completed hold. No speed-up or synthetic animation frames.
- Source `.qa/construction-1x.ivf`: 170 live captured frames, explicit wall timestamps from 1 to 5,555 ms. MP4 conversion preserves elapsed time; the 30 FPS conversion may repeat sampled frames.
- `.qa/cinematic/final-hero.jpg`: browser screenshot of the final approved appearance.
- `.qa/cinematic/final-motion-review.jpg`: three samples/second contact sheet.
- `.qa/cinematic/initial-metrics.json` and `replay-metrics.json`: measured browser data.

The development recorder composites the live WebGL canvas with selected UI text; the screenshot shows the actual full editorial interface. Video encoding uses WebCodecs timestamps and the standard IVF VP8 container. It is development-only, with no recording endpoint in production.

Changes remain uncommitted. Section interaction, sound and physics remain deferred.
