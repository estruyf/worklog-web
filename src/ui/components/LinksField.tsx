import React from 'react';
import { XIcon } from 'lucide-react';
import { IconButton, Input, LinkButton } from '../primitives';
import type { LinkDraft } from '../model';

export interface LinksFieldProps {
  value: LinkDraft[];
  onChange: (links: LinkDraft[]) => void;
  /** The url column's example, which is the only part of the field that differs
   *  by what is being edited. */
  urlPlaceholder?: string;
  /** Keeps one row on screen at all times, so the field is never a bare "add"
   *  link with nothing to type into. The task form opens this way; the client
   *  editor lets the list go empty. */
  keepOne?: boolean;
}

/** The repeater for a list of reference links — url, optional label, remove.
 *
 *  Tasks and clients both carry `TaskLink[]`, so they get the same editor. Rows
 *  wrap rather than squeeze: url and label sit side by side wherever there's room
 *  — the task form's main column, the client dialog — and the label drops under
 *  its url when there isn't. */
export function LinksField({ value, onChange, urlPlaceholder = 'https://example.com', keepOne = false }: LinksFieldProps) {
  const setAt = (index: number, patch: Partial<LinkDraft>) =>
    onChange(value.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const removeAt = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(keepOne && next.length === 0 ? [{ url: '', label: '' }] : next);
  };
  return (
    <>
      {value.map((link, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <div className="flex flex-1 flex-wrap gap-2 min-w-0">
            <Input
              value={link.url}
              onChange={(e) => setAt(i, { url: e.target.value })}
              aria-label={`Link ${i + 1} URL`}
              placeholder={urlPlaceholder}
              className="flex-[2] min-w-[160px]"
            />
            <Input
              value={link.label}
              onChange={(e) => setAt(i, { label: e.target.value })}
              aria-label={`Link ${i + 1} label`}
              placeholder="Label"
              className="flex-1 min-w-[90px]"
            />
          </div>
          <IconButton
            variant="outline"
            onClick={() => removeAt(i)}
            aria-label={`Remove link ${i + 1}`}
            title="Remove this link"
          >
            <XIcon size={14} />
          </IconButton>
        </div>
      ))}
      <LinkButton size="lg" onClick={() => onChange([...value, { url: '', label: '' }])} className="font-medium py-[2px]">
        + Add {value.length ? 'another ' : ''}link
      </LinkButton>
    </>
  );
}
