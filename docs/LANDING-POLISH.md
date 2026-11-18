# Landing physics and LEGO sound polish

Development preview: `/?preview=construction`. All 1,911 pieces, geometry, materials,
interiors, camera, rotation and layout are unchanged. Normal production construction
continues to use its existing implementation.

## Motion and sound

Descent remains constant-acceleration gravity (550 model units/s²), with no pre-contact
slowdown. The post-contact rebound is now a single exponentially damped lobe, returning
exactly to the approved final transform. Damping reduces the final approach velocity
and prevents repeated bouncing or hovering. Small/background parts retain their short
individual approaches and smooth entry; prominent parts retain readable longer falls.

The dry impact samples are real recorded LEGO contacts. Locking now uses separate
recordings of actual LEGO stud connections by LauraWebdev, licensed CC0. Source links
and processing details are in `public/audio/landing-prototype/LICENSE.md`.

Pitch, gain and contact-tail length vary deterministically with volume, impact speed
and estimated visibility. Heavy pieces have deeper contacts; visible faces are louder
than recessed/background elements. The impact envelope ends before it can mask the
locking transient. No synthetic rattle bed or music is added.

Physics and audio consume the same contact/seating records. In the full preview,
contact and lock sounds fire on the first actual rendered frame that reaches their
respective phase, correcting the previous audio lead. Late-frame recovery skips stale
voices; mute/replay cancel sources. Only the current accents are allocated, rather
than queuing the entire construction.

## Build, performance and preservation

- Production build passed; **44/44 tests passed**.
- Recorded completion **5,011 ms**, **55 FPS** average, **37.6 ms** longest frame interval.
- Separate real-browser control check: **56 FPS**, **21.2 ms** maximum frame interval.
- Muted default confirmed; mute removed all live sources; replay emitted 84 unique
  contact/lock keys with no duplicates; no voices remained after completion.
- All final offsets zero; no browser errors. Final PNG is byte-identical to the
  previous 1,911-piece model (SHA-256
  `9bacb8ca9ed4834bb984842159f1361fdf1d48da62f1c92b83b7567c1b61503d`).
- Captured peak amplitude 0.559, with clipping headroom.

## Independent audiovisual verification

A 4 ms, 12 kHz calibration burst went only to the recording bus before construction.
It establishes the audio/video clock origin independently of any brick landing. The
burst and preceding pre-roll are removed from both tracks; neither track is sped up.
The final clip contains only the actual captured construction playback.

Captured sample waveforms are correlated with the exact decoded, pitch-adjusted source
buffers and envelopes. Those detected attacks are compared with the first actually
rendered contact/seating frame and the corresponding encoded video frame. Probes span
foundation, plinth, enclosure, vestibule, main wall, tower courses and crown.

**16 audited impact/lock moments across eight pieces:**

| Comparison | Median | Worst absolute error |
|---|---:|---:|
| Sound vs actual rendered landing phase | +6.2 ms | 11.7 ms |
| Sound vs landing in delivered 60 FPS video | +1.0 ms | 10.6 ms |

Positive means sound follows the visual frame. Clock-calibration uncertainty is
approximately ±3 ms. Fifteen probes have high waveform confidence (correlation ≥0.88);
one tower locking click has moderate confidence (0.52) because it overlaps another
accent. Across all 84 emitted voices, 79 pass the 0.5 correlation threshold; quieter
background overlaps are not claimed as individually verified attacks.

The ideal continuous contact timestamp can fall between displayed frames. Sound now
follows the first displayed contact/seating phase, rather than anticipating it. This
adds 9–43 ms relative to the continuous mathematical timeline in the audited samples,
while preserving the much closer audiovisual alignment above.

Measurements cover captured digital playback, not device-specific speaker/DAC latency.
Trajectory tests verify nonnegative offsets, acceleration, damping and short-approach
support clearance. Original intentional final mesh intersections are preserved;
this is not a per-triangle collision proof or a geometry reconstruction.

## Review artifacts

In `.qa/landing-polish/`:

- `construction-1x.mp4`: complete 1× recording with captured sound and final hold.
- `landing-frame-checks.png`: real recorded fall/contact/lock crops for five examples.
- `sync-verification.json`: individual waveform results and confidence.
- `metrics.json`, `controls-check.json`: actual frame and playback evidence.

All changes remain uncommitted for review. No section interaction or new product UI.
