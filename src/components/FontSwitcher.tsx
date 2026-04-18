import { useEffect, useState } from 'react';
import * as persistence from '../lib/persistence';
import type { FontSummary } from '../lib/persistence';

interface FontSwitcherProps {
  currentFontId: string | null;
  currentFontName: string | null;
  onSwitch: (fontId: string) => void;
  onCreate: (fontId: string) => void;
  onRename: (name: string) => void;
  /** Called when the rename input loses focus — persist the name. */
  onCommitRename?: () => void;
  /** Incremented by the parent whenever the font list is stale (e.g., after saves). */
  refreshKey?: number;
}

export function FontSwitcher({
  currentFontId,
  currentFontName,
  onSwitch,
  onCreate,
  onRename,
  onCommitRename,
  refreshKey = 0,
}: FontSwitcherProps) {
  const [fonts, setFonts] = useState<FontSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    persistence
      .listFonts()
      .then((list) => {
        if (alive) {
          setFonts(list);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (alive) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [open, refreshKey]);

  const handleCreate = async () => {
    const id = await persistence.createFont('Untitled font');
    persistence.setSessionFontId(id);
    onCreate(id);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        value={currentFontName ?? ''}
        onChange={(e) => onRename(e.target.value)}
        onBlur={() => onCommitRename?.()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        placeholder="Untitled"
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--ink)',
          fontSize: 15,
          width: 200,
          padding: '4px 8px',
        }}
        title="Rename this font"
      />
      <button
        onClick={() => setOpen((o) => !o)}
        title="Switch font family"
        style={{ padding: '4px 8px' }}
      >
        ▾
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 320,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            zIndex: 20,
            maxHeight: 420,
            overflowY: 'auto',
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              color: 'var(--muted)',
              fontSize: 12,
            }}
          >
            Font families
          </div>
          {loadError && (
            <div style={{ padding: 12, color: 'var(--danger)', fontSize: 12 }}>{loadError}</div>
          )}
          {fonts.length === 0 && !loadError && (
            <div style={{ padding: 12, color: 'var(--muted)', fontSize: 12 }}>Loading…</div>
          )}
          {fonts.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                persistence.setSessionFontId(f.id);
                onSwitch(f.id);
                setOpen(false);
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: f.id === currentFontId ? 'var(--surface-2)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                borderRadius: 0,
                color: 'var(--ink)',
              }}
            >
              <span>{f.name || '(unnamed)'}</span>
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                {f.glyphCount} glyph{f.glyphCount === 1 ? '' : 's'}
              </span>
            </button>
          ))}
          <button
            onClick={() => void handleCreate()}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              textAlign: 'left',
              borderRadius: 0,
            }}
          >
            + New font family
          </button>
        </div>
      )}
    </div>
  );
}
