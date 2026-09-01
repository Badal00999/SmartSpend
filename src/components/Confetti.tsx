import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface ConfettiProps {
  trigger: boolean;
}

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#3B82F6'];

export function Confetti({ trigger }: ConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.4 + Math.random() * 1.2,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
        rotate: Math.random() * 360
      })),
    []
  );

  if (!trigger) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: p.left + 'vw', opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', x: `${p.left + (Math.random() * 10 - 5)}vw`, rotate: p.rotate + 360, opacity: [1, 1, 0.6] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          className="absolute rounded-sm"
          style={{ width: p.size, height: p.size, backgroundColor: p.color, left: 0, top: 0 }}
        />
      ))}
    </div>
  );
}
