/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'imagetracerjs' {
  interface TracedataSegment {
    type: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x3?: number;
    y3?: number;
  }
  interface TracedataPath {
    segments: TracedataSegment[];
    isholepath: boolean;
  }
  interface Tracedata {
    width: number;
    height: number;
    palette: { r: number; g: number; b: number; a: number }[];
    layers: TracedataPath[][];
  }
  const ImageTracer: {
    imagedataToTracedata(image: ImageData, options?: Record<string, unknown>): Tracedata;
    imagedataToSVG(image: ImageData, options?: Record<string, unknown>): string;
  };
  export default ImageTracer;
}

declare module 'heic-to' {
  export function heicTo(opts: { blob: Blob; type: string; quality?: number }): Promise<Blob>;
  export function isHeic(file: File | Blob): Promise<boolean>;
}
