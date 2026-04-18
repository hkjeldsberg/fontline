import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from './app/Layout';
import { UploadDropzone } from './features/upload/UploadDropzone';
import { runPipeline, DEFAULT_FILTERS, type FilterSettings } from './features/upload/preprocess';
import { segment } from './features/segmentation/segment';
import { traceCrops } from './features/segmentation/traceClient';
import { Filmstrip } from './components/Filmstrip';
import { CharPicker } from './components/CharPicker';
import { FontSwitcher } from './components/FontSwitcher';
import { GlyphEditor } from './features/editor/GlyphEditor';
import { ManualCanvas } from './features/manual/ManualCanvas';
import { ExportBar } from './features/export/ExportBar';
import { useSession, type Crop } from './store/session';
import * as persistence from './lib/persistence';
import type { CharCode } from './types';
import './app/theme.css';

type Tab = 'editor' | 'draw' | 'upload';

export default function App() {
  const session = useSession((s) => s.session);
  const unassigned = useSession((s) => s.unassigned);
  const lastError = useSession((s) => s.lastError);
  const clearError = useSession((s) => s.clearError);
  const setName = useSession((s) => s.setName);
  const saveName = useSession((s) => s.saveName);
  const hydrate = useSession((s) => s.hydrate);
  const addUnassigned = useSession((s) => s.addUnassigned);
  const assignCrop = useSession((s) => s.assignCrop);
  const [fontListVersion, setFontListVersion] = useState(0);

  const [ready, setReady] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('upload');
  const [selectedCode, setSelectedCode] = useState<CharCode | null>(null);
  const [pickerFor, setPickerFor] = useState<{ cropId: string } | 'manual' | null>(null);
  const [manualTarget, setManualTarget] = useState<CharCode | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [filters, _setFilters] = useState<FilterSettings>(DEFAULT_FILTERS);

  const hydrateSession = useCallback(
    async (fontId: string) => {
      try {
        const loaded = await persistence.loadFont(fontId);
        hydrate(loaded, fontId);
        setHydrateError(null);
      } catch (err) {
        setHydrateError(err instanceof Error ? err.message : String(err));
      }
    },
    [hydrate],
  );

  useEffect(() => {
    (async () => {
      try {
        const fontId = await persistence.getOrCreateSessionFontId();
        await hydrateSession(fontId);
      } catch (err) {
        setHydrateError(err instanceof Error ? err.message : String(err));
      } finally {
        setReady(true);
      }
    })();
  }, [hydrateSession]);

  const handleSwitchFont = useCallback(
    async (fontId: string) => {
      setSelectedCode(null);
      await hydrateSession(fontId);
      setFontListVersion((v) => v + 1);
    },
    [hydrateSession],
  );

  const handleImage = useCallback(
    async (image: ImageData) => {
      setStatus('Segmenting…');
      const start = performance.now();
      try {
        const thresholded = runPipeline(image, filters);
        const segs = segment(thresholded);
        if (segs.length === 0) {
          setStatus('No glyphs detected — try adjusting contrast or upload a clearer photo.');
          return;
        }
        setStatus(`Tracing ${segs.length} glyphs…`);
        const paths = await traceCrops(
          segs.map((s, i) => ({ index: i, imageData: s.crop })),
        );
        const crops: Crop[] = paths.map(({ index, d }) => {
          const s = segs[index]!;
          return {
            id: `crop-${Date.now()}-${index}`,
            svgPath: d,
            bounds: { width: s.bbox.width, height: s.bbox.height },
          };
        });
        addUnassigned(crops);
        const elapsed = Math.round(performance.now() - start);
        setStatus(`Detected ${crops.length} glyphs in ${elapsed} ms. Click a thumbnail to assign.`);
        setTab('editor');
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err));
      }
    },
    [addUnassigned, filters],
  );

  const existingAssignments = session?.glyphs ?? {};

  const pickerActive = pickerFor !== null;

  const handlePick = async (code: CharCode) => {
    if (pickerFor && typeof pickerFor === 'object' && 'cropId' in pickerFor) {
      await assignCrop(pickerFor.cropId, code);
      setSelectedCode(code);
    } else if (pickerFor === 'manual') {
      setManualTarget(code);
      setTab('draw');
    }
    setPickerFor(null);
  };

  const ghostForTarget = useMemo(() => {
    if (manualTarget == null || !session) return undefined;
    // Ghost = same char in the other case if available, e.g. drawing 'å' -> ghost 'a'.
    const lower = String.fromCodePoint(manualTarget).toLowerCase();
    const other = lower === String.fromCodePoint(manualTarget) ? lower.toUpperCase() : lower;
    const otherCode = other.codePointAt(0);
    const source = otherCode !== undefined ? session.glyphs[otherCode] : undefined;
    if (!source) return undefined;
    return { d: source.svgPath, bounds: source.sourceBounds ?? { width: 100, height: 100 } };
  }, [manualTarget, session]);

  const title = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <strong style={{ fontSize: 16 }}>FontLine</strong>
      <FontSwitcher
        currentFontId={session?.fontId ?? null}
        currentFontName={session?.name ?? null}
        onSwitch={(id) => void handleSwitchFont(id)}
        onCreate={(id) => void handleSwitchFont(id)}
        onRename={(name) => setName(name)}
        onCommitRename={() => void saveName()}
        refreshKey={fontListVersion}
      />
    </div>
  );

  const actions = (
    <>
      <div className="tabs">
        <button aria-selected={tab === 'upload'} onClick={() => setTab('upload')}>
          Upload
        </button>
        <button aria-selected={tab === 'editor'} onClick={() => setTab('editor')}>
          Editor
        </button>
        <button
          aria-selected={tab === 'draw'}
          onClick={() => setPickerFor('manual')}
          title="Pick a character to draw"
        >
          Draw
        </button>
      </div>
      <ExportBar />
    </>
  );

  return (
    <>
      <Layout
        title={title}
        actions={actions}
        workspace={
          !ready ? (
            <p style={{ color: 'var(--muted)' }}>Loading…</p>
          ) : hydrateError ? (
            <p style={{ color: 'var(--danger)' }}>
              Supabase not reachable: {hydrateError}. Set <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code>.
            </p>
          ) : (
            <>
              {tab === 'upload' && (
                <div style={{ display: 'grid', gap: 16, maxWidth: 720 }}>
                  <UploadDropzone onImage={(img) => void handleImage(img)} onError={setStatus} />
                  {status && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{status}</div>}
                </div>
              )}
              {tab === 'editor' && (
                <GlyphEditor selectedCode={selectedCode} onDeselect={() => setSelectedCode(null)} />
              )}
              {tab === 'draw' && manualTarget != null && (
                <ManualCanvas
                  targetCode={manualTarget}
                  ghostSvgPath={ghostForTarget?.d}
                  ghostBounds={ghostForTarget?.bounds}
                  onDone={() => {
                    setSelectedCode(manualTarget);
                    setTab('editor');
                  }}
                />
              )}
              {tab === 'draw' && manualTarget == null && (
                <div style={{ color: 'var(--muted)' }}>
                  Pick a character to draw.
                </div>
              )}
            </>
          )
        }
        filmstrip={
          <Filmstrip
            glyphs={session?.glyphs ?? {}}
            unassigned={unassigned}
            selectedCode={selectedCode}
            onSelectCode={(code) => {
              setSelectedCode(code);
              setTab('editor');
            }}
            onSelectCrop={(crop) => setPickerFor({ cropId: crop.id })}
          />
        }
      />
      <CharPicker
        open={pickerActive}
        existingAssignments={existingAssignments}
        onPick={(code) => void handlePick(code)}
        onCancel={() => setPickerFor(null)}
      />
      {lastError && (
        <div className="toast error" onClick={clearError}>
          {lastError}
        </div>
      )}
    </>
  );
}
