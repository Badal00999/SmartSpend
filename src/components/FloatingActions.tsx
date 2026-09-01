import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, Receipt, Mic, X } from 'lucide-react';
import { useStore } from '@/lib/store';

export function FloatingActions() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const expenses = useStore((s) => s.expenses);

  const actions = [
    {
      label: 'Add Expense',
      icon: Receipt,
      color: '#6366F1',
      onClick: () => {
        setOpen(false);
        navigate('/add-expense');
      }
    },
    {
      label: 'Add Income',
      icon: TrendingUp,
      color: '#10B981',
      onClick: () => {
        setOpen(false);
        navigate('/add-income');
      }
    },
    {
      label: 'Voice Input',
      icon: Mic,
      color: '#F59E0B',
      onClick: () => {
        setOpen(false);
        navigate('/voice');
      }
    },
    {
      label: 'Parse SMS',
      icon: Receipt,
      color: '#8B5CF6',
      onClick: () => {
        setOpen(false);
        navigate('/sms');
      }
    }
  ];

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3 lg:bottom-8 lg:right-8">
      <AnimatePresence>
        {open && (
          <div className="flex flex-col items-end gap-2">
            {actions.map(({ label, icon: Icon, color, onClick }) => (
              <motion.button
                key={label}
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                onClick={onClick}
                className="group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground shadow-glass-lg backdrop-blur-md"
                style={{ backgroundColor: `${color}1a` }}
              >
                <span>{label}</span>
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.9 }}
        animate={{ rotate: open ? 45 : 0 }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-glass-lg"
        aria-label={open ? 'Close' : 'Quick actions'}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </motion.button>
      {expenses.length === 0 && open && (
        <div className="rounded-lg bg-popover px-3 py-1 text-xs text-muted-foreground shadow-lg">
          Tip: try Voice Input or Parse SMS for auto-tracking!
        </div>
      )}
    </div>
  );
}
