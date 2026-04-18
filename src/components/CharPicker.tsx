import { useEffect, useMemo, useRef, useState } from 'react';
import { SUPPORTED_CHARS } from '../types';
import type { CharCode } from '../types';

interface CharPickerProps {
  open: boolean;
  existingAssignments: Record<CharCode, unknown>;
  onPick: (code: CharCode) => void;
  onCancel: () => void;
}

const GROUPS: readonly { label: string; chars: string[] }[] = [
  { label: 'Uppercase', chars: Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ') },
  { label: 'Lowercase', chars: Array.from('abcdefghijklmnopqrstuvwxyz') },
  { label: 'Numbers', chars: Array.from('0123456789') },
  { label: 'Norwegian', chars: ['Æ', 'Ø', 'Å', 'æ', 'ø', 'å'] },
  {
    label: 'Punctuation',
    chars: ['!', '?', '.', ',', ':', ';', '-', '_', '(', ')', '"', "'", '@', '#', '&'],
  },
];

export function CharPicker({ open, existingAssignments, onPick, onCancel }: CharPickerProps) {
  const [focus, setFocus] = useState(0);
  const flat = useMemo(() => GROUPS.flatMap((g) => g.chars), []);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.focus();
    setFocus(0);
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }
    if (e.key === 'Enter') {
      const ch = flat[focus];
      if (ch) onPick(ch.codePointAt(0)!);
      return;
    }
    if (e.key === 'ArrowRight') {
      setFocus((i) => Math.min(flat.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowLeft') {
      setFocus((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key.length === 1) {
      const cp = e.key.codePointAt(0)!;
      if (SUPPORTED_CHARS.some((c) => c.codePointAt(0) === cp)) {
        onPick(cp);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Pick a character"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,0.5)',
        zIndex: 10,
      }}
      onClick={onCancel}
    >
      <div
        ref={rootRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 20,
          minWidth: 520,
          outline: 'none',
        }}
      >
        <div style={{ marginBottom: 12, color: 'var(--muted)', fontSize: 13 }}>
          Click or type a character to assign. Esc to cancel.
        </div>
        {GROUPS.map((group, gi) => {
          const startIdx = GROUPS.slice(0, gi).reduce((n, g) => n + g.chars.length, 0);
          return (
            <div key={group.label} style={{ marginBottom: 12 }}>
              <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4 }}>
                {group.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {group.chars.map((ch, ci) => {
                  const idx = startIdx + ci;
                  const code = ch.codePointAt(0)!;
                  const assigned = existingAssignments[code] !== undefined;
                  const focused = idx === focus;
                  return (
                    <button
                      key={ch}
                      onClick={() => onPick(code)}
                      onMouseEnter={() => setFocus(idx)}
                      style={{
                        width: 36,
                        height: 36,
                        fontSize: 16,
                        borderColor: focused ? 'var(--accent)' : assigned ? 'var(--success)' : 'var(--border)',
                        color: assigned ? 'var(--success)' : 'var(--ink)',
                      }}
                      title={assigned ? 'Already assigned — will replace' : undefined}
                    >
                      {ch}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
