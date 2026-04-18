import { describe, it, expect } from 'vitest';
import { segment } from '../features/segmentation/segment';

function blank(w: number, h: number): ImageData {
  const img = new ImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 255;
    img.data[i + 1] = 255;
    img.data[i + 2] = 255;
    img.data[i + 3] = 255;
  }
  return img;
}

function drawRect(img: ImageData, x: number, y: number, w: number, h: number): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const i = ((y + dy) * img.width + (x + dx)) * 4;
      img.data[i] = 0;
      img.data[i + 1] = 0;
      img.data[i + 2] = 0;
      img.data[i + 3] = 255;
    }
  }
}

describe('segment', () => {
  it('separates three disjoint blobs ordered left-to-right', () => {
    const img = blank(100, 30);
    drawRect(img, 5, 5, 10, 20);
    drawRect(img, 25, 5, 10, 20);
    drawRect(img, 45, 5, 10, 20);
    const segs = segment(img, { minArea: 10, dotMergeGap: 5 });
    expect(segs).toHaveLength(3);
    expect(segs[0]!.bbox.x).toBeLessThan(segs[1]!.bbox.x);
    expect(segs[1]!.bbox.x).toBeLessThan(segs[2]!.bbox.x);
  });

  it('merges a dot above a stem (like the dot on an i)', () => {
    const img = blank(40, 60);
    // stem
    drawRect(img, 10, 20, 4, 30);
    // dot 10 px above
    drawRect(img, 10, 5, 4, 4);
    const segs = segment(img, { minArea: 5, dotMergeGap: 20 });
    expect(segs).toHaveLength(1);
    // bbox should span from the dot to the bottom of the stem
    expect(segs[0]!.bbox.y).toBeLessThanOrEqual(5);
    expect(segs[0]!.bbox.y + segs[0]!.bbox.height).toBeGreaterThanOrEqual(49);
  });

  it('drops speckle below minArea', () => {
    const img = blank(30, 30);
    drawRect(img, 5, 5, 10, 10); // area 100
    drawRect(img, 20, 20, 1, 1); // area 1
    const segs = segment(img, { minArea: 10, dotMergeGap: 0 });
    expect(segs).toHaveLength(1);
    expect(segs[0]!.bbox.width).toBe(10);
  });

  it('returns [] for a blank image', () => {
    const segs = segment(blank(20, 20));
    expect(segs).toEqual([]);
  });

  it('returns [] for a 0×0 image without throwing', () => {
    expect(() => segment(new ImageData(1, 1))).not.toThrow();
    const empty = new ImageData(new Uint8ClampedArray(0), 0, 0);
    expect(segment(empty)).toEqual([]);
  });

  it('orders two rows top-to-bottom then left-to-right', () => {
    const img = blank(100, 100);
    // row 1
    drawRect(img, 10, 10, 10, 10);
    drawRect(img, 40, 10, 10, 10);
    drawRect(img, 70, 10, 10, 10);
    // row 2
    drawRect(img, 10, 60, 10, 10);
    drawRect(img, 40, 60, 10, 10);
    const segs = segment(img, { minArea: 10, dotMergeGap: 0 });
    expect(segs).toHaveLength(5);
    expect(segs[0]!.bbox.y).toBe(10);
    expect(segs[2]!.bbox.y).toBe(10);
    expect(segs[3]!.bbox.y).toBe(60);
  });
});
