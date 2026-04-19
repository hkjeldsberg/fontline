# FontLine 
## LEGEND

Source of truth: [docs/plans/2026-04-18-001-feat-fontline-mvp-plan.md](docs/plans/2026-04-18-001-feat-fontline-mvp-plan.md)

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

## TODO 
- [] Add new tab "Din utvikling" which displays height and weight measurements. They should displayed as interactive graphs, and mobile friendly. Migrate data from the same Supabase project, but from the scheme "barnshli". Table is barnshli.growth_records. The user should also be able to upload new measurements (weight or height).


## TODO
- [x] Add possibility to upload multiple images — `UploadDropzone` now accepts `multiple` files (drag-drop or picker), processes them sequentially, appends all detected crops to `unassigned[]`.

## TODO
- [x] Default scale options 0.5/0.75/1.0/1.25 — preset buttons next to the scale input (press-state matches current value). (2026-04-19)
- [x] Preview was blank on first paint — rewrote with ResizeObserver so it repaints once the container has width, removed the silent `catch`, added an empty-session placeholder, and fixed a DPR transform that compounded on rerender. Errors now surface inline. (2026-04-19)
- [x] Remove-glyph button in the editor toolbar with a two-click confirm; wipes the DB row too. (2026-04-19)
- [x] Widened the editor: BaselinePaper column is 3fr and the paper resizes via ResizeObserver to fill it; workspace capped at 1600 px and centred. (2026-04-19)
- [x] Font family switcher in the top bar — lists all fonts with glyph counts, "+ New family" button, name edits persist on blur via `renameFont`. Existing `fonts` table already supports N families; no schema change needed. (2026-04-19)
- [x] Glyph rotation — `rotation` column added via `supabase/migrations/2026-04-19-001-add-rotation.sql`, wired through types/persistence/store/buildFont/BaselinePaper. Rotates around the glyph centre, with a degree input, ±5° steppers, and a 0° reset. Applied consistently in live preview and exported TTF. (2026-04-19)
- [x] Big ▲/▼/±/−5/+5 step buttons next to the number inputs, plus a WebKit spinner size bump in theme.css. (2026-04-19)

### You need to run this once
- Apply `supabase/migrations/2026-04-19-001-add-rotation.sql` in the Supabase SQL editor (adds the `rotation` column). Existing rows default to 0°.


## Implementation units

- [x] **Unit 1** — Project scaffold + tooling (Vite + React + TS + Vitest) · 2026-04-18
- [x] **Unit 2** — Supabase schema + persistence library · 2026-04-18
- [x] **Unit 3** — Upload + preprocessing pipeline (HEIC, contrast, Otsu threshold, blur, sharpen) · 2026-04-18
- [x] **Unit 4** — Segmentation + vectorisation in a Web Worker · 2026-04-18
- [x] **Unit 5** — Session store + char mapping UI (Filmstrip, CharPicker) · 2026-04-18
- [x] **Unit 6** — Glyph editor + baseline drag + live preview · 2026-04-18
- [x] **Unit 7** — Manual glyph canvas (Fabric.js + @erase2d/fabric, ghosting) · 2026-04-18
- [x] **Unit 8** — Font build + export via opentype.js + storage upload · 2026-04-18
- [x] **Unit 9** — Session recovery + end-to-end wiring + dark-mode polish · 2026-04-18

## Test + build status (as of 2026-04-18)

- [x] 48/48 unit tests pass (`npm run test`)
- [x] TypeScript strict — no errors (`npm run typecheck`)
- [x] Production build succeeds (`npm run build`) — main bundle 643 kB (198 kB gz), heic-to lazy chunk 2.7 MB
- [x] Dev server serves HTTP 200 on `http://localhost:5173/`

## Blockers / needed from user

- [ ] Supabase project URL + anon key → paste into `.env` (currently placeholder)
- [ ] Run `supabase/schema.sql` against the project (creates `fontline` schema + tables)
- [ ] Dashboard → Project Settings → API → *Exposed schemas* → add `fontline`
- [ ] Create the public `font-assets` bucket in the Supabase dashboard

## Deferred (tracked but out of MVP scope)

- [ ] Cron cleanup of `.ttf` files older than 30 days (PRD §7.6)
- [ ] Pressure-sensitive brush (PRD §3.3)
- [ ] Full nodes-and-handles path editor (PRD §3.3)
- [ ] Bundle-size optimisation: split main bundle below 500 kB threshold
- [ ] Replace imagetracerjs with potrace-wasm if 5-second budget is missed on real scans

## Manual verification checklist (pre-ship, requires real Supabase credentials)

- [ ] Drop a photo → segmentation produces glyphs in < 5 s
- [ ] Assign a glyph to 'A' — row appears in `glyph_configs`
- [ ] Drag a glyph on baseline — offset persists across page reload
- [ ] Draw 'å' on manual canvas with 'a' ghosted underneath
- [ ] Export + upload — `.ttf` appears in `font-assets` bucket
- [ ] "Copy URL" button yields a working public link
- [ ] Exported `.ttf` installs on Windows
- [ ] Exported `.ttf` installs on macOS
- [ ] Exported `.ttf` renders correctly in Figma
- [ ] Exported `.ttf` renders correctly in an Adobe app
- [ ] Norwegian string "Blåbærsyltetøy" renders in the live preview
