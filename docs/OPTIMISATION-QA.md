# Optimisation verification

- Production build: passed (`npm run build`). Vite retains its advisory about the Three.js bundle exceeding 500 kB.
- Tests: 11 passed (`npm test`), including catalogue dimensions/evidence, chamber voids, entrances, timeline deadline and deterministic replay.
- Piece count: 2,492 (2,464 catalogue-backed, 28 explicit exceptions).
- Desktop 1440 × 960: recording completed at 2,822.4 ms; final offset 0; 180 draw calls; 1,494,284 rendered triangles. Mean measured render rate during capture: 28 fps; unrecorded pass: 42 fps. These are local measurements, not a universal frame-rate guarantee.
- Mobile 390 × 844: completed at 2,812.6 ms, final offset 0, 49 fps in the checked pass. Base and finials fit the frame.
- Browser console: no errors in the checked session.
- Video: `.qa/optimised-construction-1x.mp4`, recorded from the actual live renderer at wall-clock speed, with a final hold. Converted to 30 fps without speeding up time. UI text is composited by the development recorder; this is not an OS screen capture.
- Screenshots: `.qa/optimised-isometric.jpg`, `.qa/optimised-closeup.jpg`, `.qa/optimised-mobile.jpg`.
- No section interaction added; no commits created. This workspace currently has no Git repository.
