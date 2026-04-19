import opentype from 'opentype.js';
import type { CharCode, FontSession, GlyphConfig } from '../../types';
import { pathBounds } from '../../lib/pathUtils';

export interface PathTransform {
  scale: number;
  verticalOffset: number;
  ascender: number;
  /** Rotation in degrees, counter-clockwise, around the glyph centre (bounds/2). */
  rotation?: number;
  /** Centre of rotation in source-pixel coordinates (required when rotation is set). */
  rotationCentre?: { x: number; y: number };
}

/** Convert an SVG path "d" (M/L/Q/Z only) into an opentype.Path transformed
 *  into font-unit coordinate space (Y-up, baseline at 0).
 *
 *  Order of operations, per source-pixel point (x,y):
 *    1. Rotate around rotationCentre (if set) in source-pixel space
 *    2. Scale uniformly
 *    3. Flip Y (ascender - y*scale) so baseline sits at 0
 *    4. Add verticalOffset
 */
export function svgDToOpentypePath(d: string, t: PathTransform): opentype.Path {
  const path = new opentype.Path();
  const rad = ((t.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = t.rotationCentre?.x ?? 0;
  const cy = t.rotationCentre?.y ?? 0;

  const transform = (x: number, y: number): [number, number] => {
    let rx = x;
    let ry = y;
    if (rad !== 0) {
      const dx = x - cx;
      const dy = y - cy;
      // Screen coords are Y-down, so a "visual CCW" rotation is actually CW in screen space.
      // We rotate in SVG-space consistently with the on-screen transform used by BaselinePaper.
      rx = cx + dx * cos - dy * sin;
      ry = cy + dx * sin + dy * cos;
    }
    return [rx * t.scale, t.ascender - ry * t.scale + t.verticalOffset];
  };

  const re = /([MLQZ])([^MLQZ]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const cmd = m[1]!.toUpperCase();
    if (cmd === 'Z') {
      path.close();
      continue;
    }
    const args = m[2]!.trim();
    if (!args) continue;
    const nums = args.split(/[\s,]+/).map(Number);
    if (cmd === 'M') {
      const [x, y] = transform(nums[0]!, nums[1]!);
      path.moveTo(x, y);
    } else if (cmd === 'L') {
      const [x, y] = transform(nums[0]!, nums[1]!);
      path.lineTo(x, y);
    } else if (cmd === 'Q') {
      const [ccx, ccy] = transform(nums[0]!, nums[1]!);
      const [x, y] = transform(nums[2]!, nums[3]!);
      path.quadraticCurveTo(ccx, ccy, x, y);
    }
  }
  return path;
}

/** Build a minimal .notdef glyph: a hollow rectangle so it renders as a visible tofu. */
function buildNotdef(ascender: number, descender: number): opentype.Glyph {
  const path = new opentype.Path();
  const top = ascender * 0.75;
  const bot = descender * 0.5;
  const left = 50;
  const right = 450;
  path.moveTo(left, bot);
  path.lineTo(right, bot);
  path.lineTo(right, top);
  path.lineTo(left, top);
  path.close();
  return new opentype.Glyph({ name: '.notdef', unicode: undefined, advanceWidth: 500, path });
}

function buildSpace(): opentype.Glyph {
  return new opentype.Glyph({
    name: 'space',
    unicode: 32,
    advanceWidth: 400,
    path: new opentype.Path(),
  });
}

export interface BuildFontResult {
  font: opentype.Font;
  blob: Blob;
  arrayBuffer: ArrayBuffer;
}

export function buildFont(session: FontSession): BuildFontResult {
  const { ascender, descender, unitsPerEm } = session;
  const glyphs: opentype.Glyph[] = [buildNotdef(ascender, descender), buildSpace()];

  const entries = Object.entries(session.glyphs) as unknown as [string, GlyphConfig][];
  for (const [key, config] of entries) {
    const code = Number(key) as CharCode;
    if (code === 32) continue; // space is fixed
    const bounds = config.sourceBounds ?? {
      width: Math.max(1, pathBounds(config.svgPath).maxX),
      height: Math.max(1, pathBounds(config.svgPath).maxY),
    };
    // baseScale_at_1 converts one source pixel to font units such that the glyph bottom
    // lands exactly on the font baseline (y=0) when verticalOffset=0 and scale=1.
    // config.scale then uniformly shrinks/grows the glyph while keeping it baseline-anchored.
    // verticalOffset is in source-pixel units (see types.ts); multiply by baseScale_at_1 to
    // get font units — this makes descenders (negative offset) actually land below baseline.
    const baseScale_at_1 = ascender / Math.max(1, bounds.height);
    const baseScale = baseScale_at_1 * config.scale;
    const path = svgDToOpentypePath(config.svgPath, {
      scale: baseScale,
      verticalOffset: config.verticalOffset * baseScale_at_1,
      // Pass ascender*scale as the y-anchor so the top of the glyph sits at the right
      // height and the bottom maps to (verticalOffset * baseScale_at_1) in font units.
      ascender: ascender * config.scale,
      rotation: config.rotation ?? 0,
      rotationCentre: { x: bounds.width / 2, y: bounds.height / 2 },
    });
    const advanceWidth = Math.max(
      100,
      Math.round(bounds.width * baseScale + (ascender - descender) * 0.1),
    );
    glyphs.push(
      new opentype.Glyph({
        name: glyphNameFor(code),
        unicode: code,
        advanceWidth,
        path,
      }),
    );
  }

  const font = new opentype.Font({
    familyName: session.name || 'FontLine',
    styleName: 'Regular',
    unitsPerEm,
    ascender,
    descender,
    glyphs,
  });

  patchFreshFontForRendering(font);

  const arrayBuffer = font.toArrayBuffer();
  const blob = new Blob([arrayBuffer], { type: 'font/ttf' });
  return { font, blob, arrayBuffer };
}

/**
 * opentype.js 1.3.4 has two latent bugs on freshly-constructed fonts that
 * together make `font.getPath(text)` crash:
 *
 * 1. When the text contains a character the font doesn't have,
 *    `DefaultEncoding.charToGlyphIndex` returns `null`. `stringToGlyphs` then
 *    calls `glyphs.get(null)`, which takes the low-memory branch and hits
 *    `this.font._push(index)` — but `_push` is only wired up by the parser,
 *    not by the `new Font(...)` constructor. Crash:
 *    `this.font._push is not a function`.
 *
 * 2. Once step 1 is papered over, `forEachGlyph` still runs kerning between
 *    every adjacent glyph pair. `getKerningValue` falls back to
 *    `this.kerningPairs[left + ',' + right]` — but `kerningPairs` is only
 *    set when opentype parses a font with a "kern" table, so it's `undefined`
 *    on constructed fonts. Crash:
 *    `Cannot read properties of undefined (reading '[object Object],[object Object]')`.
 *    (The weird key is because `glyph.index` defaults to 0, so `left.index || left`
 *    returns the whole Glyph object, whose `toString()` is `[object Object]`.)
 *
 * Fix: force `charToGlyphIndex` to return 0 (.notdef) for unknown characters,
 * install an empty `kerningPairs` dict, and install harmless defaults for the
 * low-memory internals in case any other code path re-enters `GlyphSet.get`'s
 * deferred branch.
 */
function patchFreshFontForRendering(font: opentype.Font): void {
  const enc = (font as unknown as { encoding: { charToGlyphIndex: (c: string) => number | null } }).encoding;
  const original = enc.charToGlyphIndex.bind(enc);
  enc.charToGlyphIndex = (c: string) => original(c) ?? 0;

  const mutable = font as unknown as {
    kerningPairs?: Record<string, number>;
    _push: (i: number) => void;
    _IndexToUnicodeMap: Record<number, unknown>;
    _hmtxTableData: Record<number, { advanceWidth: number; leftSideBearing: number }>;
  };
  if (!mutable.kerningPairs) mutable.kerningPairs = {};
  mutable._push = () => {};
  mutable._IndexToUnicodeMap = mutable._IndexToUnicodeMap ?? {};
  mutable._hmtxTableData = mutable._hmtxTableData ?? {};
}

/** Best-effort Adobe Glyph List name; falls back to uni<hex> for exotic codepoints. */
function glyphNameFor(code: number): string {
  const ch = String.fromCodePoint(code);
  if (/^[A-Za-z]$/.test(ch)) return ch;
  if (/^[0-9]$/.test(ch)) return `${ch}` === '0' ? 'zero' : ['one','two','three','four','five','six','seven','eight','nine'][parseInt(ch) - 1]!;
  const named: Record<number, string> = {
    0x00c6: 'AE',
    0x00d8: 'Oslash',
    0x00c5: 'Aring',
    0x00e6: 'ae',
    0x00f8: 'oslash',
    0x00e5: 'aring',
    0x0021: 'exclam',
    0x003f: 'question',
    0x002e: 'period',
    0x002c: 'comma',
    0x003a: 'colon',
    0x003b: 'semicolon',
    0x002d: 'hyphen',
    0x005f: 'underscore',
    0x0028: 'parenleft',
    0x0029: 'parenright',
    0x0022: 'quotedbl',
    0x0027: 'quotesingle',
    0x0040: 'at',
    0x0023: 'numbersign',
    0x0026: 'ampersand',
    0x002b: 'plus',
    0x003c: 'less',
    0x00e9: 'eacute',
  };
  return named[code] ?? `uni${code.toString(16).toUpperCase().padStart(4, '0')}`;
}
