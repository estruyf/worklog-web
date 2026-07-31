import React from 'react';
import { SearchIcon } from 'lucide-react';
import { Button, Input } from '../../primitives';
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
 *  and says nothing to a thumb, so below md it gives way to a Cancel button beside
 *  the field. Cancel rather than another `×`, since the field already ends in one
 *  and the two would be a coin toss between clearing and closing. */
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
              // Just the number on a phone — the field, the Cancel button and the
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
        aria-label="Search tasks"
        placeholder="Search tasks by title, link, description..."
        inputClassName="text-input-fg"
        className="flex-1 min-w-0"
      />
      <Button variant="ghost" size="md" onClick={onClose} className="md:hidden shrink-0">
        Cancel
      </Button>
    </div>
  );
}
