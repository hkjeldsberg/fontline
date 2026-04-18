import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../../store/session';
import type { CharCode } from '../../types';

interface BaselinePaperProps {
  selectedCode: CharCode | null;
  onDeselect: () => void;
}

const DEFAULT_CANVAS_H = 340;
const BASELINE_RATIO = 0.75; // baseline at 75% of canvas height
const CAP_RATIO = 0.25;
const XHEIGHT_RATIO = 0.47;

const SCALE_PRESETS = [0.5, 0.75, 1.0, 1.25];

export function BaselinePaper({ selectedCode, onDeselect }: BaselinePaperProps) {
  const session = useSession((s) => s.session);
  const updateGlyph = useSession((s) => s.updateGlyph);
  const saveGlyph = useSession((s) => s.saveGlyph);
  const removeGlyph = useSession((s) => s.removeGlyph);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasW, setCanvasW] = useState(700);
  const [dragStart, setDragStart] = useState<{ y: number; offset: number } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Size the paper to fill the column.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setCanvasW(Math.max(360, Math.round(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const canvasH = DEFAULT_CANVAS_H;
  const baselineY = canvasH * BASELINE_RATIO;
  const xHeightY = canvasH * XHEIGHT_RATIO;
  const capHeightY = canvasH * CAP_RATIO;

  const commit = useCallback(
    (code: CharCode) => {
      void saveGlyph(code);
    },
    [saveGlyph],
  );

  if (!session || selectedCode == null) {
    return (
      <div ref={containerRef} style={{ color: 'var(--muted)', padding: 24 }}>
        Select a glyph from the filmstrip to edit its baseline.
      </div>
    );
  }
  const glyph = session.glyphs[selectedCode];
  if (!glyph) return null;

  const bounds = glyph.sourceBounds ?? { width: 100, height: 100 };
  const nominalDisplayHeight = (baselineY - capHeightY) * glyph.scale;
  const displayScale = nominalDisplayHeight / Math.max(1, bounds.height);
  const glyphY =
    baselineY - bounds.height * displayScale - glyph.verticalOffset * displayScale;
  const glyphX = canvasW / 2 - (bounds.width * displayScale) / 2;

  const rotationCentreX = glyphX + (bounds.width * displayScale) / 2;
  const rotationCentreY = glyphY + (bounds.height * displayScale) / 2;

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragStart({ y: e.clientY, offset: glyph.verticalOffset });
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStart) return;
    const dyScreen = dragStart.y - e.clientY;
    const dySource = dyScreen / displayScale;
    updateGlyph(selectedCode, { verticalOffset: Math.round(dragStart.offset + dySource) });
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStart) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragStart(null);
    commit(selectedCode);
  };

  const bump = (field: 'verticalOffset' | 'scale' | 'rotation', delta: number) => {
    const next = { [field]: (glyph[field] as number) + delta } as Partial<typeof glyph>;
    if (field === 'scale') {
      next.scale = Math.max(0.1, Math.min(3, Number((glyph.scale + delta).toFixed(2))));
    }
    updateGlyph(selectedCode, next);
    commit(selectedCode);
  };

  const setScale = (s: number) => {
    updateGlyph(selectedCode, { scale: s });
    commit(selectedCode);
  };

  const handleRemove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      setTimeout(() => setConfirmRemove(false), 2500);
      return;
    }
    void removeGlyph(selectedCode).then(() => onDeselect());
  };

  return (
    <div ref={containerRef}>
      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 22, minWidth: 28 }}>{String.fromCodePoint(selectedCode)}</strong>

        <Field label="Offset">
          <Spin onDec={() => bump('verticalOffset', -1)} onDec10={() => bump('verticalOffset', -10)}>
            <input
              type="number"
              value={glyph.verticalOffset}
              style={{ width: 72, fontSize: 15 }}
              onChange={(e) => updateGlyph(selectedCode, { verticalOffset: Number(e.target.value) })}
              onBlur={() => commit(selectedCode)}
            />
          </Spin>
          <StepButton onClick={() => bump('verticalOffset', 1)}>▲</StepButton>
          <StepButton onClick={() => bump('verticalOffset', 10)}>▲▲</StepButton>
        </Field>

        <Field label="Scale">
          <StepButton onClick={() => bump('scale', -0.05)}>−</StepButton>
          <input
            type="number"
            step="0.05"
            min="0.1"
            max="3"
            value={glyph.scale}
            style={{ width: 72, fontSize: 15 }}
            onChange={(e) =>
              updateGlyph(selectedCode, { scale: Number(e.target.value) || 1 })
            }
            onBlur={() => commit(selectedCode)}
          />
          <StepButton onClick={() => bump('scale', 0.05)}>+</StepButton>
          <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
            {SCALE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setScale(p)}
                aria-pressed={Math.abs(glyph.scale - p) < 0.001}
                style={{
                  padding: '4px 8px',
                  fontSize: 12,
                  borderColor:
                    Math.abs(glyph.scale - p) < 0.001 ? 'var(--accent)' : 'var(--border)',
                }}
                title={`Set scale to ${p}`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Rotation°">
          <StepButton onClick={() => bump('rotation', -5)}>−5</StepButton>
          <input
            type="number"
            step="1"
            value={glyph.rotation}
            style={{ width: 72, fontSize: 15 }}
            onChange={(e) =>
              updateGlyph(selectedCode, { rotation: Number(e.target.value) || 0 })
            }
            onBlur={() => commit(selectedCode)}
          />
          <StepButton onClick={() => bump('rotation', 5)}>+5</StepButton>
          <button
            onClick={() => {
              updateGlyph(selectedCode, { rotation: 0 });
              commit(selectedCode);
            }}
            style={{ fontSize: 12 }}
            title="Reset rotation"
          >
            0°
          </button>
        </Field>

        <div style={{ flex: 1 }} />
        <button
          onClick={handleRemove}
          style={{
            color: confirmRemove ? 'var(--ink)' : 'var(--danger)',
            background: confirmRemove ? 'var(--danger)' : 'transparent',
            borderColor: 'var(--danger)',
          }}
          title="Delete this glyph from the font"
        >
          {confirmRemove ? 'Click again to confirm' : 'Remove glyph'}
        </button>
      </div>

      {/* Paper */}
      <svg
        ref={svgRef}
        width={canvasW}
        height={canvasH}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          touchAction: 'none',
          cursor: dragStart ? 'grabbing' : 'grab',
          display: 'block',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {[capHeightY, xHeightY, baselineY].map((y, i) => (
          <line
            key={y}
            x1={0}
            x2={canvasW}
            y1={y}
            y2={y}
            stroke="var(--border)"
            strokeDasharray={i === 2 ? 'none' : '4 6'}
            strokeWidth={i === 2 ? 1.5 : 1}
          />
        ))}
        <text x={8} y={capHeightY - 4} fill="var(--muted)" fontSize={10}>cap</text>
        <text x={8} y={xHeightY - 4} fill="var(--muted)" fontSize={10}>x-height</text>
        <text x={8} y={baselineY - 4} fill="var(--muted)" fontSize={10}>baseline</text>
        <g
          transform={`rotate(${-glyph.rotation} ${rotationCentreX} ${rotationCentreY}) translate(${glyphX} ${glyphY}) scale(${displayScale})`}
        >
          <path d={glyph.svgPath} fill="var(--ink)" />
        </g>
      </svg>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={{ color: 'var(--muted)', fontSize: 12, minWidth: 54 }}>{label}</label>
      {children}
    </div>
  );
}

/** Chunky step-button that compensates for the tiny native number-input spinners. */
function StepButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 10px',
        fontSize: 14,
        minWidth: 32,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

/** Wraps a number input and gives the user dec-by-1 and dec-by-10 buttons on the left. */
function Spin({
  onDec,
  onDec10,
  children,
}: {
  onDec: () => void;
  onDec10: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <StepButton onClick={onDec10}>▼▼</StepButton>
      <StepButton onClick={onDec}>▼</StepButton>
      {children}
    </>
  );
}
