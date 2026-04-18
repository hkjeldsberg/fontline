import { getSupabase, type FontRow, type GlyphConfigRow } from './supabase';
import type { CharCode, FontSession, GlyphConfig } from '../types';
import { DEFAULT_FONT_METRICS } from '../types';

const BUCKET = 'font-assets';
const LS_KEY = 'fontline:font_id';

export class PersistenceError extends Error {
  public readonly source: unknown;
  constructor(message: string, source?: unknown) {
    super(message);
    this.name = 'PersistenceError';
    this.source = source;
  }
}

export interface FontSummary {
  id: string;
  name: string;
  updatedAt: string;
  glyphCount: number;
}

/** List all fonts in the project. No auth means this lists everyone's fonts — fine for MVP. */
export async function listFonts(): Promise<FontSummary[]> {
  const sb = getSupabase();
  const { data: fonts, error } = await sb
    .from('fonts')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new PersistenceError(`Failed to list fonts: ${error.message}`, error);
  if (!fonts) return [];

  // Cheap glyph count per font via a single query grouped client-side.
  const ids = (fonts as { id: string }[]).map((f) => f.id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: configs } = await sb
      .from('glyph_configs')
      .select('font_id')
      .in('font_id', ids);
    counts = (configs ?? []).reduce<Record<string, number>>((acc, row) => {
      const fid = (row as { font_id: string }).font_id;
      acc[fid] = (acc[fid] ?? 0) + 1;
      return acc;
    }, {});
  }

  return (fonts as { id: string; name: string; updated_at: string }[]).map((f) => ({
    id: f.id,
    name: f.name,
    updatedAt: f.updated_at,
    glyphCount: counts[f.id] ?? 0,
  }));
}

/** Rename a font. Updates `updated_at` so list ordering reflects recent activity. */
export async function renameFont(fontId: string, name: string): Promise<void> {
  const { error } = await getSupabase()
    .from('fonts')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', fontId);
  if (error) throw new PersistenceError(`Failed to rename font: ${error.message}`, error);
}

export async function createFont(name = 'FontLine'): Promise<string> {
  // DB columns are snake_case; don't spread the camelCase constant directly.
  const { data, error } = await getSupabase()
    .from('fonts')
    .insert({
      name,
      units_per_em: DEFAULT_FONT_METRICS.unitsPerEm,
      ascender: DEFAULT_FONT_METRICS.ascender,
      descender: DEFAULT_FONT_METRICS.descender,
    })
    .select('id')
    .single<{ id: string }>();
  if (error) throw new PersistenceError(`Failed to create font: ${error.message}`, error);
  if (!data) throw new PersistenceError('createFont returned no data');
  return data.id;
}

export async function loadFont(fontId: string): Promise<FontSession | null> {
  const sb = getSupabase();
  const { data: font, error: fontErr } = await sb
    .from('fonts')
    .select('*')
    .eq('id', fontId)
    .maybeSingle<FontRow>();
  if (fontErr) throw new PersistenceError(`Failed to load font: ${fontErr.message}`, fontErr);
  if (!font) return null;

  const { data: rows, error: rowsErr } = await sb
    .from('glyph_configs')
    .select('*')
    .eq('font_id', fontId);
  if (rowsErr) throw new PersistenceError(`Failed to load glyphs: ${rowsErr.message}`, rowsErr);

  const glyphs: Record<CharCode, GlyphConfig> = {};
  for (const r of (rows ?? []) as GlyphConfigRow[]) {
    glyphs[r.char_code] = {
      svgPath: r.svg_path,
      verticalOffset: r.vertical_offset,
      scale: r.scale,
      rotation: r.rotation ?? 0,
      sourceBounds: null, // not persisted; recomputed on demand
      updatedAt: r.updated_at,
    };
  }

  return {
    fontId: font.id,
    name: font.name,
    unitsPerEm: font.units_per_em,
    ascender: font.ascender,
    descender: font.descender,
    glyphs,
  };
}

export async function upsertGlyphConfig(
  fontId: string,
  charCode: CharCode,
  patch: Pick<GlyphConfig, 'svgPath' | 'verticalOffset' | 'scale' | 'rotation'>,
): Promise<void> {
  const { error } = await getSupabase()
    .from('glyph_configs')
    .upsert(
      {
        font_id: fontId,
        char_code: charCode,
        svg_path: patch.svgPath,
        vertical_offset: patch.verticalOffset,
        scale: patch.scale,
        rotation: patch.rotation,
      },
      { onConflict: 'font_id,char_code' },
    );
  if (error) throw new PersistenceError(`Failed to save glyph: ${error.message}`, error);
}

export async function deleteGlyphConfig(fontId: string, charCode: CharCode): Promise<void> {
  const { error } = await getSupabase()
    .from('glyph_configs')
    .delete()
    .eq('font_id', fontId)
    .eq('char_code', charCode);
  if (error) throw new PersistenceError(`Failed to delete glyph: ${error.message}`, error);
}

export async function uploadTtf(fontId: string, blob: Blob): Promise<void> {
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(`${fontId}.ttf`, blob, {
      upsert: true,
      contentType: 'font/ttf',
      cacheControl: '3600',
    });
  if (error) throw new PersistenceError(`Failed to upload font: ${error.message}`, error);
}

export function getFontPublicUrl(fontId: string): string {
  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(`${fontId}.ttf`);
  return data.publicUrl;
}

/**
 * On app start: pull the last font_id from localStorage if present, otherwise create
 * a new one. Handles the "localStorage has an id but the row was deleted" edge case
 * by creating a fresh font and overwriting the key.
 */
export async function getOrCreateSessionFontId(): Promise<string> {
  const existing = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
  if (existing) {
    const session = await loadFont(existing).catch(() => null);
    if (session) return existing;
    // Orphan id — fall through to create a fresh one.
  }
  const id = await createFont();
  if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, id);
  return id;
}

export function clearSessionFontId(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY);
}

/** Explicitly set the active session font (used by the family switcher). */
export function setSessionFontId(fontId: string): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, fontId);
}
