# Shore Temple — An architectural miniature

A local TypeScript / Vite / Three.js scene presenting a static, warm stone-toned LEGO-style Shore Temple. Phases 1 and 2 are implemented: a completed architectural miniature and a replayable construction animation. Section interaction remains deferred.

## Run

Requires Node.js 22.12+ (developed on Node 24).

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite. `npm run build` type-checks and produces the static `dist/` directory; `npm run preview` serves that production build. `npm test` checks architectural voids, doorway clearance, deterministic pieces, section membership, and generated geometry.

The coastal landscape experiment is available only in development at `/?preview=coast`.
See [the coastal preview notes](docs/COASTAL-PREVIEW.md) for timing and verification.

## Architecture and reference hierarchy

The supplied `images.png` plan and `shoretempleplan.jpg` plan/section establish relative footprints, the offset shrine axes, wall thickness, stepped towers, and chamber volumes. Supplied photographs guide the silhouette and simplified roof / facade details. The small Shiva shrine faces west; the larger shrine and the low Vishnu shrine face east. See the [Archaeological Survey of India description](https://asi.nic.in/pages/WorldHeritageMahabalipuram).

The plate `images (3).jfif` also depicts Kailasanatha at Kanchipuram and labels its Shore Temple view as a conjectural restoration. Neither its unrelated temple nor its speculative lost buildings are reproduced. The original references remain in the user's `refre` directory; they are not runtime assets or redistributed with the site.

This is a clean, reference-derived miniature, not a surveyed reconstruction or a physically buildable LEGO instruction set. Carvings and Nandi figures are deliberately abstracted into small part assemblies. The main shrine has five stepped tower tiers; the secondary shrine has three; the connecting shrine remains low and flat-roofed. No imaginary occupied tower storeys are added.

## Model organisation

- `src/temple/model.ts` defines architecture in stud pitches (+X east, +Z south). One plate is 0.4 units; a standard brick is 1.2. Foundations, wall courses, thick chamber walls, recessed niches, interiors, cornices, roof mass, caps, and enclosure details remain discrete pieces.
- `src/temple/types.ts` defines serialisable `BrickRecord` and `TempleDefinition` data. Every piece has an ID, local final transform, shape, material role, architectural group, assembly stage, and section membership. Integrated studs move with their parent piece.
- `src/temple/geometry.ts` caches reusable closed part geometries. `render.ts` batches them by shape and material, retaining an ID → instance → final matrix mapping. All instances belong to one model root.

The four materials are sandstone `#B98D60`, honey `#D4B184`, toasted stone `#99704C`, and warm brown `#73513A`. Assignments follow architectural roles, not random per-brick colour changes. The scene renders continuously only during construction, then stops when idle. A 3.9-second wall-clock timeline drives GPU instanced attributes and matching depth shaders. The camera fits both the final architecture and active falling bricks. Reduced-motion users see the completed model immediately.

## Preparation for subsequent phases

**Phase 2:** Implemented in `animation.ts` and `render.ts`. All pieces participate in overlapping stage-ordered drops; full-size pieces enter their falling wave at the upper rain-entry height. No geometry is omitted from the finished model. Instance matrices remain immutable; the shader displacement becomes exactly zero at completion. A 25.7-degree root rotation ends at zero, matching the hero camera. Rebuild uses the same deterministic trajectory data. Late frames and background-tab resumption snap to the correct wall-clock state.

For review, `?record=1` in development exposes a real-time 1× canvas recording control. It saves `.qa/construction-1x.ivf` through a local development endpoint. This control and recorder are excluded from production. The recording contains the live model canvas and title/location/rebuild text; it is not an OS screen capture.

**Phase 3:** Genuine chamber floors, inner wall faces, ceilings, lingam assemblies, and an abstract reclining Vishnu are already enclosed inside the completed model. The stepped section path passes through each offset chamber. Piece membership is conservative at section jogs. `crossing` pieces will require capped, paired geometric fragments in Phase 3; membership alone is not a finished cutaway. Near-side removal, clipping/capping, accessible toggles, and transition behaviour are intentionally deferred.

## Visual verification

Development-only URLs `?view=plan`, `?view=elevation`, and `?view=rear` provide fixed alternate inspection cameras. Production ignores these parameters and always presents the approved hero camera. These are inspection views, not visitor controls. Renderer metrics appear as `data-*` attributes on `#temple-viewport` for checking readiness and idle rendering.

The site bundles Cormorant Garamond and DM Sans through Fontsource (SIL Open Font License). It makes no third-party font or model requests at runtime. No account, backend, or analytics are required.

## Catalogue optimisation

The current model contains 2,145 pieces, including 2,117 catalogue-backed elements and 28 explicit architectural exceptions. See [the parts audit](docs/PARTS-AUDIT.md) for inventory, LDraw sources, geometry simplifications and the exceptions. Large surfaces use standard plates and tiles; small cornice and entrance assemblies remain detailed. Geometry orientations are canonicalised for instanced batching. The motion uses deterministic spatial ordering, coordinated decorative assemblies and monotone seating, with all pieces settled by 3.75 seconds before the 3.9-second rotation deadline.

## Visual-fidelity consolidation

The 2,492-piece approved benchmark remains reproducible through the development-only `?compare=benchmark` URL. The default model uses 2,145 pieces. `consolidate.ts` replaces exact rectangular unions with verified larger standard parts, preserving masonry volume, material, group, assembly stage and section classification. Sculptural geometry and sacred interiors are unchanged. The more aggressive 2,048-piece QA variant is not the delivered default because it loses visible decorative brick courses. See [the comparison report](docs/FIDELITY-OPTIMISATION.md).

Animation still uses the 3.9-second wall-clock timeline. A 60 Hz fallback runs only when a visible embedded surface delays requestAnimationFrame; native frame callbacks cancel that fallback when healthy. The deadline renders the completed state directly. Both schedules stop when construction completes.

## Cinematic construction update

See [the cinematic verification report](docs/CINEMATIC-ANIMATION.md) for current motion design, measured frame rates, exact model preservation and the real-time review recording. The development recorder uses explicit wall-clock timestamps in a VP8 IVF file; convert to MP4 without retiming for playback.

The latest readable-rain refinement reduces 1,518 independent falling events to 531 (305 individual pieces and 226 compact assemblies), while preserving all 2,145 final pieces. See [readable rain review](docs/READABLE-RAIN.md).
