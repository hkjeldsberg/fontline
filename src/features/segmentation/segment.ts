// Connected-components segmentation on a thresholded (binary) ImageData.
// Ink = pixels with R-channel == 0 (threshold() emits either 0 or 255).

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Segment {
  bbox: BBox;
  crop: ImageData;
}

export interface SegmentOptions {
  /** Drop components smaller than this many ink pixels. */
  minArea: number;
  /** Merge a small component into a bigger neighbour when its x-range fits within the neighbour's and vertical gap is <= this value. Fixes dotted i/j. */
  dotMergeGap: number;
}

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = {
  minArea: 20,
  dotMergeGap: 50,
};

/** Segment a thresholded image into per-glyph crops ordered top-to-bottom, left-to-right. */
export function segment(source: ImageData, opts: SegmentOptions = DEFAULT_SEGMENT_OPTIONS): Segment[] {
  const { width: w, height: h, data } = source;
  if (w === 0 || h === 0) return [];

  const labels = new Int32Array(w * h); // 0 = background, >0 = component id
  const bboxes: (BBox & { area: number })[] = [{ x: 0, y: 0, width: 0, height: 0, area: 0 }]; // index 0 placeholder
  let next = 1;
  const stack: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (labels[idx] !== 0) continue;
      if (data[idx * 4]! !== 0) continue; // not ink

      // Flood-fill this component.
      const id = next++;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      stack.length = 0;
      stack.push(idx);
      labels[idx] = id;
      while (stack.length > 0) {
        const p = stack.pop()!;
        const px = p % w;
        const py = (p - px) / w;
        area++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        // 4-connectivity. 8 would merge too-eagerly.
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (labels[nIdx] !== 0) continue;
          if (data[nIdx * 4]! !== 0) continue;
          labels[nIdx] = id;
          stack.push(nIdx);
        }
      }
      bboxes.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area });
    }
  }

  // Drop tiny speckle.
  const keep = bboxes
    .map((b, id) => ({ id, ...b }))
    .slice(1)
    .filter((b) => b.area >= opts.minArea);

  // Merge multi-part glyphs (i/j dot-on-stem, colon/semicolon stacked pieces).
  const merged: typeof keep = [];
  const consumed = new Set<number>();
  // Sort by area desc so the largest piece wins as the initial anchor.
  const byArea = [...keep].sort((a, b) => b.area - a.area);
  for (const anchor of byArea) {
    if (consumed.has(anchor.id)) continue;
    let mergedBox = anchor;
    for (const other of keep) {
      if (other.id === anchor.id || consumed.has(other.id)) continue;
      // Overlap-based x-check: dot of 'i' is often wider than its stem; colon dots are
      // equal-sized. Require ≥40% horizontal overlap with the narrower of the two boxes.
      const overlapL = Math.max(other.x, mergedBox.x);
      const overlapR = Math.min(other.x + other.width, mergedBox.x + mergedBox.width);
      const withinX = overlapR - overlapL >= Math.min(other.width, mergedBox.width) * 0.4;
      // Vertical gap between the two components. Checked against mergedBox so chained
      // merges (e.g. three-part glyphs) accumulate correctly.
      const gap =
        other.y + other.height < mergedBox.y
          ? mergedBox.y - (other.y + other.height)
          : other.y > mergedBox.y + mergedBox.height
            ? other.y - (mergedBox.y + mergedBox.height)
            : 0;
      // Adaptive threshold: colon/semicolon pieces are taller than i-dots so allow a
      // proportionally larger gap (3× the candidate's height, floored at dotMergeGap).
      const gapLimit = Math.max(opts.dotMergeGap, other.height * 3);
      if (withinX && gap <= gapLimit) {
        mergedBox = mergeBox(mergedBox, other);
        consumed.add(other.id);
      }
    }
    consumed.add(anchor.id);
    merged.push(mergedBox);
  }

  // Order top-to-bottom, then left-to-right by row bands.
  const sorted = orderByRow(merged);

  // Build crops.
  return sorted.map((b) => ({ bbox: { x: b.x, y: b.y, width: b.width, height: b.height }, crop: cropImageData(source, b) }));
}

function mergeBox<T extends BBox & { area: number }>(a: T, b: BBox & { area: number }): T {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { ...a, x, y, width: right - x, height: bottom - y, area: a.area + b.area };
}

function orderByRow<T extends BBox>(items: T[]): T[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const rows: T[][] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    if (!row) {
      rows.push([item]);
      continue;
    }
    const rowY = Math.min(...row.map((r) => r.y));
    const rowH = Math.max(...row.map((r) => r.y + r.height)) - rowY;
    if (item.y < rowY + rowH * 0.6) row.push(item);
    else rows.push([item]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.x - b.x));
}

function cropImageData(src: ImageData, box: BBox): ImageData {
  const out = new ImageData(box.width, box.height);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const sIdx = ((box.y + y) * src.width + (box.x + x)) * 4;
      const dIdx = (y * box.width + x) * 4;
      out.data[dIdx] = src.data[sIdx]!;
      out.data[dIdx + 1] = src.data[sIdx + 1]!;
      out.data[dIdx + 2] = src.data[sIdx + 2]!;
      out.data[dIdx + 3] = 255;
    }
  }
  return out;
}
