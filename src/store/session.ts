import { create } from 'zustand';
import type { CharCode, FontSession, GlyphConfig } from '../types';
import { DEFAULT_FONT_METRICS } from '../types';
import * as persistence from '../lib/persistence';

export interface Crop {
  id: string;
  svgPath: string;
  bounds: { width: number; height: number };
  /** Full-res PNG data URL for filmstrip thumbnails. Optional. */
  preview?: string;
}

interface SessionState {
  session: FontSession | null;
  unassigned: Crop[];
  saving: Record<CharCode, boolean>;
  lastError: string | null;

  hydrate: (session: FontSession | null, fallbackId: string) => void;
  addUnassigned: (crops: Crop[]) => void;
  removeUnassigned: (cropId: string) => void;
  assignCrop: (cropId: string, code: CharCode) => Promise<void>;
  assignManualDrawing: (code: CharCode, svgPath: string, bounds: { width: number; height: number }) => Promise<void>;
  updateGlyph: (code: CharCode, patch: Partial<GlyphConfig>) => void;
  /** Persist the current state of a glyph (fire on drag end / numeric commit). */
  saveGlyph: (code: CharCode) => Promise<void>;
  removeGlyph: (code: CharCode) => Promise<void>;
  setName: (name: string) => void;
  saveName: () => Promise<void>;
  clearError: () => void;
}

function emptySession(fontId: string): FontSession {
  return {
    fontId,
    name: 'FontLine',
    glyphs: {},
    ...DEFAULT_FONT_METRICS,
  };
}

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  unassigned: [],
  saving: {},
  lastError: null,

  hydrate: (session, fallbackId) => set({ session: session ?? emptySession(fallbackId) }),

  addUnassigned: (crops) => set((s) => ({ unassigned: [...s.unassigned, ...crops] })),

  removeUnassigned: (cropId) =>
    set((s) => ({ unassigned: s.unassigned.filter((c) => c.id !== cropId) })),

  assignCrop: async (cropId, code) => {
    const { unassigned, session } = get();
    if (!session) return;
    const crop = unassigned.find((c) => c.id === cropId);
    if (!crop) return;
    const glyph: GlyphConfig = {
      svgPath: crop.svgPath,
      verticalOffset: 0,
      scale: 1,
      rotation: 0,
      sourceBounds: crop.bounds,
      updatedAt: new Date().toISOString(),
    };
    set({
      session: { ...session, glyphs: { ...session.glyphs, [code]: glyph } },
      unassigned: unassigned.filter((c) => c.id !== cropId),
    });
    await get().saveGlyph(code);
  },

  assignManualDrawing: async (code, svgPath, bounds) => {
    const { session } = get();
    if (!session) return;
    const glyph: GlyphConfig = {
      svgPath,
      verticalOffset: 0,
      scale: 1,
      rotation: 0,
      sourceBounds: bounds,
      updatedAt: new Date().toISOString(),
    };
    set({ session: { ...session, glyphs: { ...session.glyphs, [code]: glyph } } });
    await get().saveGlyph(code);
  },

  updateGlyph: (code, patch) =>
    set((s) => {
      if (!s.session) return s;
      const existing = s.session.glyphs[code];
      if (!existing) return s;
      const updated: GlyphConfig = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      return { session: { ...s.session, glyphs: { ...s.session.glyphs, [code]: updated } } };
    }),

  saveGlyph: async (code) => {
    const { session } = get();
    if (!session) return;
    const g = session.glyphs[code];
    if (!g) return;
    set((s) => ({ saving: { ...s.saving, [code]: true } }));
    try {
      await persistence.upsertGlyphConfig(session.fontId, code, {
        svgPath: g.svgPath,
        verticalOffset: g.verticalOffset,
        scale: g.scale,
        rotation: g.rotation,
      });
      set({ lastError: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ lastError: `Save failed — changes kept locally. (${msg})` });
    } finally {
      set((s) => {
        const next = { ...s.saving };
        delete next[code];
        return { saving: next };
      });
    }
  },

  removeGlyph: async (code) => {
    const { session } = get();
    if (!session) return;
    const { [code]: _, ...rest } = session.glyphs;
    void _;
    set({ session: { ...session, glyphs: rest } });
    try {
      await persistence.deleteGlyphConfig(session.fontId, code);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ lastError: `Delete failed. (${msg})` });
    }
  },

  setName: (name) =>
    set((s) => (s.session ? { session: { ...s.session, name } } : s)),

  saveName: async () => {
    const { session } = get();
    if (!session) return;
    try {
      await persistence.renameFont(session.fontId, session.name);
      set({ lastError: null });
    } catch (err) {
      set({ lastError: err instanceof Error ? err.message : String(err) });
    }
  },

  clearError: () => set({ lastError: null }),
}));
