import React from 'react';
import { SearchIcon } from 'lucide-react';
import { Input } from '../../primitives';
import { Kbd } from '../Kbd';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  /** The hit count, shown only once something has been typed or filtered. */
  count?: number;
}

/** The palette's query box. It is also the dialog's accessible name, which is why
 *  it autofocuses and why the overlay has no heading of its own. */
export function SearchField({ value, onChange, onClose, count }: SearchFieldProps) {
  return (
    // The clear `×` is the last thing in the row, as it is in the archive
    // filter — so the two search fields end the same way.
    <Input
      id="worklog-search-input"
      size="lg"
      variant="accent"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus={true}
      clearable
      onClear={() => onChange('')}
      leading={<SearchIcon size={16} className="shrink-0 text-neutral-650" />}
      trailing={
        <>
          {count !== undefined && (
            <span className="shrink-0 text-control text-neutral-650">
              {count} {count === 1 ? 'result' : 'results'}
            </span>
          )}
          <button className="shrink-0 text-muted hover:text-fg cursor-pointer" onClick={onClose} aria-label="Close search" title="Close (Esc)">
            <Kbd>Esc</Kbd>
          </button>
        </>
      }
      aria-label="Search tasks"
      placeholder="Search tasks by title, link, description..."
      inputClassName="text-input-fg"
    />
  );
}
