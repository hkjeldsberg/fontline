import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../../store/session';
import { buildFont } from '../export/buildFont';

const DEFAULT_TEXT = 'The quick brown fox jumps over the lazy dog\nBlåbærsyltetøy';

export function LivePreview() {
  const session = useSession((s) => s.session);
  const [text, setText] = useState(DEFAULT_TEXT);
  const [size, setSize] = useState(54);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [version, setVersion] = useState(0);
  const [buildError, setBuildError] = useState<string | null>(null);

  // Track container width so we can repaint when the layout settles after mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setContainerWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rebuild-font-from-session trigger (debounced key).
  const glyphsKey = useMemo(() => {
    if (!session) return '';
    return (
      session.name +
      '|' +
      Object.entries(session.glyphs)
        .map(
          ([k, g]) =>
            `${k}:${g.verticalOffset}:${g.scale}:${g.rotation}:${g.svgPath.length}`,
        )
        .join('|')
    );
  }, [session]);

  useEffect(() => {
    const t = setTimeout(() => setVersion((v) => v + 1), 120);
    return () => clearTimeout(t);
  }, [glyphsKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !session || containerWidth === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const lines = text.split('\n');
    const lineHeight = size * 1.3;
    const pixelWidth = Math.max(320, containerWidth);
    canvas.width = pixelWidth * dpr;
    canvas.height = Math.max(120, lineHeight * lines.length + 48) * dpr;
    canvas.style.width = `${pixelWidth}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, pixelWidth, canvas.height / dpr);

    // Empty session → show a helpful placeholder so the preview isn't mysteriously blank.
    const glyphCount = Object.keys(session.glyphs).length;
    if (glyphCount === 0) {
      ctx.fillStyle = '#8b8f99';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Upload a photo or draw glyphs — the preview will render here.', 16, 28);
      setBuildError(null);
      return;
    }

    try {
      const { font } = buildFont(session);
      ctx.fillStyle = '#e7e7ea';
      lines.forEach((line, i) => {
        const y = 24 + (i + 1) * lineHeight - lineHeight * 0.25;
        const path = font.getPath(line, 16, y, size);
        path.fill = '#e7e7ea';
        path.draw(ctx);
      });
      setBuildError(null);
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : String(err));
      ctx.fillStyle = '#e57373';
      ctx.font = '13px monospace';
      ctx.fillText('Preview failed — see inline error below.', 16, 28);
    }
  }, [session, text, size, version, containerWidth]);

  return (
    <div ref={containerRef}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label style={{ color: 'var(--muted)', fontSize: 12 }}>Size</label>
        <input
          type="number"
          min={12}
          max={160}
          value={size}
          onChange={(e) => setSize(Number(e.target.value) || 54)}
          style={{ width: 72 }}
        />
        <button onClick={() => setText(DEFAULT_TEXT)} title="Reset preview text">
          Reset
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={{
          width: '100%',
          fontFamily: 'monospace',
          padding: 8,
          background: 'var(--surface-2)',
          color: 'var(--ink)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          marginTop: 12,
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          maxWidth: '100%',
        }}
      />
      {buildError && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            color: 'var(--danger)',
            fontSize: 12,
            fontFamily: 'monospace',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius)',
          }}
        >
          {buildError}
        </div>
      )}
    </div>
  );
}
