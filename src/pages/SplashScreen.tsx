import { motion } from 'framer-motion';

export function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-indigo-600 via-indigo-500 to-emerald-500">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 text-5xl text-white backdrop-blur-md"
      >
        ₹
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center text-white"
      >
        <div className="text-2xl font-bold tracking-tight">SmartSpend</div>
        <div className="text-sm text-indigo-100">Automatic Expense Tracker</div>
      </motion.div>
      <motion.div
        className="h-1 w-24 overflow-hidden rounded-full bg-white/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="h-full bg-white"
          initial={{ x: -96 }}
          animate={{ x: 96 }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
      </motion.div>
    </div>
  );
}
