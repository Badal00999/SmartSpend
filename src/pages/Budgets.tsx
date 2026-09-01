import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  Wallet, Plus, Trash2, Pencil, Target, BellRing, TrendingUp
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatMoney } from '@/lib/format';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { CategoryIcon } from '@/components/CategoryIcon';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function Budgets() {
  const user = useStore((s) => s.user);
  const categories = useStore((s) => s.categories);
  const expenses = useStore((s) => s.expenses);
  const budgets = useStore((s) => s.budgets);
  const updateProfile = useStore((s) => s.updateProfile);
  const addBudget = useStore((s) => s.addBudget);
  const updateBudget = useStore((s) => s.updateBudget);
  const deleteBudget = useStore((s) => s.deleteBudget);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState(String(user?.monthly_budget ?? 0));
  const [form, setForm] = useState({ category_id: '', amount: '', period: 'monthly' });

  const symbol = user?.currency_symbol ?? '₹';
  const code = user?.currency ?? 'INR';

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const monthTotal = useMemo(
    () => expenses.filter((e) => parseISO(e.date) >= monthStart && parseISO(e.date) <= monthEnd).reduce((s, e) => s + e.amount, 0),
    [expenses, monthStart, monthEnd]
  );

  const monthlyBudgetNum = user?.monthly_budget ?? 0;
  const monthlyUsage = monthlyBudgetNum > 0 ? (monthTotal / monthlyBudgetNum) * 100 : 0;

  const catBudgets = budgets.filter((b) => b.category_id);

  const spentForCat = (catId: string) =>
    expenses.filter((e) => e.category_id === catId && parseISO(e.date) >= monthStart && parseISO(e.date) <= monthEnd).reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setForm({ category_id: categories[0]?.id ?? '', amount: '', period: 'monthly' });
    setModal({ open: true });
  };

  const openEdit = (id: string) => {
    const b = budgets.find((x) => x.id === id);
    if (!b) return;
    setForm({ category_id: b.category_id ?? '', amount: String(b.amount), period: b.period });
    setModal({ open: true, id });
  };

  const saveBudget = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    if (!form.category_id) return toast.error('Select a category');
    try {
      if (modal.id) {
        await updateBudget(modal.id, { amount, category_id: form.category_id, period: form.period as never });
        toast.success('Budget updated');
      } else {
        await addBudget({ category_id: form.category_id, amount, period: form.period as never, start_date: format(new Date(), 'yyyy-MM-dd') });
        toast.success('Budget created');
      }
      setModal({ open: false });
    } catch {
      toast.error('Failed to save budget');
    }
  };

  const saveMonthly = async () => {
    const amt = parseFloat(monthlyBudget) || 0;
    await updateProfile({
      monthly_budget: amt,
      weekly_budget: Math.round(amt / 4),
      daily_budget: Math.round(amt / 30)
    });
    toast.success('Monthly budget updated');
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget Management</h1>
          <p className="text-xs text-muted-foreground">Track and control your spending</p>
        </div>
        <Button onClick={openAdd} variant="gradient" size="sm">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <div className="mb-4 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-5 text-white shadow-glass-lg">
        <div className="flex items-center justify-between text-sm text-indigo-200">
          <span className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4" /> Monthly budget
          </span>
          <span>{format(new Date(), 'MMMM yyyy')}</span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              onBlur={saveMonthly}
              className="w-36 bg-transparent text-3xl font-bold outline-none placeholder:text-indigo-300"
            />
            <span className="text-sm text-indigo-200">{symbol}</span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              <AnimatedNumber value={Math.max(0, monthlyBudgetNum - monthTotal)} symbol={symbol} code={code} />
            </div>
            <div className="text-xs text-indigo-200">remaining</div>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
          <div
            className={cn('h-full rounded-full transition-all duration-700', monthlyUsage >= 100 ? 'bg-red-400 animate-pulse' : monthlyUsage >= 85 ? 'bg-amber-400' : monthlyUsage >= 60 ? 'bg-yellow-300' : 'bg-emerald-400')}
            style={{ width: `${Math.min(100, monthlyUsage)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-indigo-200">
          <span>{formatMoney(monthTotal, symbol, code)} spent</span>
          <span>{Math.round(monthlyUsage)}%</span>
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 text-amber-500" />
          <div>
            <div className="text-sm font-medium">Budget alerts</div>
            <div className="text-xs text-muted-foreground">50% · 80% · 100% warnings</div>
          </div>
        </div>
        <Switch
          checked={settings.notifications.budget_alerts}
          onCheckedChange={(v) => updateSettings({ notifications: { ...settings.notifications, budget_alerts: v } })}
        />
      </div>

      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Target className="h-4 w-4 text-primary" /> Category budgets
      </h2>

      {catBudgets.length === 0 ? (
        <EmptyState
          icon={<Target className="h-8 w-8 text-primary" />}
          title="No category budgets yet"
          description="Set budgets for Food, Groceries, Shopping and more to get real-time alerts."
          action={<Button onClick={openAdd}><Plus className="h-4 w-4" /> Add budget</Button>}
        />
      ) : (
        <div className="space-y-3">
          {catBudgets.map((b) => {
            const cat = categories.find((c) => c.id === b.category_id);
            const spent = spentForCat(b.category_id ?? '');
            const usage = b.amount > 0 ? (spent / b.amount) * 100 : 0;
            return (
              <motion.div key={b.id} layout className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-3">
                  <CategoryIcon icon={cat?.icon ?? '📦'} color={cat?.color ?? '#6366F1'} size="sm" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{cat?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatMoney(spent, symbol, code)} of {formatMoney(b.amount, symbol, code)} spent
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(b.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Progress
                  value={Math.min(100, usage)}
                  indicatorClassName={usage >= 100 ? 'bg-red-500 animate-pulse' : usage >= 85 ? 'bg-red-400' : usage >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{b.period} budget</span>
                  <span className={cn(usage >= 100 && 'font-bold text-red-500')}>{Math.round(usage)}% used</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 mt-6 flex items-center gap-2 font-semibold">
        <TrendingUp className="h-4 w-4 text-emerald-500" /> Budget vs Actual
      </h2>
      <div className="space-y-2">
        {catBudgets.slice(0, 6).map((b) => {
          const cat = categories.find((c) => c.id === b.category_id);
          const spent = spentForCat(b.category_id ?? '');
          const diff = b.amount - spent;
          return (
            <div key={b.id} className="flex items-center justify-between rounded-xl border bg-card/60 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2">{cat?.icon} {cat?.name}</span>
              <span className={cn('font-medium', diff >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                {diff >= 0 ? '+' : ''}{formatMoney(diff, symbol, code)}
              </span>
            </div>
          );
        })}
      </div>

      <Dialog open={modal.open} onOpenChange={(o) => setModal({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal.id ? 'Edit budget' : 'Add category budget'}</DialogTitle>
            <DialogDescription>Set a spending limit for a category.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount ({symbol})</Label>
              <Input type="number" placeholder="5000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['daily', 'weekly', 'monthly', 'yearly'].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal({ open: false })}>Cancel</Button>
            <Button onClick={saveBudget}>{modal.id ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
            <AlertDialogDescription>You'll lose the spending limit for this category.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId) {
                  await deleteBudget(deleteId);
                  toast.success('Budget deleted');
                }
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
