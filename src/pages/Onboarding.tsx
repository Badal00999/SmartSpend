import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, ArrowLeft, Wallet, Check, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import { DEFAULT_CATEGORIES, CATEGORY_ICON_CHOICES } from '@/lib/seed';
import { CURRENCIES } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Confetti } from '@/components/Confetti';

export default function Onboarding() {
  const navigate = useNavigate();
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState('');
  const [selectedCats, setSelectedCats] = useState<string[]>(DEFAULT_CATEGORIES.map((c) => c.name));
  const [currency, setCurrency] = useState('INR');
  const [done, setDone] = useState(false);

  const toggleCat = (name: string) => {
    setSelectedCats((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  };

  const finish = async () => {
    const sym = CURRENCIES.find((c) => c.code === currency)?.symbol ?? '₹';
    await completeOnboarding(parseFloat(budget) || 0, selectedCats, currency, sym);
    setDone(true);
    toast.success('Welcome to SmartSpend! 🎉');
    setTimeout(() => navigate('/'), 1800);
  };

  const steps = [
    {
      title: 'Set your monthly budget',
      subtitle: 'How much do you plan to spend each month?',
      content: (
        <div className="space-y-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
              {CURRENCIES.find((c) => c.code === currency)?.symbol ?? '₹'}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="25000"
              className="h-20 pl-12 text-4xl font-bold"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              autoFocus
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            We'll alert you as you approach this limit
          </p>
        </div>
      )
    },
    {
      title: 'Pick your categories',
      subtitle: 'Select the categories you want to track',
      content: (
        <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {DEFAULT_CATEGORIES.map((c) => {
            const selected = selectedCats.includes(c.name);
            return (
              <button
                key={c.name}
                onClick={() => toggleCat(c.name)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl border-2 p-4 text-center transition-all active:scale-95',
                  selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'
                )}
              >
                <span className="text-3xl">{c.icon}</span>
                <span className="text-xs font-medium">{c.name}</span>
                {selected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      )
    },
    {
      title: 'Choose your currency',
      subtitle: 'SmartSpend supports multiple currencies',
      content: (
        <div className="grid gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => setCurrency(c.code)}
              className={cn(
                'flex items-center justify-between rounded-2xl border-2 px-5 py-4 transition-all active:scale-95',
                currency === c.code ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{c.symbol}</span>
                <div className="text-left">
                  <div className="text-sm font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.code}</div>
                </div>
              </div>
              {currency === c.code && <Check className="h-5 w-5 text-primary" />}
            </button>
          ))}
        </div>
      )
    }
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-white p-4 dark:from-indigo-950/40 dark:to-background">
      <Confetti trigger={done} />
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-xl text-white">
          ₹
        </div>
        <span className="text-lg font-bold">SmartSpend</span>
      </div>

      <div className="mb-6 flex gap-2">
        {steps.map((_, i) => (
          <div key={i} className={cn('h-1.5 w-16 rounded-full transition-all', i <= step ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>

      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl border bg-card p-6 shadow-glass-lg sm:p-8"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {step === 0 ? <Wallet className="h-5 w-5" /> : step === 1 ? <Check className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div>
                <h1 className="text-lg font-bold">{steps[step].title}</h1>
                <p className="text-xs text-muted-foreground">{steps[step].subtitle}</p>
              </div>
            </div>
            {steps[step].content}
            <div className="mt-6 flex justify-between">
              {step > 0 ? (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              ) : (
                <span />
              )}
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep((s) => s + 1)}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="lg" onClick={finish} disabled={selectedCats.length === 0}>
                  Get started <Sparkles className="h-4 w-4" />
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {CATEGORY_ICON_CHOICES.slice(0, 8).map((icon, i) => (
          <motion.span key={i} animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2 + i * 0.3, delay: i * 0.2 }} className="text-2xl opacity-60">
            {icon}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
