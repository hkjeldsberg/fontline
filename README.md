# FontLine

Turn a photo of your handwriting into an installable `.ttf` font — all in the browser.

## Stack

- Vite + React 18 + TypeScript
- Fabric.js v6 + `@erase2d/fabric` (manual glyph canvas)
- imagetracerjs (raster → SVG)
- opentype.js (SVG → TTF)
- Supabase (public-first persistence; no auth, no RLS)

## Getting started

```bash
npm install
cp .env.example .env
# paste your Supabase URL + anon key into .env
npm run dev
```

## Supabase setup

One-time:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor — this creates the `fontline` schema with `fonts` and `glyph_configs` tables, grants full anon access, and disables RLS.
3. **Expose the schema to PostgREST:** Dashboard → Project Settings → API → *Exposed schemas* → add `fontline`. Without this step every query returns a `schema must be one of...` error.
4. Create the `font-assets` storage bucket (public).
5. Copy the project URL and `anon` key into `.env`.

### Why no RLS?

This is intentional and documented in PRD §7. FontLine is a **public-first** utility: any anonymous visitor can create a font and share the URL immediately. We mitigate collision by generating a UUID per session (stored in `localStorage`) rather than by authorising writes. Don't "fix" this without reading the PRD.

Storage growth is bounded by a periodic cleanup job (>30 days) — deferred to a follow-up.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run test` — vitest
- `npm run typecheck` — strict TS check

## Layout

```
src/
├── app/          shell, layout, theme
├── components/   shared UI (Filmstrip, CharPicker)
├── features/
│   ├── upload/        dropzone + preprocessing filters
│   ├── segmentation/  connected-components + imagetracerjs worker
│   ├── editor/        glyph editor, baseline drag, live preview
│   ├── manual/        Fabric.js drawing canvas
│   └── export/        opentype.js font build + upload
├── lib/          supabase, persistence, heic, path utilities
├── store/        zustand session store
└── test/         vitest suites
```

See `docs/plans/2026-04-18-001-feat-fontline-mvp-plan.md` for the full plan.
