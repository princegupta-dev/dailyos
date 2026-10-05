import { useId, type CSSProperties, type ReactNode } from 'react';

interface ProgressRingProps {
  value: number;
  max: number;
  /** Accessible description, e.g. "3 of 5 habits done today". */
  label: string;
  size?: number;
  /** Ring thickness in pixels. */
  stroke?: number;
  /** `gradient` paints the value arc with the brand gradient. */
  tone?: 'solid' | 'gradient';
  /** Content centered inside the ring, e.g. a percentage. Decorative: `label` is announced. */
  children?: ReactNode;
}

/**
 * Circular progress indicator. Shows a neutral ring when there's nothing to do. The arc
 * fills from empty when it first appears and eases to new values afterwards.
 */
export function ProgressRing({
  value,
  max,
  label,
  size = 64,
  stroke = 6,
  tone = 'solid',
  children,
}: ProgressRingProps) {
  const gradientId = useId();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = max === 0 ? 0 : Math.min(value / max, 1);
  const ring = (
    <svg
      className="progress-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      style={{ '--ring-length': circumference } as CSSProperties}
    >
      {tone === 'gradient' && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6b8758" />
            <stop offset="55%" stopColor="#4a6b4f" />
            <stop offset="100%" stopColor="#38543d" />
          </linearGradient>
        </defs>
      )}
      <circle
        className="progress-ring__track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        className="progress-ring__value"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={tone === 'gradient' ? { stroke: `url(#${gradientId})` } : undefined}
      />
    </svg>
  );
  if (children === undefined) return ring;
  return (
    <div className="progress-ring-wrap" style={{ width: size, height: size }}>
      {ring}
      <div className="progress-ring-wrap__center" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}
