import { BaselinePaper } from './BaselinePaper';
import { LivePreview } from './LivePreview';
import type { CharCode } from '../../types';

interface GlyphEditorProps {
  selectedCode: CharCode | null;
  onDeselect: () => void;
}

/**
 * Layout: baseline paper is wider than preview (the paper needs horizontal room
 * for offset/scale/rotation controls plus the guides). Below ~1100 px we stack.
 */
export function GlyphEditor({ selectedCode, onDeselect }: GlyphEditorProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 3fr) minmax(320px, 2fr)',
        gap: 24,
        alignItems: 'start',
      }}
    >
      <BaselinePaper selectedCode={selectedCode} onDeselect={onDeselect} />
      <LivePreview />
    </div>
  );
}
