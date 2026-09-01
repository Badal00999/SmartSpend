import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import {
  Search, Filter, ChevronDown, Pencil, Trash2, Download, X, ArrowUpDown,
  ReceiptText, RotateCcw, Eye, EyeOff
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatMoney, formatDatePretty, formatTime } from '@/lib/format';
import { expensesToCsv } from '@/lib/analytics';
import { downloadFile, toDateOnly, debounce } from '@/lib/utils';
import { EmptyState } from '@/components/EmptyState';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PullToRefresh } from '@/components/PullToRefresh';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '@/lib/types';

type Txn = {
  id: string;
  kind: 'expense' | 'income';
  merchant: string;
  amount: number;
  date: string;
  time?: string;
  categoryId?: string;
  paymentMethod?: PaymentMethod;
  description?: string;
  source?: string;
  tags?: string[];
};

const DATE_RANGES = [
  { label: 'Today', fn: () => toDateOnly(new Date()) },
  { label: 'This Week', fn: () => toDateOnly(startOfWeek(new Date())) },
  { label: 'This Month', fn: () => toDateOnly(startOfMonth(new Date())) },
  { label: 'All Time', fn: () => '1970-01-01' }
];

const PAGE_SIZE = 20;

export default function History() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = useStore((s) => s.user);
  const categories = useStore((s) => s.categories);
  const expenses = useStore((s) => s.expenses);
  const income = useStore((s) => s.income);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const deleteIncome = useStore((s) => s.deleteIncome);
  const restoreLastDeleted = useStore((s) => s.restoreLastDeleted);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [range, setRange] = useState(params.get('range') ?? 'This Month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [catFilter, setCatFilter] = useState<string[]>(params.get('category') ? [params.get('category')!] : []);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'All'>('All');
  const [amountMax, setAmountMax] = useState(5000);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState<Txn | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const symbol = user?.currency_symbol ?? '₹';
  const code = user?.currency ?? 'INR';

  useEffect(() => {
    const d = debounce((v: string) => setDebouncedQuery(v), 300);
    d(query);
  }, [query]);

  const maxAmount = useMemo(() => Math.max(amountMax, ...expenses.map((e) => e.amount)), [expenses, amountMax]);

  const txns: Txn[] = useMemo(() => {
    const all: Txn[] = [
      ...expenses.map((e) => ({
        id: e.id,
        kind: 'expense' as const,
        merchant: e.merchant_name,
        amount: e.amount,
        date: e.date,
        time: e.time,
        categoryId: e.category_id,
        paymentMethod: e.payment_method,
        description: e.description,
        source: e.source,
        tags: e.tags
      })),
      ...income.map((i) => ({
        id: i.id,
        kind: 'income' as const,
        merchant: i.source_name,
        amount: i.amount,
        date: i.date,
        description: i.description,
        categoryId: undefined
      }))
    ];

    const rangeStart = range === 'Custom' ? customFrom : DATE_RANGES.find((r) => r.label === range)?.fn() ?? '1970-01-01';
    const rangeEnd = range === 'Custom' ? customTo || toDateOnly(new Date()) : toDateOnly(new Date());

    return all
      .filter((t) => t.date >= rangeStart && t.date <= rangeEnd)
      .filter((t) => (typeFilter === 'all' ? true : t.kind === typeFilter))
      .filter((t) => (catFilter.length === 0 || (t.categoryId && catFilter.includes(t.categoryId))))
      .filter((t) => (methodFilter === 'All' ? true : t.paymentMethod === methodFilter))
      .filter((t) => t.amount <= amountMax)
      .filter((t) => {
        const q = debouncedQuery.toLowerCase();
        if (!q) return true;
        return t.merchant.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'date-desc': return a.date < b.date ? 1 : -1;
          case 'date-asc': return a.date > b.date ? 1 : -1;
          case 'amount-desc': return b.amount - a.amount;
          case 'amount-asc': return a.amount - b.amount;
          default: return 0;
        }
      });
  }, [expenses, income, range, customFrom, customTo, typeFilter, catFilter, methodFilter, amountMax, debouncedQuery, sortBy]);

  const visibleTxns = txns.slice(0, visible);
  const showMore = txns.length > visible;

  const handleDelete = async (t: Txn) => {
    if (t.kind === 'expense') await deleteExpense(t.id);
    else await deleteIncome(t.id);
    toast.success(
      (t2) => (
        <button onClick={() => { restoreLastDeleted(); toast.dismiss(t2.id); }}>
          <div className="flex items-center gap-2">
            <span>Deleted</span>
            <span className="font-semibold text-primary underline">Undo</span>
          </div>
        </button>
      ),
      { duration: 5000 }
    );
    setDeleteTarget(null);
    setUndoVisible(true);
    setTimeout(() => setUndoVisible(false), 5000);
  };

  const exportCsv = () => {
    const csv = expensesToCsv(expenses, categories);
    downloadFile(csv, `smartspend-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
    toast.success('CSV exported');
  };

  const exportJson = () => {
    const data = JSON.stringify({ expenses, income, categories }, null, 2);
    downloadFile(data, 'smartspend-backup.json', 'application/json');
    toast.success('Backup exported');
  };

  if (expenses.length === 0 && income.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          icon={<ReceiptText className="h-9 w-9 text-primary" />}
          title="No transactions yet"
          description="Add your first expense or parse an SMS to see it here."
          action={<Button onClick={() => navigate('/add-expense')}>Add Expense</Button>}
        />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={async () => { setVisible(PAGE_SIZE); await new Promise((r) => setTimeout(r, 600)); }}>
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson}>
              <Download className="h-3.5 w-3.5" /> JSON
            </Button>
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search merchant or note..." className="pl-10" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button variant={showFilters ? 'default' : 'outline'} onClick={() => setShowFilters((s) => !s)}>
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mb-3 space-y-4 rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap gap-2">
                  {DATE_RANGES.map((r) => (
                    <button key={r.label} onClick={() => setRange(r.label)} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all', range === r.label ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      {r.label}
                    </button>
                  ))}
                  <button onClick={() => setRange('Custom')} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all', range === 'Custom' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                    Custom
                  </button>
                </div>
                {range === 'Custom' && (
                  <div className="flex gap-2">
                    <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                    <Input type="date" value={customTo} max={toDateOnly(new Date())} onChange={(e) => setCustomTo(e.target.value)} />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(['all', 'expense', 'income'] as const).map((t) => (
                    <button key={t} onClick={() => setTypeFilter(t)} className={cn('rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all', typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCatFilter((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                      className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all', catFilter.includes(c.id) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
                    >
                      <span>{c.icon}</span> {c.name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['All', 'UPI', 'Credit Card', 'Debit Card', 'Cash', 'Net Banking', 'Wallet'] as const).map((m) => (
                    <button key={m} onClick={() => setMethodFilter(m)} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all', methodFilter === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      {m}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Max amount</span>
                    <span>{formatMoney(amountMax, symbol, code)}</span>
                  </div>
                  <Slider value={[amountMax]} min={100} max={Math.max(5000, maxAmount)} step={100} onValueChange={(v) => setAmountMax(v[0])} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as never)} className="rounded-lg border bg-background px-2 py-1.5 text-xs">
                      <option value="date-desc">Date (newest)</option>
                      <option value="date-asc">Date (oldest)</option>
                      <option value="amount-desc">Amount (high→low)</option>
                      <option value="amount-asc">Amount (low→high)</option>
                    </select>
                  </div>
                  <button onClick={() => { setRange('This Month'); setTypeFilter('all'); setCatFilter([]); setMethodFilter('All'); setAmountMax(5000); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{txns.length} transactions</span>
          <button onClick={() => setShowDetails(showDetails ? null : 'all')} className="flex items-center gap-1 hover:text-primary">
            {showDetails ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {showDetails ? 'Hide details' : 'Show all details'}
          </button>
        </div>

        {visibleTxns.length === 0 ? (
          <EmptyState icon={<Search className="h-9 w-9 text-primary" />} title="No matching transactions" description="Try adjusting your filters or search query." />
        ) : (
          <div className="space-y-2">
            {visibleTxns.map((t) => {
              const cat = categories.find((c) => c.id === t.categoryId);
              const expanded = showDetails === 'all' || showDetails === t.id;
              return (
                <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-card/70 p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    {cat ? (
                      <CategoryIcon icon={cat.icon} color={cat.color} />
                    ) : (
                      <CategoryIcon icon="💰" color="#10B981" />
                    )}
                    <button className="min-w-0 flex-1 text-left" onClick={() => setShowDetails(expanded ? null : t.id)}>
                      <div className="truncate text-sm font-semibold">{t.merchant}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDatePretty(t.date)}{t.time ? ` · ${formatTime(t.time)}` : ''}
                        {cat && ` · ${cat.name}`}
                      </div>
                    </button>
                    <div className={cn('text-sm font-bold', t.kind === 'income' ? 'text-emerald-500' : 'text-foreground')}>
                      {t.kind === 'income' ? '+' : '-'}{formatMoney(t.amount, symbol, code)}
                    </div>
                    <button onClick={() => setShowDetails(expanded ? null : t.id)} className="text-muted-foreground">
                      <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
                    </button>
                  </div>
                  <AnimatePresence>
                    {expanded && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
                          {t.paymentMethod && <Badge variant="soft">{t.paymentMethod}</Badge>}
                          {t.source && <Badge variant="outline">{t.source}</Badge>}
                          {t.kind === 'income' && <Badge variant="success">Income</Badge>}
                          {t.description && <span className="text-muted-foreground">📝 {t.description}</span>}
                          {t.tags?.map((tag) => <Badge key={tag} variant="secondary">#{tag}</Badge>)}
                          <div className="ml-auto flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => navigate(t.kind === 'expense' ? `/add-expense?edit=${t.id}` : `/add-income?edit=${t.id}`)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(t)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {showMore && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              <ArrowUpDown className="h-4 w-4" /> Load more ({txns.length - visible} remaining)
            </Button>
          </div>
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.merchant} · {deleteTarget && formatMoney(deleteTarget.amount, symbol, code)} will be permanently removed. You'll have 5 seconds to undo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PullToRefresh>
  );
}
