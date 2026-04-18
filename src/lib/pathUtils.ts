// Utilities for moving between SVG path "d" strings and coordinate-transformed
// versions, plus the imagetracerjs tracedata -> "d" conversion with hole-path
// winding reversal. Pure functions, no DOM, no library imports — easy to test.

export interface TraceSegment {
  type: 'L' | 'Q' | string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3?: number;
  y3?: number;
}

export interface TracePath {
  segments: TraceSegment[];
  isholepath: boolean;
}

/** Convert one imagetracerjs path (array of segments) to an SVG "d" sub-path. */
export function tracePathToD(path: TracePath): string {
  if (path.segments.length === 0) return '';
  const segs = path.isholepath ? reverseSegments(path.segments) : path.segments;
  const first = segs[0]!;
  const parts: string[] = [`M ${fmt(first.x1)} ${fmt(first.y1)}`];
  for (const s of segs) {
    if (s.type === 'Q' && s.x3 !== undefined && s.y3 !== undefined) {
      parts.push(`Q ${fmt(s.x2)} ${fmt(s.y2)} ${fmt(s.x3)} ${fmt(s.y3)}`);
    } else {
      parts.push(`L ${fmt(s.x2)} ${fmt(s.y2)}`);
    }
  }
  parts.push('Z');
  return parts.join(' ');
}

/** Convert an array of traced paths (typically one imagetracerjs layer) to a combined `d`. */
export function tracePathsToD(paths: TracePath[]): string {
  return paths.map(tracePathToD).filter(Boolean).join(' ');
}

/**
 * Reverse a closed segment chain so its winding order flips. Used on hole paths
 * so that opentype.js's non-zero fill treats them as cut-outs rather than fills.
 */
export function reverseSegments(segments: TraceSegment[]): TraceSegment[] {
  if (segments.length === 0) return [];
  // Walk the chain in reverse, swapping start/end per segment.
  return segments
    .slice()
    .reverse()
    .map((s) => {
      if (s.type === 'Q' && s.x3 !== undefined && s.y3 !== undefined) {
        return { type: 'Q', x1: s.x3, y1: s.y3, x2: s.x2, y2: s.y2, x3: s.x1, y3: s.y1 };
      }
      return { type: 'L', x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1 };
    });
}

/** Translate an SVG path `d` string by (dx, dy). Handles M L Q commands. */
export function translatePath(d: string, dx: number, dy: number): string {
  return transformPath(d, (x, y) => [x + dx, y + dy]);
}

/** Scale an SVG path `d` string around origin (0,0). */
export function scalePath(d: string, sx: number, sy = sx): string {
  return transformPath(d, (x, y) => [x * sx, y * sy]);
}

export function transformPath(d: string, fn: (x: number, y: number) => [number, number]): string {
  const parts: string[] = [];
  const re = /([MLQZ])([^MLQZ]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const cmd = m[1]!.toUpperCase();
    if (cmd === 'Z') {
      parts.push('Z');
      continue;
    }
    const args = m[2]!.trim();
    if (!args) {
      parts.push(cmd);
      continue;
    }
    const nums = args.split(/[\s,]+/).map(Number);
    const out: string[] = [cmd];
    for (let i = 0; i < nums.length; i += 2) {
      const [nx, ny] = fn(nums[i]!, nums[i + 1]!);
      out.push(fmt(nx), fmt(ny));
    }
    parts.push(out.join(' '));
  }
  return parts.join(' ');
}

/** Compute bounding box of an SVG path (M L Q only). Control points included (upper bound). */
export function pathBounds(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const re = /[MLQ]\s*([-\d.\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const nums = m[1]!.trim().split(/[\s,]+/).map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      const x = nums[i]!;
      const y = nums[i + 1]!;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(3);
}
