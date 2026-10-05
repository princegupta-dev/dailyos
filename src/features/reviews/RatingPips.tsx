import { formatRating } from './format';

/**
 * A rating (or an average) as five small pips, the number beside them. An average such as 3.5
 * half-fills the fourth pip.
 */
export function RatingPips({
  rating,
  showValue = true,
  tone = 'default',
}: {
  rating: number;
  showValue?: boolean;
  tone?: 'default' | 'on-dark';
}) {
  return (
    <span
      className={`rating-pips${tone === 'on-dark' ? ' rating-pips--on-dark' : ''}`}
      role="img"
      aria-label={`Rated ${formatRating(rating)} of 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, rating - (n - 1)));
        return (
          <span
            key={n}
            className={`rating-pips__pip${fill >= 1 ? ' rating-pips__pip--on' : fill > 0 ? ' rating-pips__pip--half' : ''}`}
          />
        );
      })}
      {showValue && <span className="rating-pips__value">{formatRating(rating)}</span>}
    </span>
  );
}
