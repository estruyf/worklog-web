import React, { useId, useState } from 'react';
import { XIcon } from 'lucide-react';
import { Input } from '../../primitives';

export interface PeopleFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Names met before, offered as you type — free text, so nothing has to be set
   *  up before the first meeting with someone. */
  suggestions: string[];
}

/** Who was there: a chip per name and a field to add the next. ↵ or a comma adds
 *  what is typed, ⌫ on an empty field takes the last chip back. The suggestions
 *  are a native `<datalist>`: the browser already filters and keyboards it. */
export function PeopleField({ value, onChange, suggestions }: PeopleFieldProps) {
  const [text, setText] = useState('');
  const listId = useId();
  const present = new Set(value.map((p) => p.toLowerCase()));

  const add = (raw: string) => {
    const name = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    setText('');
    if (name && !present.has(name.toLowerCase())) {
      onChange([...value, name]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {value.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-[4px] h-[26px] pl-[9px] pr-[4px] rounded-full border border-neutral-400 bg-neutral-150 text-chip text-neutral-800"
        >
          {name}
          <button
            type="button"
            onClick={() => onChange(value.filter((p) => p !== name))}
            aria-label={`Remove ${name}`}
            className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full cursor-pointer text-neutral-650 hover:bg-neutral-300 hover:text-neutral-825"
          >
            <XIcon size={11} aria-hidden="true" />
          </button>
        </span>
      ))}
      <Input
        size="sm"
        value={text}
        list={listId}
        placeholder={value.length ? 'Add someone…' : 'Who was there?'}
        aria-label="Add a person"
        className="w-[180px]"
        onChange={(e) => {
          // Picking a suggestion fills the field in one go; a typed comma ends a name.
          const next = e.target.value;
          if (next.includes(',')) {
            add(next);
          } else {
            setText(next);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(text)}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !present.has(s.toLowerCase()))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
