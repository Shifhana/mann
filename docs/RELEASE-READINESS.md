# First public release review — 18 November 2026

Status: release candidate validated locally; Git checkpoint authorised, remote preview pending repository/project configuration. Branch: feature/human-scale-figures. No merge or production deployment is authorised.

## Confirmed blockers fixed

- Removed development-only checks at both startup and renderer entry points. The root page now includes the approved landscape and architectural plan in production. Comparison modes, window debug APIs and the recording endpoint remain development-only.
- Changed the viewport's semantic role from image to group: its keyboard plan control must not be hidden inside an atomic image role. Updated the Sound control's accessible description to cover all sounds.
- Improved postcard metadata contrast in both DOM preview and canvas export. Coordinates: #AEAEAE → #77716B (2.11:1 → 4.58:1). Location: #9F8F80 → #807060 (2.97:1 → 4.53:1). Building name remains #583622 (10.15:1). The ivory background, artwork, typography and dimensions are unchanged.
- Added Brickit page/social metadata and a 1200×630 social image captured from the actual approved interface. Retained and verified the existing sandstone-tower SVG favicon.
- Added Vercel Vite settings: npm ci, npm run build, dist output, root-relative assets and clean URLs. Root-only application: no catch-all rewrite to hide missing assets. QA artifacts are excluded from Vercel uploads.

## Verification

- TypeScript and production build passed; 130 automated tests passed. Lockfile/dependencies were not changed.
- Actual local production preview at http://127.0.0.1:4173/, without preview query flags or exposed development globals.
- All 1,911 independent pieces; final animation offset zero. Representative build duration 5011.3 ms. Initial loading/driver warmup before construction measured 3292 ms; full landscape completed 9804 ms after navigation. These are local hardware measurements, not network guarantees.
- Six visitors are covered by geometry, collision, concealed-recycling, continuity and reduced-motion regression tests and visible in production screenshots. Their paths/geometry were not changed by release work.
- Production interactions passed: sea/wind hover playback through one shared AudioContext; no hover-movement restarts; tree click; pointer and keyboard plan reveal/restoration with four distinct completion sounds; Tamil heading; ticker hover/focus pause; LEGO connector hover; repeated Rebuild; postcard readiness, modal focus trap, Escape, backdrop close and PNG download.
- Export is 3000×2442. Its actual scene artwork is pixel-identical to the previous approved scene capture. Only metadata colour changes are intended.
- All four desktop sizes fit with zero page overflow; viewport ratios measured within .002 of 1.618. Controls remain outside the rendered temple area.
- No unexpected browser console errors or failed network responses. Favicon, sharing image, fonts and audio return expected content types. WebGL-disabled and JavaScript-disabled fallback messages passed. Hidden page rendering stops.
- HTTPS origin/canonical/social metadata substitution tested. Local build omits a canonical rather than inventing a domain; deployed builds use SITE_URL or Vercel's production/deployment origin.

## Performance — Intel HD 630, Chrome, no recording or test-suite load

Short sequential samples from the production build; these are observations, not before/after optimisation claims. There is no guarantee of consistent 60 FPS. The same scene remains visually intact.

| Desktop | Exterior FPS | Exterior p95 / maximum gap (ms) | Plan FPS | Plan p95 / maximum gap (ms) |
| --- | ---: | ---: | ---: | ---: |
| 1366×768 | 59.1 | 19.0 / 39.9 | 54.6 | 21.0 / 23.3 |
| 1440×900 | 51.3 | 22.6 / 38.5 | 46.9 | 24.9 / 29.1 |
| 1536×864 | 51.9 | 22.1 / 41.6 | 44.6 | 27.4 / 29.6 |
| 1920×1080 | 46.5 | 29.3 / 45.5 | 38.3 | 48.4 / 126.9 |

The sampled initial construction averaged 47 FPS with a 50.1 ms maximum gap. Host/GPU variability remains; no speculative optimisation or quality reduction was applied in this release pass.

## Remaining limitations and release handoff

- Set the final HTTPS SITE_URL if using a custom domain. Actual Vercel routing, HTTPS, caching and social-network unfurling still require a post-deployment smoke test; no deployment was authorised.
- Desktop Chrome is verified. Mobile, Safari and Firefox are not certified by this pass. WebGL2/hardware acceleration is required for the interactive scene.
- Main-page location contrast is now #76695C on #F3EFE8 (4.64:1). Only its colour changed; font, geometry and hierarchy remain fixed. This resolves the identified label contrast issue, but a full WCAG conformance audit is not claimed.
- Integrated-GPU construction/plan playback can fall below 60 FPS; the measurements above are not a clean-60 claim. Shader preparation can leave a multi-second initial loading interval on this machine.
- Architectural layout is a stylised model, not a surveyed reconstruction. Exterior visitor recycling pauses when plan mode exposes the concealment areas.
- Temporary .qa and .playwright-mcp data, design-qa.md and shore-temple-desktop-completed.png were not promoted into release assets or staged. The intentional public/social-preview.png is the only new release artwork.

Screenshots, exact browser assertions and performance data are in ignored .qa/release/. Vercel preparation follows https://vercel.com/docs/frameworks/frontend/vite. No package installation, feature redesign or deployment was performed.

## Release-candidate follow-up

The browser computed main-label contrast as 4.6439897:1 using rgb(118,105,92) against the actual rgb(243,239,232) background. DM Sans 500, 14px font size and 21px line height are unchanged. Preview social images use the preview deployment origin; canonical metadata retains the configured public origin. The release diff excludes recordings, QA captures and unrelated local review files through explicit ignore rules.

Target repository: Shifhana/brickit (Public, empty initial repository); target Vercel project: brickit in the verified personal workspace shifhanas-projects. Production branch must remain main. The local release branch and all existing commits/branches are preserved. GitHub repository creation/browser sign-in is still required before remote push; project linking and an explicit preview-target deployment follow that setup. Do not import with a production deployment or merge the release into main.
