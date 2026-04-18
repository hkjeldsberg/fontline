/// <reference lib="webworker" />
// Dedicated Worker: run imagetracerjs off the main thread so the UI stays responsive
// and we can process crops in sequence without blocking React.
//
// Message in: { id, crops: { index, imageData }[], options? }
// Message out: { id, paths: { index, d, layerPalette }[] } or { id, error }

import ImageTracer from 'imagetracerjs';
import { tracePathsToD } from '../../lib/pathUtils';
import type { TracePath } from '../../lib/pathUtils';

interface CropJob {
  index: number;
  imageData: ImageData;
}

interface TraceMsgIn {
  id: string;
  crops: CropJob[];
  options?: Partial<{
    numberofcolors: number;
    colorsampling: number;
    pathomit: number;
    ltres: number;
    qtres: number;
    rightangleenhance: boolean;
    blurradius: number;
  }>;
}

export interface TraceMsgOut {
  id: string;
  paths?: { index: number; d: string }[];
  error?: string;
}

const DEFAULT_OPTIONS = {
  numberofcolors: 2,
  colorsampling: 0,
  mincolorratio: 0,
  pathomit: 8,
  ltres: 1,
  qtres: 1,
  rightangleenhance: false,
  blurradius: 0,
  roundcoords: 1,
  linefilter: false,
};

self.addEventListener('message', (ev: MessageEvent<TraceMsgIn>) => {
  const { id, crops, options } = ev.data;
  try {
    const opts = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
    const out: { index: number; d: string }[] = [];
    for (const job of crops) {
      const td = ImageTracer.imagedataToTracedata(job.imageData, opts);
      // Pick the ink layer: the palette entry closest to black.
      const palette = td.palette as { r: number; g: number; b: number; a: number }[];
      let inkIdx = 0;
      let minLum = 256;
      for (let i = 0; i < palette.length; i++) {
        const p = palette[i]!;
        const lum = (p.r + p.g + p.b) / 3;
        if (lum < minLum) {
          minLum = lum;
          inkIdx = i;
        }
      }
      const inkLayer = (td.layers[inkIdx] ?? []) as TracePath[];
      const d = tracePathsToD(inkLayer);
      out.push({ index: job.index, d });
    }
    const msg: TraceMsgOut = { id, paths: out };
    (self as unknown as Worker).postMessage(msg);
  } catch (err) {
    const msg: TraceMsgOut = { id, error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(msg);
  }
});

// Vite needs an empty export to treat this as a module.
export {};
