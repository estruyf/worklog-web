import React, { useMemo, useRef, useState } from 'react';
import { addTag, isNewTag, matchExistingTag, normalizeTag, removeTag, suggestTags } from '../utils';

const SUGGESTION_LIMIT = 8;

/** Tag entry as a combobox rather than a free-text field: selected tags are
 * chips, and typing filters the tags already in use so an existing one is one
 * key away. Creating a tag is still possible but explicit — it only shows up
 * when nothing existing matches, which is what keeps typos and re-spellings
 * ("Mobile" next to "mobile") out of the vocabulary. */
export function TagPicker({
  value,
  onChange,
  known,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Every tag already in use, usage-ranked. */
  known: string[];
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => suggestTags(query, known, value, SUGGESTION_LIMIT), [query, known, value]);
  const canCreate = isNewTag(query, known, value);
  // The create row, when present, sits after the suggestions in the same cursor
  // space — so "existing tag" is always what Enter reaches first.
  const optionCount = suggestions.length + (canCreate ? 1 : 0);
  const at = Math.min(cursor, Math.max(optionCount - 1, 0));

  const commit = (raw: string) => {
    const next = addTag(value, raw, known);
    if (next !== value) {
      onChange(next);
    }
    setQuery('');
    setCursor(0);
  };

  const commitOption = () => {
    if (optionCount === 0) {
      return;
    }
    commit(at < suggestions.length ? suggestions[at] : query);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (optionCount === 0) {
        return;
      }
      e.preventDefault();
      setOpen(true);
      setCursor((c) => {
        const from = Math.min(c, optionCount - 1);
        return e.key === 'ArrowDown' ? Math.min(from + 1, optionCount - 1) : Math.max(from - 1, 0);
      });
      return;
    }
    if (e.key === 'Enter') {
      // Must not reach the modal's save-on-Enter.
      e.preventDefault();
      e.stopPropagation();
      commitOption();
      return;
    }
    if (e.key === 'Backspace' && query === '' && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
      return;
    }
    if (e.key === 'Escape' && open) {
      // Close the list, not the whole task modal.
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
          return; // moving to a suggestion button, not leaving the picker
        }
        setOpen(false);
        // Don't silently drop something the user typed but didn't commit.
        if (normalizeTag(query)) {
          commit(query);
        }
      }}
    >
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-[6px] w-full px-[10px] py-[7px] border border-neutral-525 rounded-[9px] bg-white cursor-text focus-within:border-brand-500"
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-[5px] text-[12.5px] text-neutral-725 bg-neutral-250 border border-neutral-400 rounded-full pl-[9px] pr-[5px] py-[3px]">
            {tag}
            <button
              type="button"
              onClick={() => onChange(removeTag(value, tag))}
              title={`Remove "${tag}"`}
              aria-label={`Remove ${tag}`}
              className="leading-none text-[13px] text-neutral-650 cursor-pointer hover:text-danger-675"
            >
              ×
            </button>
          </span>
        ))}
        {/* The wrapper's focus-within border is the focus affordance, so the
            global *:focus-visible ring is suppressed rather than drawn inside it. */}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const raw = e.target.value;
            // Commas separate rather than type, so both "bug," and a pasted
            // "bug, mobile, urgent" land as individual tags.
            if (raw.includes(',')) {
              const parts = raw.split(',');
              const tail = parts.pop() ?? '';
              const next = parts.reduce((acc, part) => addTag(acc, part, known), value);
              if (next !== value) {
                onChange(next);
              }
              setQuery(tail);
            } else {
              setQuery(raw);
            }
            setOpen(true);
            setCursor(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? 'Pick a tag or type a new one' : ''}
          className="flex-1 min-w-[130px] px-[4px] py-[4px] bg-transparent text-[16px] md:text-[14px] outline-none focus-visible:outline-none!"
        />
      </div>

      {open && optionCount > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-[210px] overflow-auto border border-neutral-400 rounded-[10px] bg-white shadow-lg py-[5px]">
          {suggestions.map((tag, i) => (
            <button
              key={tag}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => {
                commit(tag);
                inputRef.current?.focus();
              }}
              className={
                'flex items-center justify-between w-full text-left px-3 py-[7px] text-[13.5px] cursor-pointer ' +
                (i === at ? 'bg-brand-225 text-brand-800' : 'text-neutral-750 hover:bg-neutral-200')
              }
            >
              {tag}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseEnter={() => setCursor(suggestions.length)}
              onClick={() => {
                commit(query);
                inputRef.current?.focus();
              }}
              className={
                'flex items-center gap-[6px] w-full text-left px-3 py-[7px] text-[13.5px] cursor-pointer ' +
                (suggestions.length > 0 ? 'border-t border-neutral-300 ' : '') +
                (at === suggestions.length ? 'bg-brand-225 text-brand-800' : 'text-neutral-750 hover:bg-neutral-200')
              }
            >
              <span className="text-[15px] leading-none">+</span>
              Create “{normalizeTag(query)}”
            </button>
          )}
        </div>
      )}

      {/* Reassure that a differently-cased spelling folds onto the existing tag
          rather than adding a second one. */}
      {!canCreate && matchExistingTag(query, known) && matchExistingTag(query, known) !== normalizeTag(query) && (
        <div className="text-[12px] text-neutral-625 mt-[6px]">
          Uses the existing tag “{matchExistingTag(query, known)}”.
        </div>
      )}
    </div>
  );
}
