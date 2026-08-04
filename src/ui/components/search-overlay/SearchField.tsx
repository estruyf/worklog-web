import React from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { IconButton, Input } from '../../primitives';
import { Kbd } from '../Kbd';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  /** The hit count, shown only once something has been typed or filtered. */
  count?: number;
}

/** The palette's query box. It is also the dialog's accessible name, which is why
 *  it autofocuses and why the overlay has no heading of its own.
 *
 *  The way out is spelled differently per pointer: the Esc chip is a keyboard hint
 *  and says nothing to a thumb, so below md it gives way to a close button beside
 *  the field. It is outlined and sits outside the field's border, which is what
 *  keeps it from reading as a second clear `×`. */
export function SearchField({ value, onChange, onClose, count }: SearchFieldProps) {
  return (
    <div className="flex items-center gap-2">
      {/* The clear `×` is the last thing in the row, as it is in the archive
          filter — so the two search fields end the same way. */}
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
              // Just the number on a phone — the field, the close button and the
              // clear `×` are already sharing one narrow row.
              <span className="shrink-0 text-control text-neutral-650">
                {count}
                <span className="hidden md:inline"> {count === 1 ? 'result' : 'results'}</span>
              </span>
            )}
            <button
              className="hidden md:block shrink-0 text-muted hover:text-fg cursor-pointer"
              onClick={onClose}
              aria-label="Close search"
              title="Close (Esc)"
            >
              <Kbd>Esc</Kbd>
            </button>
          </>
        }
        aria-label="Search tasks and day notes"
        placeholder="Search tasks and day notes..."
        inputClassName="text-input-fg"
        className="flex-1 min-w-0"
      />
      <IconButton variant="outline" onClick={onClose} aria-label="Close search" className="md:hidden w-9 h-9">
        <XIcon size={18} />
      </IconButton>
    </div>
  );
}
