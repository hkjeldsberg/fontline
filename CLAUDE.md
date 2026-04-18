# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**FontLine** — web app for converting photos of hand-drawn alphabets into downloadable `.ttf` font files.

Core flow: upload image → segment glyphs → vectorize → adjust alignment → export `.ttf`.

## Tech Stack

- **Frontend:** React (preferred) or Vue.js
- **Canvas/Vector:** `Fabric.js` or `Paper.js` for glyph editing and manual drawing
- **Font Generation:** `opentype.js` — converts SVG paths to `.ttf` tables
- **Backend/DB:** Supabase (no RLS — public-first, anon key only)
- **Vectorization:** Potrace-based SVG tracing from raster segments

## Architecture

### Data Flow

```
Image Upload → Contour Detection → Individual SVG Blobs
                                        ↓
                              Glyph Editor (offset/scale)
                                        ↓
                         opentype.js → .ttf → Supabase bucket
```

### Supabase Schema (No RLS)

| Table/Bucket | Key Columns | Notes |
|---|---|---|
| `fonts` | `id` (UUID), `name`, global settings | RLS disabled, anon CRUD |
| `glyph_configs` | `font_id`, `char_code`, `vertical_offset` (int), `scale` (float), `svg_path` (text) | RLS disabled, anon CRUD |
| `font-assets` bucket | `[font_id].ttf` | Public read/write |

**Session model:** `font_id` (UUID) stored in `localStorage`. No auth. Auto-save on glyph drag `onMouseUp` via `supabase.from('glyph_configs').upsert(...)`.

### Character Set

Standard Latin (A-Z, a-z) + Norwegian (æ, ø, å uppercase/lowercase) + punctuation (`! ? . , : ; - _ ( ) " ' @ # &`).

## Key Features

- **Preprocessing filters:** Contrast, Thresholding, Sharpening/Blurring before vectorization
- **Glyph Editor:** Per-glyph vertical offset + scale; drag-and-drop baseline on virtual lined paper
- **Live Preview:** Real-time text rendering with custom strings (supports Norwegian: "Blåbærsyltetøy")
- **Manual Canvas:** Vector brush + eraser + ghosting (show similar glyph as faint background)
- **Filmstrip View:** Bottom-docked gallery of all detected glyphs
- **Export:** `.ttf` → Supabase public bucket + "Copy Font URL" button
- **Session Recovery:** On refresh, pull `font_id` from `localStorage` and restore `glyph_configs`

## Constraints

- Image → vector conversion must complete in < 5 seconds
- Generated `.ttf` must install on Windows and macOS and work in Adobe/Figma
- UUID per font session prevents accidental overwrites (no RLS isolation)
- `svg_path` must be high-precision to preserve handwriting texture across sessions
- Do not use any **git** commands
