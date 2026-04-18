import { useEffect, useRef, useState } from 'react';
import { Canvas, PencilBrush, type FabricObject } from 'fabric';
import { useSession } from '../../store/session';
import type { CharCode } from '../../types';

interface ManualCanvasProps {
  targetCode: CharCode;
  ghostSvgPath?: string;
  ghostBounds?: { width: number; height: number };
  onDone: () => void;
}

const CANVAS_SIZE = 400;

/**
 * Fabric v6 pencil canvas with a ghost overlay and optional eraser.
 * The eraser is loaded lazily from `@erase2d/fabric` (removed from fabric core in v6).
 */
export function ManualCanvas({ targetCode, ghostSvgPath, ghostBounds, onDone }: ManualCanvasProps) {
  const elRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [mode, setMode] = useState<'pencil' | 'erase'>('pencil');
  const [width, setWidth] = useState(3);
  const assignManualDrawing = useSession((s) => s.assignManualDrawing);

  useEffect(() => {
    if (!elRef.current) return;
    const canvas = new Canvas(elRef.current, {
      isDrawingMode: true,
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      backgroundColor: '#fafafa',
    });
    const brush = new PencilBrush(canvas);
    brush.color = '#0f1115';
    brush.width = width;
    canvas.freeDrawingBrush = brush;
    fabricRef.current = canvas;
    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // Keep brush width in sync.
  useEffect(() => {
    const c = fabricRef.current;
    if (!c?.freeDrawingBrush) return;
    c.freeDrawingBrush.width = width;
  }, [width]);

  // Toggle between pencil and eraser.
  useEffect(() => {
    const c = fabricRef.current;
    if (!c) return;
    if (mode === 'pencil') {
      const brush = new PencilBrush(c);
      brush.color = '#0f1115';
      brush.width = width;
      c.freeDrawingBrush = brush;
      c.isDrawingMode = true;
    } else {
      // Lazy-load the erase2d eraser brush so it's only fetched when the user erases.
      void import('@erase2d/fabric').then(({ EraserBrush }) => {
        if (!fabricRef.current) return;
        const eraser = new EraserBrush(fabricRef.current);
        eraser.width = width * 3;
        fabricRef.current.freeDrawingBrush = eraser;
        fabricRef.current.isDrawingMode = true;
      });
    }
  }, [mode, width]);

  // Ghost background: render the ghost glyph as an SVG into the canvas bg.
  useEffect(() => {
    const c = fabricRef.current;
    if (!c) return;
    if (!ghostSvgPath || !ghostBounds) {
      c.backgroundImage = undefined;
      c.requestRenderAll();
      return;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ghostBounds.width} ${ghostBounds.height}" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}"><path d="${ghostSvgPath}" fill="#b0b4bd"/></svg>`;
    const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    // Fabric v6: FabricImage.fromURL returns a promise.
    void import('fabric').then(({ FabricImage }) => {
      FabricImage.fromURL(url).then((img) => {
        if (!fabricRef.current) return;
        img.set({ opacity: 0.25, selectable: false, evented: false });
        fabricRef.current.backgroundImage = img;
        fabricRef.current.requestRenderAll();
      });
    });
  }, [ghostSvgPath, ghostBounds]);

  const handleSave = async () => {
    const c = fabricRef.current;
    if (!c) return;
    const objects = c.getObjects() as FabricObject[];
    if (objects.length === 0) return; // no-op if empty

    // Compose all stroke paths into one `d` string in the canvas's coordinate system.
    const dParts: string[] = [];
    for (const obj of objects) {
      const asPath = (obj as unknown as { path?: unknown[]; toSVG?: () => string });
      if (Array.isArray(asPath.path)) {
        // fabric Path segments are [cmd, ...args] tuples.
        dParts.push(
          asPath.path
            .map((seg) => (Array.isArray(seg) ? seg.join(' ') : String(seg)))
            .join(' '),
        );
      } else if (typeof asPath.toSVG === 'function') {
        dParts.push(asPath.toSVG());
      }
    }
    const d = dParts.join(' ');
    await assignManualDrawing(targetCode, d, { width: CANVAS_SIZE, height: CANVAS_SIZE });
    onDone();
  };

  const handleClear = () => {
    fabricRef.current?.clear();
    if (fabricRef.current) fabricRef.current.backgroundColor = '#fafafa';
    fabricRef.current?.requestRenderAll();
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ color: 'var(--muted)', fontSize: 13 }}>
        Drawing <strong style={{ color: 'var(--ink)' }}>{String.fromCodePoint(targetCode)}</strong>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button aria-pressed={mode === 'pencil'} onClick={() => setMode('pencil')}>
          Pencil
        </button>
        <button aria-pressed={mode === 'erase'} onClick={() => setMode('erase')}>
          Eraser
        </button>
        <label style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 12 }}>Width</label>
        <input
          type="range"
          min={1}
          max={12}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
        />
        <div style={{ flex: 1 }} />
        <button onClick={handleClear}>Clear</button>
        <button onClick={handleSave}>Save glyph</button>
      </div>
      <canvas ref={elRef} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }} />
    </div>
  );
}
