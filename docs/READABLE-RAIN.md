# Readable LEGO rain refinement

The final approved 2,145-piece definition is unchanged, verified against the saved benchmark. Architecture, interiors, colours, materials and final camera orientation remain intact.

## Motion changes

- Reduced independent falling events from 1,518 to 531: 305 individual pieces and 226 compact local assemblies, a 65% reduction. Larger standard bricks and plates retain individual trajectories. Small neighbouring details share movement; constituent geometry is not replaced or removed.
- Increased visible travel: units begin in the sky region, at least 22 model units above their destinations. Most lower units start around height 52–55; the tallest final feature is approximately 38.55 units high.
- Removed the grainy 120 ms entry fade. Pieces enter at full size and opacity in the upper rain region, rather than fading into existence near their destination.
- Replaced the prolonged ease-out descent with brief acceleration, clear constant-speed travel, a short deceleration and a tiny final seating movement. Motion is vertical.
- Broadened deterministic timing offsets within construction stages so adjacent pieces do not descend as one synchronised surface. Spatial dependencies retain bottom-up assembly.
- Extended the timeline to 3,900 ms. All pieces settle by 3,750 ms; the existing continuous rotation brakes into the original hero orientation by the deadline.

The intentional trade-off is that small decorative clusters land as preassembled units rather than thousands of individually falling fragments. Some upper tower details therefore read as small assemblies. The foundation remains the busiest portion of the sequence, but large plates now fall independently.

## Verification

- Production build passes; existing bundle-size advisory remains.
- All 16 tests pass, including deterministic replay, exact completion, monotone descent, stage continuity, large-part independence and preserved interiors.
- Final recorded replay: 3,916.7 ms wall-clock completion, 59 average render updates per second, 22.9 ms maximum frame interval. Final displacement is zero; 2,145 final pieces. No browser console errors observed.
- Live canvas recording at real-time 1×, encoded without changing elapsed timestamps. Includes empty lead-in and completed hold. The recording composites selected editorial text around the live model; the screenshot shows the actual full page.
- Reviewed progression images for visible descent, separated arrivals, tower ordering and final framing. The upper-entry boundary still introduces units into view, but this occurs well above the architecture rather than near landing.

## Review artifacts

- `.qa/cinematic/readable-rain-1x.mp4`
- `.qa/cinematic/readable-final.jpg`
- `.qa/cinematic/readable-review.jpg`
- `.qa/cinematic/readable-metrics.json`

No sound or sectional interaction added. Changes remain uncommitted.
