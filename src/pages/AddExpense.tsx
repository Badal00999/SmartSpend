import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Search, Camera, RefreshCw, X, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { detectCategory } from '@/lib/merchantMap';
import { toDateOnly } from '@/lib/utils';
import { SuccessAnimation } from '@/components/SuccessAnimation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Expense, PaymentMethod, RecurringFrequency } from '@/lib/types';

const PAYMENT_METHODS: PaymentMethod[] = ['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Net Banking', 'Wallet'];
const FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

export default function AddExpense() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const user = useStore((s) => s.user);
  const categories = useStore((s) => s.categories);
  const expenses = useStore((s) => s.expenses);
  const addExpense = useStore((s) => s.addExpense);
  const updateExpense = useStore((s) => s.updateExpense);

  const editing = editId ? expenses.find((e) => e.id === editId) : undefined;

  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '');
  const [merchant, setMerchant] = useState(editing?.merchant_name ?? '');
  const [date, setDate] = useState(editing?.date ?? toDateOnly(new Date()));
  const [method, setMethod] = useState<PaymentMethod>(editing?.payment_method ?? 'UPI');
  const [note, setNote] = useState(editing?.description ?? '');
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [isRecurring, setIsRecurring] = useState(editing?.is_recurring ?? false);
  const [frequency, setFrequency] = useState<RecurringFrequency>(editing?.recurring_frequency ?? 'monthly');
  const [receipt, setReceipt] = useState<string | undefined>(editing?.receipt_url);
  const [catSearch, setCatSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const symbol = user?.currency_symbol ?? '₹';

  const merchantSuggestions = useMemo(() => {
    const names = [...new Set(expenses.map((e) => e.merchant_name).filter(Boolean))].filter((n) =>
      n.toLowerCase().includes(merchant.toLowerCase())
    );
    return names.slice(0, 5);
  }, [expenses, merchant]);

  useEffect(() => {
    if (!categoryId && merchant) {
      const detected = detectCategory(merchant);
      if (detected) {
        const cat = categories.find((c) => c.name === detected);
        if (cat) setCategoryId(cat.id);
      }
    }
  }, [merchant, categoryId, categories]);

  const filteredCats = useMemo(
    () => categories.filter((c) => c.name.toLowerCase().includes(catSearch.toLowerCase())),
    [categories, catSearch]
  );

  const handleTagAdd = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image too large (max 2MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceipt(reader.result as string);
      toast.success('Receipt attached');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setError('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError('Please enter a valid amount');
    if (!categoryId) return setError('Please select a category');
    if (!merchant.trim()) return setError('Please enter a merchant name');

    const data = {
      amount: amt,
      merchant_name: merchant.trim(),
      category_id: categoryId,
      payment_method: method,
      source: 'manual' as const,
      date,
      description: note.trim() || undefined,
      is_recurring: isRecurring,
      recurring_frequency: isRecurring ? frequency : undefined,
      receipt_url: receipt,
      tags: tags.length ? tags : undefined,
      time: new Date().toTimeString().slice(0, 5)
    };

    try {
      if (editing) {
        await updateExpense(editing.id, data);
        toast.success('Expense updated');
        navigate('/history');
      } else {
        await addExpense(data);
        setSuccess(true);
        toast.success('Expense added');
        setTimeout(() => navigate('/'), 1500);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <SuccessAnimation show={success} title="Expense Saved!" subtitle="Dashboard updated instantly" onDone={() => navigate('/')} />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{editing ? 'Edit Expense' : 'Add Expense'}</h1>

      <div className="space-y-5">
        <div className="rounded-3xl border bg-card p-6 text-center shadow-glass">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</div>
          <div className="mt-2 flex items-center justify-center gap-1">
            <span className="text-3xl font-bold text-muted-foreground">{symbol}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-48 bg-transparent text-center text-5xl font-bold outline-none placeholder:text-muted-foreground/30"
              autoFocus
            />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {[100, 250, 500, 1000, 2000].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="rounded-lg bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {symbol}{v}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search categories..." className="pl-10" value={catSearch} onChange={(e) => setCatSearch(e.target.value)} />
          </div>
          <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
            {filteredCats.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition-all active:scale-95',
                  categoryId === c.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
                )}
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-[10px] font-medium leading-tight text-center">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Merchant name</Label>
          <Input placeholder="e.g. Zomato, Amazon, Uber" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          {merchantSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {merchantSuggestions.map((m) => (
                <button key={m} onClick={() => setMerchant(m)} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary">
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} max={toDateOnly(new Date())} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Payment method</Label>
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                    method === m ? 'bg-primary text-primary-foreground shadow' : 'bg-muted text-muted-foreground hover:bg-accent'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Note <span className="text-muted-foreground">(optional)</span></Label>
          <Textarea placeholder="What was this for?" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex gap-2">
            <Input placeholder="Add a tag, press Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleTagAdd())} />
            <Button variant="outline" onClick={handleTagAdd}><Plus className="h-4 w-4" /></Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1 pr-1">
                  #{t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
          <div>
            <div className="text-sm font-medium">Recurring expense</div>
            <div className="text-xs text-muted-foreground">EMIs, subscriptions, rent...</div>
          </div>
          <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
        </div>

        <AnimatePresence>
          {isRecurring && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <div className="flex flex-wrap gap-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className={cn(
                      'rounded-full px-4 py-2 text-xs font-medium capitalize transition-all',
                      frequency === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
            <Camera className="h-4 w-4" />
            {receipt ? 'Receipt attached — tap to replace' : 'Attach receipt photo'}
          </Button>
          {receipt && (
            <div className="relative mt-2">
              <img src={receipt} alt="Receipt" className="h-28 w-full rounded-xl object-cover" />
              <button onClick={() => setReceipt(undefined)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {error && <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

        <Button onClick={handleSubmit} size="lg" className="w-full" variant="gradient">
          <RefreshCw className="h-4 w-4" />
          {editing ? 'Update Expense' : 'Save Expense'}
        </Button>
      </div>
    </div>
  );
}
