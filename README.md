# Brickit — Shore Temple

An interactive, 1,911-piece architectural miniature of the Shore Temple at Mahabalipuram. The five-second build, coastal reveal, horizontal plan section, six visitors, tree/water interactions, Tamil heading, ticker and postcard preview/export are enabled at `/` in production. Sound is muted until the visitor enables it.

## Local checks

Use Node.js 24 (Node 22.12+ is supported by Vite) and the checked-in package lock.

```sh
npm ci
npx tsc --noEmit
npm test
npm run build
npm run preview
```

`npm run build` includes TypeScript validation and generates `dist/`. Open the exact local URL printed by Vite. Desktop targets are 1366×768, 1440×900, 1536×864 and 1920×1080. WebGL2 and hardware acceleration are required. Mobile and other browsers require a separate QA pass.

## Vercel settings (prepared; not deployed)

- Framework: Vite; root directory: this repository.
- Install: `npm ci`; build: `npm run build`; output: `dist`.
- `vercel.json` records these settings. The application uses a single root route; no blanket SPA rewrite is needed. Asset URLs are root-relative and missing files remain real 404s rather than returning HTML.
- No backend, runtime secrets or additional packages are needed. `.vercelignore` excludes local review artifacts from uploads.
- Optionally set build variable `SITE_URL` to the final HTTPS origin (for example, your chosen custom domain). Otherwise metadata uses `VERCEL_PROJECT_PRODUCTION_URL`, falling back to `VERCEL_URL`. This supplies absolute sharing-image/canonical URLs at build time. Preview sharing images use the preview deployment host so they do not depend on an unpublished production site. Local builds without these values use a root-relative sharing image and omit canonical/og:url rather than inventing a public domain.
- `public/social-preview.png` is a 1200×630 capture of the approved interface and actual model. Retain the supplied favicon. Refresh the sharing artwork only when an approved appearance changes.
- After deployment, check actual HTTPS URLs, asset caching and social-network unfurling. Those cannot be verified from a local preview.

## Behaviour and accessibility

The main-page location label uses #76695C on #F3EFE8 (4.64:1 contrast), retaining its original typography and position. The fixed camera, five-second timeline and existing architecture remain unchanged. Hover or focus the completed temple to reveal its plan; leaving or moving focus away restores the exterior. Enter/Space and Escape are also supported. The viewport is an accessible group containing a separately named plan control. The heading and controls support keyboard focus; the ticker pauses on hover/focus. Reduced motion shows a completed, stationary model and disables decorative motion.

Visitors begin after the landscape settles. Exterior visitor recycling requires masonry concealment and pauses while plan view exposes reset locations. Figures and environmental interactions sleep when the page is hidden. Normal visitor movement intentionally renders while active.

The postcard is 602:490, exports to 3000×2442 PNG and always captures the finished exterior through a detached scene. Preview and export share the approved composition and DM Mono typography. Metadata colours were darkened for normal-text contrast on ivory: coordinates `#77716B`, location `#807060`; building name remains `#583622`.

## Architecture, assets and scope

This is a stylised, reference-derived miniature, not a surveyed reconstruction or a physically buildable instruction set. Shrine connections follow the existing model; no invented rooms or passages are added. See `docs/PLAN-VIEW.md` and `docs/COASTAL-PREVIEW.md` for historical implementation notes (their development-only status is superseded by this release).

Fonts are bundled locally with their Open Font Licences. Recorded construction contacts are CC0; provenance is in `public/audio/landing-prototype/LICENSE.md`. Environmental textures and plan clicks are original procedural synthesis. No external audio service, tracking or music is used. Brickit is an independent project; LEGO is a trademark of the LEGO Group, which does not sponsor or endorse this project.

Development-only comparison modes, diagnostics and the local `/__recording` middleware are not exposed by the production application. QA assets stay under ignored `.qa/`; they are not part of `dist/`.
