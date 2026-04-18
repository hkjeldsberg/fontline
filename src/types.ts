// Shared types for the whole app.
// CharCode is the Unicode codepoint (number), not a JS string.
// This avoids the "is 'å' one char or two?" surrogate-pair surprise in keying.

export type CharCode = number;

export interface GlyphConfig {
  /** SVG path `d` string in the crop's local coordinate system, Y-down. */
  svgPath: string;
  /** Pixel offset from the baseline in source-image space. Positive = above baseline. */
  verticalOffset: number;
  /** 1.0 = original size. */
  scale: number;
  /** Rotation in degrees, applied around the glyph centre. Positive = counter-clockwise. */
  rotation: number;
  /** Bounding box of the source crop, in source-image pixels. Null for manually drawn glyphs. */
  sourceBounds: { width: number; height: number } | null;
  updatedAt: string;
}

export interface FontSession {
  fontId: string;
  name: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  glyphs: Record<CharCode, GlyphConfig>;
}

/** Characters the PRD requires FontLine to support. */
export const SUPPORTED_CHARS: readonly string[] = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'0123456789',
  'Æ', 'Ø', 'Å', 'æ', 'ø', 'å',
  '!', '?', '.', ',', ':', ';', '-', '_', '(', ')', '"', "'", '@', '#', '&',
];

export const SUPPORTED_CODEPOINTS: readonly CharCode[] =
  SUPPORTED_CHARS.map((ch) => ch.codePointAt(0)!);

export const DEFAULT_FONT_METRICS = {
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
} as const;
