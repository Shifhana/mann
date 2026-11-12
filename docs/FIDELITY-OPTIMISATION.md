# Visual-fidelity optimisation

## Result

Starting benchmark: **2,492 pieces**. Delivered: **2,145 pieces**, a reduction of **347 (13.9%)**. There are 2,117 catalogue-backed pieces across 46 types and the same 28 custom architectural details as before. No commits were made.

## Progressive audit and decisions

| Pass | Pieces | Decision |
|---|---:|---|
| Approved benchmark | 2,492 | Frozen before editing; generator checked against saved JSON |
| Concealed consolidation | 2,430 | 232 fully concealed box records identified; merge only eligible rectangular unions |
| Plain masonry consolidation | 2,145 | Delivered; detailed exterior framing protected |
| Decorative consolidation | 2,048 | Rejected as default; taller merged pilasters/niche elements lose visible course articulation |

The audit did not find wholly redundant box pieces safely contained inside a single same-colour box with bevel/stud clearance. It therefore deletes no masonry and hollows out no towers. Replacements preserve the exact occupied rectangular union, colour, architectural group and assembly stage. Sacred interior objects, all slopes, caps, finials and Nandi assemblies remain unchanged. Recomputed section membership supports future capped cuts through the new larger blocks.

Net savings by role: foundation 122; plain walls 149; roofs/cornice substrate 64; floors 2; concealed detail masonry 10. Larger verified parts include 2×10 and 4×6 bricks and 4×12, 6×12, 6×16, 8×16 and 16×16 plates. The full inventory and official LDraw source links are in PARTS-AUDIT.md; fetched headers are in ldraw-verification.json.

The under-1,000 goal was not reached. There are already 1,011 detail-role pieces in the benchmark. Achieving a substantially lower count would require more extensive redesign or detail removal; that conflicts with the visual benchmark. This is a conservative consolidation result, not a proof of the mathematical minimum.

## Visual comparison and trade-offs

Both pairs use identical 1440×960 viewports, orthographic view directions, lighting, final root orientation and framing. Overall occupied bounds are unchanged. Comparison strips put before on the left and after on the right:

- `.qa/fidelity/hero-comparison.jpg`
- `.qa/fidelity/closeup-comparison.jpg`

Individual full-resolution screenshots are alongside the strips. The close-up deliberately crops the model to inspect facade and tower detail. There are fewer joints in plain wall/foundation courses; decorative courses remain articulated. No fake seams were added to pretend a larger part is multiple bricks. Static model-region SSIM was 0.999445 for the hero view and 0.998696 for the close-up. These measurements supplement visual inspection; they do not imply pixel identity or establish architectural accuracy.

## Verification and animation

- Production build passed; 13 tests passed. Tests cover catalogue evidence/dimensions, exact non-overlapping replacement unions, colour/stage preservation, unchanged sculptural records and bounds, real chamber voids, entrances, replay determinism and the deadline.
- The live 1× recording completed at **2,806.4 ms** with final displacement **0** and stopped root rotation. Measured mean rendering rate during capture: **29 fps**. Rendered triangle count: 1,418,852; draw calls: 220. Fewer pieces does not necessarily mean fewer geometry/material batches (the benchmark used 180 draw calls).
- An embedded-browser scheduling issue initially delayed visible frames beyond three seconds. A 30 Hz fallback now keeps visible builds progressing when native animation frames stall, and the wall-clock deadline draws the final state directly. Native rAF remains preferred. Static rendering stops afterwards. A suspended/blocked browser cannot guarantee presentation timing; elapsed state still resolves to the completed model on resumption.
- `.qa/fidelity/construction-1x.mp4` is a wall-clock live-renderer recording with a final hold. It is encoded at 30 fps without speeding up playback; renderer frames may repeat. Editorial text is composited by the existing development recorder, not captured from the OS screen.
- Browser console showed no errors. No section interaction was introduced.
