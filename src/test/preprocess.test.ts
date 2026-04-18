import { describe, it, expect } from 'vitest';
import {
  contrast,
  otsuThreshold,
  threshold,
  blur,
  sharpen,
  runPipeline,
  DEFAULT_FILTERS,
} from '../features/upload/preprocess';

function solid(w: number, h: number, r: number, g: number, b: number, a = 255): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return new ImageData(data, w, h);
}

function bimodal(w: number, h: number): ImageData {
  // Two clear modes well apart from 0 and 255 so Otsu can find a real threshold.
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = x < w / 2 ? 50 : 210;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, w, h);
}

describe('preprocess', () => {
  it('contrast(1) is identity', () => {
    const src = solid(4, 4, 80, 120, 200);
    const out = contrast(src, 1);
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('contrast(0) collapses to mid-grey', () => {
    const src = solid(2, 2, 0, 0, 0);
    const out = contrast(src, 0);
    expect(out.data[0]).toBe(128);
  });

  it('otsuThreshold on a bimodal histogram lands between the two modes', () => {
    const t = otsuThreshold(bimodal(10, 10));
    expect(t).toBeGreaterThanOrEqual(50);
    expect(t).toBeLessThan(210);
  });

  it('threshold binarises pixels to 0 or 255', () => {
    const out = threshold(bimodal(10, 10));
    const values = new Set<number>();
    for (let i = 0; i < out.data.length; i += 4) values.add(out.data[i]!);
    expect(values.size).toBe(2);
    expect(values.has(0) && values.has(255)).toBe(true);
  });

  it('blur with radius 0 is identity', () => {
    const src = solid(3, 3, 50, 60, 70);
    const out = blur(src, 0);
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('sharpen with amount 0 is identity', () => {
    const src = solid(3, 3, 128, 128, 128);
    const out = sharpen(src, 0);
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it('runPipeline produces a binary image with defaults', () => {
    const out = runPipeline(bimodal(8, 8), DEFAULT_FILTERS);
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i]!);
    }
  });

  it('handles a 0×0 image without throwing', () => {
    const src = new ImageData(new Uint8ClampedArray(0), 0, 0);
    expect(() => runPipeline(src, DEFAULT_FILTERS)).not.toThrow();
  });
});
