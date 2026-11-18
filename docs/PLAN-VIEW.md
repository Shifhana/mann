# Architectural plan readability preview

Development preview: `http://127.0.0.1:5173/?preview=plan`. Hover reveals the section; leaving restores the exterior. The production route is unchanged.

## Cut geometry and material zoning

The earlier rejected treatment joined the nominal wall footprints into one dark sheet and added an edge collar. That geometry has been removed. The active cap generator slices the actual rendered brick bodies and studs, retaining their bevels and assembly joints. It creates only zero-thickness horizontal faces: no vertical extrusion, floor fill, nominal expansion or bridged chamber voids.

This refinement retains that geometry and makes the genuinely cut faces more distinct: matte warm brown `#9C7350`, with restrained `#765239` contour bands .20 model units wide. The contour mask traces exposed wall boundaries rather than outlining every brick joint. Original vertical wall faces, thresholds and plinths retain their sandstone materials. Enclosure cuts, where present during the transition, receive less emphasis than shrine cuts.

## Spatial clarity

The horizontal level is Y=5.0, above the existing floors (4, 3.6, 2.8) and below all lintels (8.8, 8.4, 6.4). It retains 1.0, 1.4 and 2.2 units of main, western and Vishnu wall height respectively. This modest increase from Y=4.75 gives the fixed isometric view more visible wall depth. The lower enclosure coping is now uncut and remains light sandstone.

Floor-only contact shading follows the existing clear chamber bounds and real main entrance porch. It is strongest at wall-floor junctions, fades towards the floor centres and excludes actual door axes and the porch's open ends. It does not darken vertical walls or imply additional passages. Existing sacred furnishings remain whole. Blind-niche relief and Nandi sculptures are omitted as the plane passes their tops to avoid floating slices; the original model and construction inventory remain intact.

All three chambers, entrance directions, wall thicknesses and spatial offsets are those of the source model. No rooms or connections are invented. Existing floor/plinth overlaps are preserved rather than rebuilt. The north junction remains masonry, not a fabricated circulation route.

## Section-only surroundings and exact restoration

### Interior readability refinement

The approved Y=5.0 cut, warm-brown poche, source geometry and 500 ms hover timing remain unchanged. Existing upward-facing chamber floor surfaces receive a restrained pale-sandstone tint (`#E4CEA5`, 70% mix). The actual wall-depth thresholds use a separate sandstone tone (`#C7A474`, 65% mix), while the main porch continues the lighter floor treatment. These are surface material masks, not new meshes or projected path diagrams. Sacred furnishings and vertical wall colours are excluded from the floor tint.

Masks are derived from the three source chamber bounds, actual wall extents and the existing main porch. The main east threshold is X=13..17, Z=0..4; the western shrine threshold is X=-27..-24, Z=-6..-2; the Vishnu east threshold is X=-11..-9, Z=1..5. Only real floor/underlying plinth elevations are eligible. No highlighted corridor bridges the enclosed north junction or courtyard.

Subtle section-only indirect fill lifts the existing inner wall faces and floors while retaining contact depth. Major chamber and doorway contour ink keeps its approved strength; secondary external ink is reduced by 18%, preserving every LEGO contour and cap vertex. All tint and fill are driven by the existing hover strength and become exact no-ops at exterior state.

The supplied plan and existing geometry retain opposing Shiva entrances and a separate east-facing Vishnu chamber. A continuous internal route through all three sanctums is not established by the current model and has not been invented. The original secondary plinth overlaps a narrow part of the Vishnu chamber at Y=3.6 above its Y=2.8 floor. Both existing levels remain visible where the fixed camera permits; no replacement floor hides that limitation.

Current interior-review artifacts, including the approved before image, identical-camera after image, an all-three-chamber crop and 1x hover recording, are in `.qa/plan-interiors/`. The latest full test run passes 83 tests. Browser validation confirms pixel-identical exterior restoration and zero camera/model/landscape/border pose differences.

Tree foliage gently shifts towards a quieter sage during the same hover clock. Placement, geometry, growth motion and reveal opacity are unchanged. Sand, sea, trunk material and coastal animation are untouched. Hover-out restores the exact original foliage colours and removes the floor contact treatment.

The 500 ms hover timeline, stable full-temple interaction envelope and 12-pixel exit hysteresis remain unchanged. Camera matrices, zoom, root transform, all 1,911 source pieces, construction, sound, progress border, layout and controls remain fixed or follow their existing approved behaviour. Rebuild resets the section to exterior. Production excludes this development-only section module.

## Validation and review

Unit tests cover exact cap bounds, closed horizontal faces, genuine chamber voids, entrance clearance, material zoning, floor-only contact shading, open doorway shadow boundaries, foliage restoration and unchanged hover timing. Browser checks compare exterior restoration, replay and the ordinary coastal preview pixel for pixel; audit camera/model/landscape/border transforms; cross clipped towers, brick seams and chamber gaps; and exercise reversal, keyboard focus, reduced motion, Rebuild and mute.

Same-camera before/after screenshots, high-density close-up crops, browser results and an actual-time hover recording are in the ignored `.qa/plan-readability/` directory. Crops use a higher pixel density, not a changed camera or zoom.
