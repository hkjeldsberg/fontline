import { describe, it, expect } from 'vitest';
import opentype from 'opentype.js';
import { buildFont, svgDToOpentypePath } from '../features/export/buildFont';
import type { FontSession } from '../types';
import { DEFAULT_FONT_METRICS } from '../types';

function session(overrides: Partial<FontSession> = {}): FontSession {
  return {
    fontId: 'test',
    name: 'Test',
    ...DEFAULT_FONT_METRICS,
    glyphs: {},
    ...overrides,
  };
}

describe('buildFont', () => {
  it('an empty session still produces a valid font with .notdef and space', () => {
    const { font, arrayBuffer } = buildFont(session());
    expect(font.glyphs.length).toBeGreaterThanOrEqual(2);
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
    // Round-trip parse to prove the TTF is valid.
    const parsed = opentype.parse(arrayBuffer);
    expect(parsed).toBeDefined();
    expect(parsed.tables.name).toBeDefined();
  });

  it('session with A and B produces a font with the expected codepoints', () => {
    const { font } = buildFont(
      session({
        glyphs: {
          65: {
            svgPath: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
            verticalOffset: 0,
            scale: 1,
            rotation: 0,
            sourceBounds: { width: 100, height: 100 },
            updatedAt: new Date().toISOString(),
          },
          66: {
            svgPath: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
            verticalOffset: 0,
            scale: 1,
            rotation: 0,
            sourceBounds: { width: 100, height: 100 },
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    );
    // 2 custom glyphs + .notdef + space = 4
    expect(font.glyphs.length).toBe(4);
    expect(font.charToGlyph('A').name).toBe('A');
    expect(font.charToGlyph('B').name).toBe('B');
  });

  it('round-trips Norwegian codepoints through the cmap', () => {
    const { arrayBuffer } = buildFont(
      session({
        glyphs: {
          0x00e5: {
            svgPath: 'M 0 0 L 50 0 L 0 50 Z',
            verticalOffset: 0,
            scale: 1,
            rotation: 0,
            sourceBounds: { width: 50, height: 50 },
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    );
    const parsed = opentype.parse(arrayBuffer);
    const glyph = parsed.charToGlyph('å');
    expect(glyph.unicode).toBe(0x00e5);
  });

  it('advanceWidth is non-zero for custom glyphs (prevents Figma/Adobe stacking bug)', () => {
    const { font } = buildFont(
      session({
        glyphs: {
          65: {
            svgPath: 'M 0 0 L 80 0 L 80 100 L 0 100 Z',
            verticalOffset: 0,
            scale: 1,
            rotation: 0,
            sourceBounds: { width: 80, height: 100 },
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    );
    const a = font.charToGlyph('A');
    expect(a.advanceWidth).toBeGreaterThan(0);
  });

  it('svgDToOpentypePath flips Y so the baseline sits at y=0', () => {
    const path = svgDToOpentypePath('M 0 0 L 10 100 Z', { scale: 1, verticalOffset: 0, ascender: 800 });
    const cmds = path.commands as { type: string; x?: number; y?: number }[];
    expect(cmds[0]!.type).toBe('M');
    expect(cmds[0]!.y).toBe(800);
    expect(cmds[1]!.type).toBe('L');
    expect(cmds[1]!.y).toBe(700);
  });

  it('verticalOffset shifts the glyph up on the baseline', () => {
    const base = svgDToOpentypePath('M 0 0 Z', { scale: 1, verticalOffset: 0, ascender: 800 });
    const lifted = svgDToOpentypePath('M 0 0 Z', { scale: 1, verticalOffset: 50, ascender: 800 });
    const y0 = (base.commands[0] as { y: number }).y;
    const y1 = (lifted.commands[0] as { y: number }).y;
    expect(y1 - y0).toBe(50);
  });

  it('scale multiplies coordinates', () => {
    const path = svgDToOpentypePath('M 0 0 L 100 100', { scale: 2, verticalOffset: 0, ascender: 800 });
    const l = path.commands[1] as { x: number; y: number };
    expect(l.x).toBe(200);
    expect(l.y).toBe(800 - 200);
  });

  it('font.getPath works for characters the font does NOT contain (regression: _push bug)', () => {
    const { font } = buildFont(
      session({
        glyphs: {
          65: {
            svgPath: 'M 0 0 L 10 0 L 10 10 L 0 10 Z',
            verticalOffset: 0,
            scale: 1,
            rotation: 0,
            sourceBounds: { width: 10, height: 10 },
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    );
    // 'Q' is not in the font. Before the patch this threw
    // "this.font._push is not a function".
    expect(() => font.getPath('Q', 0, 100, 48)).not.toThrow();
    expect(() => font.getPath('Hello Blåbærsyltetøy', 0, 100, 48)).not.toThrow();
  });

  it('rotation of 90 degrees around the glyph centre turns a horizontal line vertical', () => {
    // source: (0,50) -> (100,50), centre (50,50). 90 deg rotation -> (50,0) -> (50,100).
    const path = svgDToOpentypePath('M 0 50 L 100 50', {
      scale: 1,
      verticalOffset: 0,
      ascender: 800,
      rotation: 90,
      rotationCentre: { x: 50, y: 50 },
    });
    const m = path.commands[0] as { x: number; y: number };
    const l = path.commands[1] as { x: number; y: number };
    expect(m.x).toBeCloseTo(50);
    expect(l.x).toBeCloseTo(50);
    // Y values differ because after rotation the line is vertical in source space.
    expect(Math.abs(m.y - l.y)).toBeCloseTo(100);
  });
});
