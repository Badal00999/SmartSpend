import { useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const startY = useRef(0);
  const [pulling, setPulling] = useState(false);
  const [dist, setDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && window.scrollY <= 0) {
      setDist(Math.min(dy * 0.5, 90));
      e.preventDefault();
    }
  };

  const handleTouchEnd = async () => {
    if (!pulling) return;
    setPulling(false);
    if (dist > 50 && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setRefreshing(false), 400);
      }
    }
    setDist(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn('relative select-none', className)}
    >
      <div
        className="flex justify-center overflow-hidden transition-all duration-300"
        style={{ height: refreshing ? 48 : dist }}
      >
        <RefreshCw className={cn('mt-3 text-primary', (refreshing || dist > 50) && 'animate-spin')} />
      </div>
      {children}
    </div>
  );
}
