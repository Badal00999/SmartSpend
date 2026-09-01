import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface SuccessAnimationProps {
  show: boolean;
  title?: string;
  subtitle?: string;
  onDone?: () => void;
}

export function SuccessAnimation({ show, title = 'Saved!', subtitle = 'Transaction recorded', onDone }: SuccessAnimationProps) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(() => onDone?.(), 1400);
      return () => clearTimeout(t);
    }
  }, [show, onDone]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <motion.div
          animate={{ rotate: [0, 12, -12, 0] }}
          transition={{ repeat: 2, duration: 0.4 }}
        >
          <CheckCircle2 className="h-24 w-24 text-emerald-500" />
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="text-xl font-bold">{title}</div>
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      </motion.div>
    </motion.div>
  );
}
