import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { format, parseISO, addMonths, addWeeks, addDays, addYears } from 'date-fns';
import { RefreshCw, Plus, Trash2, Pencil, CalendarDays, Repeat, AlertCircle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatMoney, formatDatePretty } from '@/lib/format';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { CategoryIcon } from '@/components/CategoryIcon';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PERIOD_LABELS = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' } as const;

export default function Recurring() {
  const user = useStore((s) => s.user);
  const categories = useStore((s) => s.categories);
  const expenses = useStore((s) => s.expenses);
  const income = useStore((s) => s.income);
  const addExpense = useStore((s) => s.addExpense);
  const updateExpense = useStore((s) => s.updateExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const addIncome = useStore((s) => s.addIncome);
  const deleteIncome = useStore((s) => s.deleteIncome);

  const [modal, setModal] = useState<{ open: boolean; id?: string; isIncome?: boolean }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; isIncome: boolean; name: string } | null>(null);
  const [form, setForm] = useState({
    merchant: '', amount: '', category_id: '', frequency: 'monthly',
    method: 'UPI', isIncome: false, source: 'Salary'
  });

  const symbol = user?.currency_symbol ?? '₹';
  const code = user?.currency ?? 'INR';

  const recurringExpenses = useMemo(() => expenses.filter((e) => e.is_recurring), [expenses]);
  const recurringIncome = useMemo(() => income.filter((i) => i.is_recurring), [income]);

  const monthlyTotal = useMemo(() => {
    const monthly = (freq: string, amt: number) => {
      if (freq === 'monthly') return amt;
      if (freq === 'weekly') return amt * 4.33;
      if (freq === 'daily') return amt * 30;
      if (freq === 'yearly') return amt / 12;
      return amt;
    };
    return recurringExpenses.reduce((s, e) => s + monthly(e.recurring_frequency ?? 'monthly', e.amount), 0);
  }, [recurringExpenses]);

  const nextDate = (dateStr: string, freq: string) => {
    const d = parseISO(dateStr);
    if (freq === 'daily') return addDays(d, 1);
    if (freq === 'weekly') return addWeeks(d, 1);
    if (freq === 'monthly') return addMonths(d, 1);
    return addYears(d, 1);
  };

  const upcoming = useMemo(() => {
    const items = recurringExpenses.map((e) => ({
      id: e.id,
      name: e.merchant_name,
      amount: e.amount,
      next: nextDate(e.date, e.recurring_frequency ?? 'monthly'),
      category_id: e.category_id,
      isIncome: false
    }));
    const inc = recurringIncome.map((i) => ({
      id: i.id,
      name: i.source_name,
      amount: i.amount,
      next: nextDate(i.date, i.recurring_frequency ?? 'monthly'),
      category_id: '',
      isIncome: true
    }));
    return [...items, ...inc].sort((a, b) => a.next.getTime() - b.next.getTime()).slice(0, 12);
  }, [recurringExpenses, recurringIncome]);

  const openAdd = (isIncome: boolean) => {
    setForm({
      merchant: '', amount: '', category_id: categories[0]?.id ?? '',
      frequency: 'monthly', method: 'UPI', isIncome, source: 'Salary'
    });
    setModal({ open: true, isIncome });
  };

  const openEdit = (id: string, isIncome: boolean) => {
    if (isIncome) {
      const inc = income.find((i) => i.id === id);
      if (!inc) return;
      setForm({
        merchant: inc.source_name, amount: String(inc.amount), category_id: '',
        frequency: inc.recurring_frequency ?? 'monthly', method: 'UPI', isIncome: true, source: inc.source_name
      });
    } else {
      const e = expenses.find((x) => x.id === id);
      if (!e) return;
      setForm({
        merchant: e.merchant_name, amount: String(e.amount), category_id: e.category_id,
        frequency: e.recurring_frequency ?? 'monthly', method: e.payment_method, isIncome: false, source: ''
      });
    }
    setModal({ open: true, id, isIncome });
  };

  const save = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return toast.error('Enter a valid amount');
    if (!form.merchant.trim()) return toast.error('Enter a name');
    try {
      if (modal.id) {
        if (modal.isIncome) {
          await deleteIncome(modal.id);
          await addIncome({ amount: amt, source_name: form.merchant.trim(), date: format(new Date(), 'yyyy-MM-dd'), is_recurring: true, recurring_frequency: form.frequency as never, description: 'Recurring income' });
        } else {
          await updateExpense(modal.id, { amount: amt, merchant_name: form.merchant.trim(), recurring_frequency: form.frequency as never });
        }
        toast.success('Recurring item updated');
      } else {
        if (form.isIncome) {
          await addIncome({ amount: amt, source_name: form.merchant.trim(), date: format(new Date(), 'yyyy-MM-dd'), is_recurring: true, recurring_frequency: form.frequency as never, description: 'Recurring income' });
        } else {
          await addExpense({
            amount: amt, merchant_name: form.merchant.trim(), category_id: form.category_id,
            payment_method: form.method as never, source: 'manual', date: format(new Date(), 'yyyy-MM-dd'),
            is_recurring: true, recurring_frequency: form.frequency as never, tags: ['recurring']
          });
        }
        toast.success('Recurring item added');
      }
      setModal({ open: false });
    } catch {
      toast.error('Failed to save');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.isIncome) await deleteIncome(deleteTarget.id);
    else await deleteExpense(deleteTarget.id);
    toast.success('Removed');
    setDeleteTarget(null);
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
            <Repeat className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Recurring Expenses</h1>
            <p className="text-xs text-muted-foreground">EMIs, subscriptions, rent</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openAdd(true)}>
            <Plus className="h-4 w-4" /> Income
          </Button>
          <Button size="sm" onClick={() => openAdd(false)} variant="gradient">
            <Plus className="h-4 w-4" /> Expense
          </Button>
        </div>
      </div>

      <div className="mb-5 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-glass-lg">
        <div className="flex items-center justify-between text-sm text-amber-100">
          <span className="flex items-center gap-1.5"><RefreshCw className="h-4 w-4" /> Monthly recurring outflow</span>
          <span>{recurringExpenses.length} items</span>
        </div>
        <div className="mt-2 text-4xl font-bold">
          <AnimatedNumber value={monthlyTotal} symbol={symbol} code={code} />
        </div>
      </div>

      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <CalendarDays className="h-4 w-4 text-primary" /> Upcoming
      </h2>
      {upcoming.length === 0 ? (
        <EmptyState
          icon={<Repeat className="h-8 w-8 text-primary" />}
          title="No recurring items"
          description="Add EMIs, subscriptions or rent to see them here."
        />
      ) : (
        <div className="mb-6 space-y-2">
          {upcoming.map((u) => {
            const cat = categories.find((c) => c.id === u.category_id);
            return (
              <motion.div key={u.id} className="flex items-center gap-3 rounded-2xl border bg-card/70 p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {u.isIncome ? <span className="text-lg">💰</span> : <CategoryIcon icon={cat?.icon ?? '📦'} color={cat?.color ?? '#6366F1'} size="sm" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{u.name}</div>
                  <div className="text-xs text-muted-foreground">Next: {format(u.next, 'MMM d')}</div>
                </div>
                <div className={cn('text-sm font-bold', u.isIncome ? 'text-emerald-500' : 'text-foreground')}>
                  {u.isIncome ? '+' : '-'}{formatMoney(u.amount, symbol, code)}
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u.id, u.isIncome)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteTarget({ id: u.id, isIncome: u.isIncome, name: u.name })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 font-semibold">All recurring expenses</h2>
      {recurringExpenses.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No recurring expenses yet.</p>
      ) : (
        <div className="space-y-2">
          {recurringExpenses.map((e) => {
            const cat = categories.find((c) => c.id === e.category_id);
            return (
              <div key={e.id} className="flex items-center gap-3 rounded-2xl border bg-card/70 p-3 shadow-sm">
                <CategoryIcon icon={cat?.icon ?? '📦'} color={cat?.color ?? '#6366F1'} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{e.merchant_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Every {PERIOD_LABELS[e.recurring_frequency ?? 'monthly']} · since {formatDatePretty(e.date)}
                  </div>
                </div>
                <div className="text-sm font-bold">{formatMoney(e.amount, symbol, code)}</div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(e.id, false)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteTarget({ id: e.id, isIncome: false, name: e.merchant_name })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-muted-foreground">
          Reminders are shown in-app when a recurring expense's date arrives. Enable notifications in Settings for the full experience.
        </p>
      </div>

      <Dialog open={modal.open} onOpenChange={(o) => setModal({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal.id ? 'Edit' : 'Add'} recurring {modal.isIncome ? 'income' : 'expense'}</DialogTitle>
            <DialogDescription>This will repeat automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{modal.isIncome ? 'Source name' : 'Name / Merchant'}</Label>
              <Input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="e.g. Netflix, Rent, Phone EMI" />
            </div>
            <div className="space-y-2">
              <Label>Amount ({symbol})</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="500" />
            </div>
            {!modal.isIncome && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['daily', 'weekly', 'monthly', 'yearly'].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal({ open: false })}>Cancel</Button>
            <Button onClick={save}>{modal.id ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This recurring item will no longer be tracked.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
