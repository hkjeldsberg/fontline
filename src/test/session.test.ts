import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSession } from '../store/session';
import * as persistence from '../lib/persistence';

vi.mock('../lib/persistence', () => ({
  upsertGlyphConfig: vi.fn(async () => {}),
  deleteGlyphConfig: vi.fn(async () => {}),
}));

const FONT_ID = '00000000-0000-0000-0000-000000000001';

function resetStore() {
  useSession.setState({
    session: null,
    unassigned: [],
    saving: {},
    lastError: null,
  });
}

describe('session store', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('hydrate with null uses an empty session keyed by fallback id', () => {
    useSession.getState().hydrate(null, FONT_ID);
    const s = useSession.getState().session!;
    expect(s.fontId).toBe(FONT_ID);
    expect(Object.keys(s.glyphs)).toHaveLength(0);
    expect(s.unitsPerEm).toBe(1000);
  });

  it('assignCrop moves a crop from unassigned to glyphs and triggers upsert', async () => {
    useSession.getState().hydrate(null, FONT_ID);
    useSession.getState().addUnassigned([
      { id: 'c1', svgPath: 'M0 0 L10 0 L0 10 Z', bounds: { width: 10, height: 10 } },
    ]);
    await useSession.getState().assignCrop('c1', 65);
    const s = useSession.getState();
    expect(s.unassigned).toHaveLength(0);
    expect(s.session!.glyphs[65]!.svgPath).toBe('M0 0 L10 0 L0 10 Z');
    expect(persistence.upsertGlyphConfig).toHaveBeenCalledOnce();
    expect(persistence.upsertGlyphConfig).toHaveBeenCalledWith(
      FONT_ID,
      65,
      expect.objectContaining({ svgPath: 'M0 0 L10 0 L0 10 Z', verticalOffset: 0, scale: 1, rotation: 0 }),
    );
  });

  it('reassigning a codepoint replaces the glyph and resets offset/scale', async () => {
    useSession.getState().hydrate(null, FONT_ID);
    useSession.getState().addUnassigned([
      { id: 'c1', svgPath: 'first', bounds: { width: 5, height: 5 } },
      { id: 'c2', svgPath: 'second', bounds: { width: 6, height: 6 } },
    ]);
    await useSession.getState().assignCrop('c1', 65);
    useSession.getState().updateGlyph(65, { verticalOffset: 20, scale: 1.5, rotation: 15 });
    await useSession.getState().assignCrop('c2', 65);
    const g = useSession.getState().session!.glyphs[65]!;
    expect(g.svgPath).toBe('second');
    expect(g.verticalOffset).toBe(0);
    expect(g.scale).toBe(1);
    expect(g.rotation).toBe(0);
  });

  it('Norwegian codepoints round-trip correctly', async () => {
    useSession.getState().hydrate(null, FONT_ID);
    useSession.getState().addUnassigned([
      { id: 'a', svgPath: 'a', bounds: { width: 1, height: 1 } },
    ]);
    await useSession.getState().assignCrop('a', 'å'.codePointAt(0)!);
    expect(useSession.getState().session!.glyphs[0x00e5]!.svgPath).toBe('a');
  });

  it('removeGlyph deletes from store and calls persistence', async () => {
    useSession.getState().hydrate(null, FONT_ID);
    useSession.getState().addUnassigned([
      { id: 'c1', svgPath: 'x', bounds: { width: 1, height: 1 } },
    ]);
    await useSession.getState().assignCrop('c1', 65);
    await useSession.getState().removeGlyph(65);
    expect(useSession.getState().session!.glyphs[65]).toBeUndefined();
    expect(persistence.deleteGlyphConfig).toHaveBeenCalledWith(FONT_ID, 65);
  });

  it('persistence failure surfaces via lastError but keeps local state', async () => {
    (persistence.upsertGlyphConfig as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));
    useSession.getState().hydrate(null, FONT_ID);
    useSession.getState().addUnassigned([
      { id: 'c1', svgPath: 'x', bounds: { width: 1, height: 1 } },
    ]);
    await useSession.getState().assignCrop('c1', 65);
    expect(useSession.getState().session!.glyphs[65]).toBeDefined();
    expect(useSession.getState().lastError).toMatch(/network/);
  });

  it('assignManualDrawing adds a glyph without needing an unassigned crop', async () => {
    useSession.getState().hydrate(null, FONT_ID);
    await useSession.getState().assignManualDrawing('å'.codePointAt(0)!, 'M 0 0 L 1 1', {
      width: 100,
      height: 100,
    });
    expect(useSession.getState().session!.glyphs[0x00e5]!.svgPath).toBe('M 0 0 L 1 1');
    expect(persistence.upsertGlyphConfig).toHaveBeenCalledOnce();
  });
});
