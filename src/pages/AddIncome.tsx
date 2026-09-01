import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TrendingUp, Calendar } from 'lucide-react';
import { useStore } from '@/lib/store';
import { toDateOnly } from '@/lib/utils';
import { SuccessAnimation } from '@/components/SuccessAnimation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { RecurringFrequency } from '@/lib/types';

const SOURCES = ['Salary', 'Freelance', 'Investment', 'Gift', 'Refund', 'Other'];
const FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

export default function AddIncome() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const user = useStore((s) => s.user);
  const income = useStore((s) => s.income);
  const addIncome = useStore((s) => s.addIncome);
  const updateIncome = useStore((s) => s.updateIncome);

  const editing = editId ? income.find((i) => i.id === editId) : undefined;

  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [source, setSource] = useState(editing?.source_name ?? 'Salary');
  const [date, setDate] = useState(editing?.date ?? toDateOnly(new Date()));
  const [note, setNote] = useState(editing?.description ?? '');
  const [isRecurring, setIsRecurring] = useState(editing?.is_recurring ?? false);
  const [frequency, setFrequency] = useState<RecurringFrequency>(editing?.recurring_frequency ?? 'monthly');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const symbol = user?.currency_symbol ?? '₹';

  const handleSubmit = async () => {
    setError('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError('Please enter a valid amount');
    if (!source.trim()) return setError('Please enter the income source');

    const data = {
      amount: amt,
      source_name: source.trim(),
      description: note.trim() || undefined,
      date,
      is_recurring: isRecurring,
      recurring_frequency: isRecurring ? frequency : undefined
    };

    try {
      if (editing) {
        await updateIncome(editing.id, data);
        toast.success('Income updated');
        navigate('/history');
      } else {
        await addIncome(data);
        setSuccess(true);
        toast.success('Income added');
        setTimeout(() => navigate('/'), 1500);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <SuccessAnimation show={success} title="Income Added!" subtitle="Nice — money coming in 💪" onDone={() => navigate('/')} />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{editing ? 'Edit Income' : 'Add Income'}</h1>

      <div className="space-y-5">
        <div className="rounded-3xl border bg-card p-6 text-center shadow-glass">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</div>
          <div className="mt-2 flex items-center justify-center gap-1 text-emerald-500">
            <span className="text-3xl font-bold text-emerald-500/60">{symbol}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-48 bg-transparent text-center text-5xl font-bold text-emerald-500 outline-none placeholder:text-muted-foreground/30"
              autoFocus
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Source</Label>
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={cn(
                  'rounded-full px-4 py-2 text-xs font-medium transition-all',
                  source === s ? 'bg-emerald-500 text-white shadow' : 'bg-muted text-muted-foreground hover:bg-accent'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Date</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" className="pl-10" value={date} max={toDateOnly(new Date())} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea placeholder="e.g. March salary, freelance project..." value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div>
            <div className="text-sm font-medium">Recurring income</div>
            <div className="text-xs text-muted-foreground">Salary, monthly dividends...</div>
          </div>
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
        </div>

        {isRecurring && (
          <div className="flex flex-wrap gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={cn(
                  'rounded-full px-4 py-2 text-xs font-medium capitalize transition-all',
                  frequency === f ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {error && <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

        <Button onClick={handleSubmit} size="lg" className="w-full bg-emerald-500 hover:bg-emerald-600">
          <TrendingUp className="h-4 w-4" />
          {editing ? 'Update Income' : 'Save Income'}
        </Button>
      </div>
    </div>
  );
}
