import { describe, it, expect } from 'vitest';
import { SUPPORTED_CHARS, SUPPORTED_CODEPOINTS, DEFAULT_FONT_METRICS } from '../types';

describe('type system baseline', () => {
  it('covers the full PRD character set', () => {
    expect(SUPPORTED_CHARS).toContain('A');
    expect(SUPPORTED_CHARS).toContain('å');
    expect(SUPPORTED_CHARS).toContain('Æ');
    expect(SUPPORTED_CHARS).toContain('&');
    expect(SUPPORTED_CODEPOINTS).toContain(0x00c5); // Å
    expect(SUPPORTED_CODEPOINTS).toContain(0x00e6); // æ
  });

  it('uses standard font metrics', () => {
    expect(DEFAULT_FONT_METRICS.unitsPerEm).toBe(1000);
    expect(DEFAULT_FONT_METRICS.ascender + Math.abs(DEFAULT_FONT_METRICS.descender)).toBe(1000);
  });
});
