import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Animates a numeric value counting up (or down) to its target whenever it
 * changes, instead of the digits jumping straight to the new value.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 700, formatter, className, style }) => {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;

    if (from === to || prefersReducedMotion()) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const rounded = Math.round(display);
  const text = formatter ? formatter(rounded) : rounded.toLocaleString('fr-FR');

  return (
    <span className={className} style={style}>
      {text}
    </span>
  );
};

export default AnimatedNumber;
