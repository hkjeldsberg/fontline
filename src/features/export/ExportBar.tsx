import { useState } from 'react';
import { useSession } from '../../store/session';
import { buildFont } from './buildFont';
import * as persistence from '../../lib/persistence';

export function ExportBar() {
  const session = useSession((s) => s.session);
  const [busy, setBusy] = useState<'download' | 'upload' | null>(null);
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  if (!session) return null;
  const glyphCount = Object.keys(session.glyphs).length;

  const showToast = (kind: 'success' | 'error', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 2500);
  };

  const doDownload = () => {
    try {
      setBusy('download');
      const { font } = buildFont(session);
      font.download(`${session.name || 'FontLine'}.ttf`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const doUpload = async () => {
    try {
      setBusy('upload');
      const { blob } = buildFont(session);
      await persistence.uploadTtf(session.fontId, blob);
      const url = persistence.getFontPublicUrl(session.fontId);
      await navigator.clipboard.writeText(url);
      showToast('success', 'URL copied to clipboard');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
          {glyphCount} glyph{glyphCount === 1 ? '' : 's'}
        </span>
        <button onClick={doDownload} disabled={busy !== null}>
          {busy === 'download' ? 'Building…' : 'Download .ttf'}
        </button>
        <button onClick={doUpload} disabled={busy !== null}>
          {busy === 'upload' ? 'Uploading…' : 'Upload & copy URL'}
        </button>
      </div>
      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </>
  );
}
