import { Plus, X } from 'lucide-react';
import { useId, useState } from 'react';

interface TagInputProps {
  label: string;
  tags: readonly string[];
  onChange: (tags: string[]) => void;
  /** Optional suggestions shown as tappable chips. Never applied automatically. */
  suggestions?: readonly string[];
  max?: number;
}

/** Manual tag entry with optional one-tap suggestions. */
export function TagInput({ label, tags, onChange, suggestions = [], max = 20 }: TagInputProps) {
  const inputId = useId();
  const [draft, setDraft] = useState('');
  const has = (tag: string) => tags.some((t) => t.toLowerCase() === tag.toLowerCase());
  const add = (raw: string) => {
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (tag === '' || has(tag) || tags.length >= max) return;
    onChange([...tags, tag]);
  };
  const open = suggestions.filter((s) => !has(s));

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      {tags.length > 0 && (
        <ul className="chip-list" aria-label="Selected tags">
          {tags.map((tag) => (
            <li key={tag} className="removable-chip">
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => {
                  onChange(tags.filter((t) => t !== tag));
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="inline-form">
        <input
          id={inputId}
          className="input"
          placeholder="Add a tag"
          value={draft}
          maxLength={40}
          autoComplete="off"
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
              setDraft('');
            }
          }}
        />
        <button
          type="button"
          className="button button--secondary button--compact"
          disabled={draft.trim() === ''}
          onClick={() => {
            add(draft);
            setDraft('');
          }}
        >
          Add
        </button>
      </div>
      {open.length > 0 && (
        <div className="suggestions">
          <span className="field__hint">Suggested</span>
          <ul className="chip-list" aria-label="Suggested tags">
            {open.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  className="chip chip--suggestion"
                  aria-label={`Add suggested tag ${tag}`}
                  onClick={() => {
                    add(tag);
                  }}
                >
                  <Plus size={14} aria-hidden="true" /> {tag}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
