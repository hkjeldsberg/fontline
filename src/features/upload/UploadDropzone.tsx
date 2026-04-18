import { useCallback, useRef, useState } from 'react';
import { fileToImageData } from '../../lib/heic';

interface UploadDropzoneProps {
  onImage: (image: ImageData, filename: string) => void;
  onError?: (message: string) => void;
}

export function UploadDropzone({ onImage, onError }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      try {
        for (const file of files) {
          try {
            const img = await fileToImageData(file);
            onImage(img, file.name);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            onError?.(msg);
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [onImage, onError],
  );

  return (
    <div
      role="region"
      aria-label="Upload handwriting photo"
      onDragEnter={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length) void handleFiles(files);
      }}
      style={{
        border: `1px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: 36,
        textAlign: 'center',
        cursor: busy ? 'progress' : 'pointer',
        background: drag ? 'var(--surface-2)' : 'var(--surface)',
        transition: 'background .1s, border-color .1s',
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void handleFiles(files);
          e.target.value = '';
        }}
      />
      {busy ? 'Decoding…' : 'Drop photos of your handwriting, or click to choose.'}
      <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 12 }}>
        JPG · PNG · HEIC · multiple files supported
      </div>
    </div>
  );
}
