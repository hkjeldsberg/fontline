// Main-thread client for the tracer worker.
// Keeps worker lifecycle simple: one worker per trace job, terminated on completion.

import type { TraceMsgOut } from './tracer.worker';

export interface TraceCrop {
  index: number;
  imageData: ImageData;
}

export async function traceCrops(crops: TraceCrop[]): Promise<{ index: number; d: string }[]> {
  if (crops.length === 0) return [];
  // Vite idiom: new URL(..., import.meta.url) + { type: 'module' }.
  const worker = new Worker(new URL('./tracer.worker.ts', import.meta.url), { type: 'module' });
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    worker.onmessage = (ev: MessageEvent<TraceMsgOut>) => {
      if (ev.data.id !== id) return;
      worker.terminate();
      if (ev.data.error) reject(new Error(ev.data.error));
      else resolve(ev.data.paths ?? []);
    };
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new Error(ev.message || 'Tracer worker failed'));
    };
    worker.postMessage({ id, crops });
  });
}
