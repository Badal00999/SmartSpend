import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/format';

interface AnimatedNumberProps {
  value: number;
  symbol?: string;
  code?: string;
  className?: string;
  showDecimals?: boolean;
  duration?: number;
}

export function AnimatedNumber({
  value,
  symbol = '₹',
  code = 'INR',
  className,
  showDecimals = false,
  duration = 800
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      prevRef.current = to;
    };
  }, [value, duration]);

  return <span className={className}>{formatMoney(display, symbol, code, showDecimals)}</span>;
}
