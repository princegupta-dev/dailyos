import { useId } from 'react';
import { RATING_WORDS } from './format';

interface RatingFieldProps {
  legend: string;
  /** Accessible name of the radio group, e.g. "Rating for Morning run". */
  groupLabel: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

/**
 * A 1–5 rating as a row of radio buttons, with a way to clear it. The scale fills up to the
 * chosen value, and each step carries a word (Rough … Great) that is shown, not announced.
 */
export function RatingField({ legend, groupLabel, value, onChange }: RatingFieldProps) {
  const name = useId();
  return (
    <fieldset className="fieldset">
      <legend className="field__label rating-field__legend">
        {legend}
        {value !== undefined && (
          <span className="rating-field__word" aria-hidden="true">
            {RATING_WORDS[value - 1]}
          </span>
        )}
      </legend>
      <div
        className={`rating-scale${value !== undefined ? ` rating-scale--${value}` : ''}`}
        role="radiogroup"
        aria-label={groupLabel}
      >
        {[1, 2, 3, 4, 5].map((option) => (
          <label
            key={option}
            className={`rating-scale__option${value !== undefined && option < value ? ' rating-scale__option--filled' : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => {
                onChange(option);
              }}
            />
            <span className="rating-scale__number">{option}</span>
            <span className="rating-scale__word" aria-hidden="true">
              {RATING_WORDS[option - 1]}
            </span>
          </label>
        ))}
      </div>
      {value !== undefined && (
        <div className="rating-field__clear">
          <button
            type="button"
            className="link-button"
            onClick={() => {
              onChange(undefined);
            }}
          >
            Clear rating
          </button>
        </div>
      )}
    </fieldset>
  );
}
