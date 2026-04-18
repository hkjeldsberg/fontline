// Pure functions on ImageData. No DOM, no side effects. Each returns a NEW ImageData
// so filters are composable and tests are straightforward.

export function cloneImageData(src: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

/** Multiply luminance around mid-grey. factor=1 is identity, factor=0 flattens to 0.5 grey. */
export function contrast(src: ImageData, factor: number): ImageData {
  const out = cloneImageData(src);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = d[i + c]!;
      d[i + c] = clamp(128 + (v - 128) * factor);
    }
  }
  return out;
}

/** Otsu's method — computes a threshold from the image's own histogram. */
export function otsuThreshold(src: ImageData): number {
  const hist = new Array<number>(256).fill(0);
  const d = src.data;
  let total = 0;
  for (let i = 0; i < d.length; i += 4) {
    const y = toLuma(d[i]!, d[i + 1]!, d[i + 2]!);
    hist[y]!++;
    total++;
  }
  if (total === 0) return 128;

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Binarise to black/white at `threshold` (0-255). If threshold is undefined, uses Otsu. */
export function threshold(src: ImageData, t?: number): ImageData {
  const cut = t ?? otsuThreshold(src);
  const out = cloneImageData(src);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = toLuma(d[i]!, d[i + 1]!, d[i + 2]!);
    const v = y <= cut ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  return out;
}

/** Separable box blur approximating a Gaussian. radius in pixels. */
export function blur(src: ImageData, radius: number): ImageData {
  if (radius <= 0) return cloneImageData(src);
  const passes = 3; // 3 box passes ≈ gaussian
  let out = cloneImageData(src);
  for (let p = 0; p < passes; p++) {
    out = boxBlurPass(out, radius);
  }
  return out;
}

function boxBlurPass(src: ImageData, radius: number): ImageData {
  const w = src.width;
  const h = src.height;
  const out = cloneImageData(src);
  const tmp = new Uint8ClampedArray(src.data);
  const r = Math.max(1, Math.floor(radius));
  const size = 2 * r + 1;

  // Horizontal
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) {
        sum += src.data[(y * w + clampIdx(x, w)) * 4 + c]!;
      }
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = sum / size;
        const add = src.data[(y * w + clampIdx(x + r + 1, w)) * 4 + c]!;
        const rem = src.data[(y * w + clampIdx(x - r, w)) * 4 + c]!;
        sum += add - rem;
      }
    }
  }

  // Vertical
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) {
        sum += tmp[(clampIdx(y, h) * w + x) * 4 + c]!;
      }
      for (let y = 0; y < h; y++) {
        out.data[(y * w + x) * 4 + c] = sum / size;
        out.data[(y * w + x) * 4 + 3] = 255;
        const add = tmp[(clampIdx(y + r + 1, h) * w + x) * 4 + c]!;
        const rem = tmp[(clampIdx(y - r, h) * w + x) * 4 + c]!;
        sum += add - rem;
      }
    }
  }
  return out;
}

/** Unsharp mask: src + amount * (src - blur). */
export function sharpen(src: ImageData, amount: number, radius = 1): ImageData {
  if (amount <= 0) return cloneImageData(src);
  const blurred = blur(src, radius);
  const out = cloneImageData(src);
  for (let i = 0; i < out.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const base = src.data[i + c]!;
      const lo = blurred.data[i + c]!;
      out.data[i + c] = clamp(base + amount * (base - lo));
    }
  }
  return out;
}

export interface FilterSettings {
  contrast: number; // 1 = identity
  blurRadius: number; // 0 = off
  sharpen: number; // 0 = off
  threshold?: number; // undefined = Otsu
}

export const DEFAULT_FILTERS: FilterSettings = {
  contrast: 1.1,
  blurRadius: 0,
  sharpen: 0.2,
  threshold: undefined,
};

/** Compose the standard pipeline in the order the UI exposes. */
export function runPipeline(src: ImageData, s: FilterSettings): ImageData {
  let out = src;
  if (s.contrast !== 1) out = contrast(out, s.contrast);
  if (s.blurRadius > 0) out = blur(out, s.blurRadius);
  if (s.sharpen > 0) out = sharpen(out, s.sharpen);
  out = threshold(out, s.threshold);
  return out;
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
function clampIdx(v: number, max: number): number {
  return v < 0 ? 0 : v >= max ? max - 1 : v;
}
function toLuma(r: number, g: number, b: number): number {
  // Rec. 601
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}
