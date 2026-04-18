import type { CharCode, GlyphConfig } from '../types';
import type { Crop } from '../store/session';

interface FilmstripProps {
  glyphs: Record<CharCode, GlyphConfig>;
  unassigned: Crop[];
  selectedCode: CharCode | null;
  onSelectCode: (code: CharCode) => void;
  onSelectCrop: (crop: Crop) => void;
}

export function Filmstrip({
  glyphs,
  unassigned,
  selectedCode,
  onSelectCode,
  onSelectCrop,
}: FilmstripProps) {
  const assignedEntries = Object.entries(glyphs) as unknown as [string, GlyphConfig][];
  const sortedAssigned = assignedEntries
    .map(([k, g]) => ({ code: Number(k), glyph: g }))
    .sort((a, b) => a.code - b.code);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: 12,
        alignItems: 'flex-start',
      }}
    >
      {sortedAssigned.map(({ code, glyph }) => (
        <button
          key={`g-${code}`}
          onClick={() => onSelectCode(code)}
          aria-pressed={selectedCode === code}
          style={{
            width: 72,
            height: 88,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: selectedCode === code ? 'var(--surface-2)' : 'var(--surface)',
            borderColor: selectedCode === code ? 'var(--accent)' : 'var(--border)',
          }}
        >
          <div style={{ fontSize: 22, lineHeight: 1 }}>{String.fromCodePoint(code)}</div>
          <GlyphThumb d={glyph.svgPath} bounds={glyph.sourceBounds} />
        </button>
      ))}
      {unassigned.length > 0 && (
        <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '4px 0' }} />
      )}
      {unassigned.map((c) => (
        <button
          key={`u-${c.id}`}
          onClick={() => onSelectCrop(c)}
          style={{
            width: 72,
            height: 88,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Click to assign a character"
        >
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>unassigned</div>
          <GlyphThumb d={c.svgPath} bounds={c.bounds} />
        </button>
      ))}
      {sortedAssigned.length === 0 && unassigned.length === 0 && (
        <div style={{ color: 'var(--muted)', padding: '12px 16px' }}>
          Upload a photo to detect glyphs.
        </div>
      )}
    </div>
  );
}

function GlyphThumb({
  d,
  bounds,
}: {
  d: string;
  bounds: { width: number; height: number } | null;
}) {
  const w = bounds?.width ?? 100;
  const h = bounds?.height ?? 100;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={48}
      height={48}
      style={{ marginTop: 4 }}
      aria-hidden
    >
      <path d={d} fill="var(--ink)" />
    </svg>
  );
}
