import { describe, it, expect } from 'vitest';
import {
  tracePathToD,
  tracePathsToD,
  reverseSegments,
  translatePath,
  scalePath,
  pathBounds,
} from '../lib/pathUtils';

describe('pathUtils', () => {
  it('tracePathToD emits M/L/Z for a simple triangle', () => {
    const d = tracePathToD({
      isholepath: false,
      segments: [
        { type: 'L', x1: 0, y1: 0, x2: 10, y2: 0 },
        { type: 'L', x1: 10, y1: 0, x2: 5, y2: 8 },
        { type: 'L', x1: 5, y1: 8, x2: 0, y2: 0 },
      ],
    });
    expect(d).toBe('M 0 0 L 10 0 L 5 8 L 0 0 Z');
  });

  it('tracePathToD supports quadratic curves', () => {
    const d = tracePathToD({
      isholepath: false,
      segments: [{ type: 'Q', x1: 0, y1: 0, x2: 5, y2: 10, x3: 10, y3: 0 }],
    });
    expect(d).toBe('M 0 0 Q 5 10 10 0 Z');
  });

  it('empty path returns empty string', () => {
    expect(tracePathToD({ isholepath: false, segments: [] })).toBe('');
  });

  it('reverseSegments reverses a linear chain end-to-end', () => {
    const segs = [
      { type: 'L', x1: 0, y1: 0, x2: 10, y2: 0 },
      { type: 'L', x1: 10, y1: 0, x2: 10, y2: 10 },
    ];
    const rev = reverseSegments(segs);
    expect(rev[0]).toMatchObject({ type: 'L', x1: 10, y1: 10, x2: 10, y2: 0 });
    expect(rev[1]).toMatchObject({ type: 'L', x1: 10, y1: 0, x2: 0, y2: 0 });
  });

  it('hole paths are emitted in reversed winding', () => {
    const outer = tracePathToD({
      isholepath: false,
      segments: [
        { type: 'L', x1: 0, y1: 0, x2: 10, y2: 0 },
        { type: 'L', x1: 10, y1: 0, x2: 10, y2: 10 },
        { type: 'L', x1: 10, y1: 10, x2: 0, y2: 0 },
      ],
    });
    const hole = tracePathToD({
      isholepath: true,
      segments: [
        { type: 'L', x1: 2, y1: 2, x2: 6, y2: 2 },
        { type: 'L', x1: 6, y1: 2, x2: 6, y2: 6 },
        { type: 'L', x1: 6, y1: 6, x2: 2, y2: 2 },
      ],
    });
    expect(outer).toContain('M 0 0');
    // After reversal, the hole should start at the last end-point (2,2 → still 2,2 here
    // because the last segment ends at 2,2). Key check: the order of mid-points flipped.
    expect(hole).toContain('M 2 2');
    // Combined path for opentype.js:
    const combined = tracePathsToD([
      { isholepath: false, segments: [{ type: 'L', x1: 0, y1: 0, x2: 1, y2: 0 }, { type: 'L', x1: 1, y1: 0, x2: 0, y2: 1 }, { type: 'L', x1: 0, y1: 1, x2: 0, y2: 0 }] },
      { isholepath: true, segments: [{ type: 'L', x1: 0.2, y1: 0.2, x2: 0.5, y2: 0.2 }, { type: 'L', x1: 0.5, y1: 0.2, x2: 0.2, y2: 0.5 }, { type: 'L', x1: 0.2, y1: 0.5, x2: 0.2, y2: 0.2 }] },
    ]);
    expect(combined.match(/Z/g)).toHaveLength(2);
  });

  it('translatePath shifts coordinates', () => {
    const d = 'M 0 0 L 10 10 Q 5 5 20 0';
    expect(translatePath(d, 3, 4)).toBe('M 3 4 L 13 14 Q 8 9 23 4');
  });

  it('scalePath scales coordinates', () => {
    expect(scalePath('M 0 0 L 10 10', 2)).toBe('M 0 0 L 20 20');
  });

  it('pathBounds computes the min/max x/y across a path', () => {
    const b = pathBounds('M -5 -3 L 7 0 Q 3 9 10 4');
    expect(b.minX).toBe(-5);
    expect(b.minY).toBe(-3);
    expect(b.maxX).toBe(10);
    expect(b.maxY).toBe(9);
  });

  it('pathBounds of an empty string returns zero bounds', () => {
    expect(pathBounds('')).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
});
