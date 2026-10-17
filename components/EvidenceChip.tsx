'use client';
import { useEffect, useRef, useState } from 'react';
import type { Evidence } from '../lib/types';

export default function EvidenceChip({ evidence, fallbackId }: { evidence?: Evidence; fallbackId?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!evidence) return <span className="chip chip-muted" title="Evidence not found">{fallbackId ?? 'unknown'}</span>;
  const val = `${evidence.value}${evidence.unit ?? ''}`;
  return (
    <span className="evidence" ref={ref}>
      <button type="button" className={`chip chip-ev kind-${evidence.kind}`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="chip-ev-label">{evidence.label}</span>
        <strong>{val}</strong>
      </button>
      {open && (
        <span className="popover" role="dialog" aria-label={evidence.label}>
          <span className="pop-kind">{evidence.kind}</span>
          <span className="pop-title">{evidence.label}</span>
          <span className="pop-value">{val}</span>
          <span className="pop-src">Source: {evidence.source.file} / {evidence.source.ref}</span>
          <span className="pop-id">{evidence.id}</span>
        </span>
      )}
    </span>
  );
}
