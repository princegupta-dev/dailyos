import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A number that eases from its previous value to `target`, for display only. Shows the
 * target directly when the person prefers reduced motion. Announce the real value separately.
 */
export function useCountUp(target: number, durationMs = 700): number {
  const reduced = prefersReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduced) return;
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // Ease-out cubic: quick start, gentle landing.
      const value = Math.round(origin + (target - origin) * (1 - (1 - t) ** 3));
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target, durationMs, reduced]);

  return reduced ? target : shown;
}
