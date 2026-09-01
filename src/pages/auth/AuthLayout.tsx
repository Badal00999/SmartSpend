import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-500 to-emerald-500 lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-md text-center text-white"
        >
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 text-5xl backdrop-blur-md">
            ₹
          </div>
          <h2 className="mb-4 text-4xl font-bold tracking-tight">Money that tracks itself</h2>
          <p className="mb-8 text-lg text-indigo-100">
            Parse bank SMS, use voice input, and let SmartSpend auto-categorize every rupee automatically.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { emoji: '💬', label: 'SMS Parsing' },
              { emoji: '🎙️', label: 'Voice Input' },
              { emoji: '📊', label: 'Smart Insights' }
            ].map((f) => (
              <div key={f.label} className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                <div className="mb-1 text-3xl">{f.emoji}</div>
                <div className="text-xs font-medium">{f.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-xl text-white">
              ₹
            </div>
            <span className="text-lg font-bold">SmartSpend</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mb-8 mt-2 text-sm text-muted-foreground">{subtitle}</p>
          {children}
          <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>
        </motion.div>
      </div>
    </div>
  );
}

export function AuthBrandLink() {
  return (
    <Link to="/" className="font-semibold text-primary hover:underline">
      SmartSpend
    </Link>
  );
}
