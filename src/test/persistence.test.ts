import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createFont,
  loadFont,
  upsertGlyphConfig,
  uploadTtf,
  getFontPublicUrl,
  getOrCreateSessionFontId,
  clearSessionFontId,
  PersistenceError,
} from '../lib/persistence';
import { __setSupabaseForTests } from '../lib/supabase';

type Row = {
  font_id: string;
  char_code: number;
  vertical_offset: number;
  scale: number;
  rotation: number;
  svg_path: string;
  updated_at: string;
};

type FontRow = {
  id: string;
  name: string;
  units_per_em: number;
  ascender: number;
  descender: number;
  created_at: string;
  updated_at: string;
};

// Minimal in-memory mock of the supabase-js surface this module touches.
function makeMock(state: { fonts: FontRow[]; configs: Row[]; uploads: Record<string, Blob> }) {
  const tableFonts = () => ({
    insert: (row: Partial<FontRow>) => ({
      select: (_: string) => ({
        single: async () => {
          const full: FontRow = {
            id: row.id ?? `font-${state.fonts.length + 1}`,
            name: row.name ?? 'FontLine',
            units_per_em: row.units_per_em ?? 1000,
            ascender: row.ascender ?? 800,
            descender: row.descender ?? -200,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          state.fonts.push(full);
          return { data: full, error: null };
        },
      }),
    }),
    select: (_: string) => ({
      eq: (_col: string, val: string) => ({
        maybeSingle: async () => {
          const found = state.fonts.find((f) => f.id === val) ?? null;
          return { data: found, error: null };
        },
      }),
    }),
  });

  const tableConfigs = () => ({
    select: (_: string) => ({
      eq: (_col: string, val: string) => ({
        // fake thenable behaviour for `await`
        async then(onFulfilled: (v: { data: Row[]; error: null }) => unknown) {
          const data = state.configs.filter((r) => r.font_id === val);
          return onFulfilled({ data, error: null });
        },
      }),
    }),
    upsert: async (row: Partial<Row>, _opts: { onConflict: string }) => {
      const idx = state.configs.findIndex(
        (r) => r.font_id === row.font_id && r.char_code === row.char_code,
      );
      const full: Row = {
        font_id: row.font_id!,
        char_code: row.char_code!,
        vertical_offset: row.vertical_offset ?? 0,
        scale: row.scale ?? 1,
        rotation: row.rotation ?? 0,
        svg_path: row.svg_path ?? '',
        updated_at: new Date().toISOString(),
      };
      if (idx === -1) state.configs.push(full);
      else state.configs[idx] = full;
      return { error: null };
    },
    delete: () => ({
      eq: (_c: string, fontId: string) => ({
        eq: async (_c2: string, charCode: number) => {
          state.configs = state.configs.filter(
            (r) => !(r.font_id === fontId && r.char_code === charCode),
          );
          return { error: null };
        },
      }),
    }),
  });

  const storage = {
    from: (_bucket: string) => ({
      upload: async (path: string, blob: Blob, _opts: unknown) => {
        state.uploads[path] = blob;
        return { error: null };
      },
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/font-assets/${path}` },
      }),
    }),
  };

  return {
    from: (table: string) => (table === 'fonts' ? tableFonts() : tableConfigs()),
    storage,
  } as unknown as Parameters<typeof __setSupabaseForTests>[0];
}

describe('persistence', () => {
  const state = { fonts: [] as FontRow[], configs: [] as Row[], uploads: {} as Record<string, Blob> };

  beforeEach(() => {
    state.fonts = [];
    state.configs = [];
    state.uploads = {};
    __setSupabaseForTests(makeMock(state));
    localStorage.clear();
  });

  it('createFont returns a new id and inserts a row', async () => {
    const id = await createFont('My Font');
    expect(id).toBe('font-1');
    expect(state.fonts).toHaveLength(1);
    expect(state.fonts[0]!.name).toBe('My Font');
  });

  it('upsertGlyphConfig inserts then updates the same (font_id, char_code) pair', async () => {
    await upsertGlyphConfig('f1', 65, { svgPath: 'M0 0', verticalOffset: 0, scale: 1, rotation: 0 });
    await upsertGlyphConfig('f1', 65, { svgPath: 'M1 1', verticalOffset: 10, scale: 1.2, rotation: 5 });
    expect(state.configs).toHaveLength(1);
    expect(state.configs[0]).toMatchObject({
      font_id: 'f1',
      char_code: 65,
      svg_path: 'M1 1',
      vertical_offset: 10,
      scale: 1.2,
    });
  });

  it('loadFont returns null for unknown ids', async () => {
    const s = await loadFont('missing');
    expect(s).toBeNull();
  });

  it('loadFont hydrates glyphs keyed by char_code', async () => {
    await createFont();
    const fontId = state.fonts[0]!.id;
    await upsertGlyphConfig(fontId, 65, { svgPath: 'A-path', verticalOffset: 5, scale: 1, rotation: 0 });
    await upsertGlyphConfig(fontId, 0x00e5, { svgPath: 'aring-path', verticalOffset: -3, scale: 0.9, rotation: 0 });

    const session = await loadFont(fontId);
    expect(session).not.toBeNull();
    expect(session!.glyphs[65]!.svgPath).toBe('A-path');
    expect(session!.glyphs[0x00e5]!.verticalOffset).toBe(-3);
    expect(session!.unitsPerEm).toBe(1000);
  });

  it('uploadTtf stores the blob at font_id.ttf and getFontPublicUrl returns a URL', async () => {
    const blob = new Blob([new Uint8Array([0, 0, 0])]);
    await uploadTtf('abc', blob);
    expect(state.uploads['abc.ttf']).toBe(blob);
    const url = getFontPublicUrl('abc');
    expect(url).toContain('abc.ttf');
  });

  it('getOrCreateSessionFontId creates once and reuses the same id', async () => {
    const first = await getOrCreateSessionFontId();
    const second = await getOrCreateSessionFontId();
    expect(first).toBe(second);
    expect(state.fonts).toHaveLength(1);
  });

  it('getOrCreateSessionFontId recovers from an orphaned localStorage id', async () => {
    localStorage.setItem('fontline:font_id', 'orphan');
    const id = await getOrCreateSessionFontId();
    expect(id).not.toBe('orphan');
    expect(state.fonts).toHaveLength(1);
  });

  it('clearSessionFontId wipes localStorage', () => {
    localStorage.setItem('fontline:font_id', 'x');
    clearSessionFontId();
    expect(localStorage.getItem('fontline:font_id')).toBeNull();
  });

  it('persistence errors are wrapped, not raw supabase errors', async () => {
    const brokenMock = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: 'boom' } }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof __setSupabaseForTests>[0];
    __setSupabaseForTests(brokenMock);
    await expect(createFont()).rejects.toBeInstanceOf(PersistenceError);
  });
});

// Keep vi tree-shake-safe (unused import elimination warning).
void vi;
