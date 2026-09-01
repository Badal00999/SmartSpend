import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import {
  TrendingUp, Wallet, CalendarDays, ArrowDownRight, ArrowUpRight,
  Flame, ChevronRight, Zap, Award
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatMoney, formatDatePretty, relativeDay } from '@/lib/format';
import { categoryTotals, dailySpending, monthComparison, budgetUsage } from '@/lib/analytics';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { EmptyState } from '@/components/EmptyState';
import { TransactionItem } from '@/components/TransactionItem';
import { CategoryIcon } from '@/components/CategoryIcon';
import { PageSkeleton } from '@/components/PageSkeleton';
import { Confetti } from '@/components/Confetti';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const categories = useStore((s) => s.categories);
  const expenses = useStore((s) => s.expenses);
  const income = useStore((s) => s.income);
  const budgets = useStore((s) => s.budgets);
  const templates = useStore((s) => s.templates);
  const streak = useStore((s) => s.streak);
  const addExpense = useStore((s) => s.addExpense);
  const settings = useStore((s) => s.settings);

  const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const confettiFired = useRef(false);

  const symbol = user?.currency_symbol ?? '₹';
  const code = user?.currency ?? 'INR';

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const thisMonthExpenses = useMemo(
    () => expenses.filter((e) => {
      const d = parseISO(e.date);
      return d >= monthStart && d <= monthEnd;
    }),
    [expenses, monthStart, monthEnd]
  );

  const thisMonthIncome = useMemo(
    () => income.filter((i) => {
      const d = parseISO(i.date);
      return d >= monthStart && d <= monthEnd;
    }),
    [income, monthStart, monthEnd]
  );

  const totalSpent = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = thisMonthIncome.reduce((s, i) => s + i.amount, 0);
  const comp = useMemo(() => monthComparison(expenses), [expenses]);
  const budget = user?.monthly_budget ?? 0;
  const remaining = Math.max(0, budget - totalSpent);
  const budgetPercent = budget > 0 ? Math.min(100, (totalSpent / budget) * 100) : 0;

  const todayKey = format(now, 'yyyy-MM-dd');
  const todaySpent = expenses.filter((e) => e.date === todayKey).reduce((s, e) => s + e.amount, 0);

  const sparkData = useMemo(() => {
    const days = dailySpending(expenses, monthStart, monthEnd);
    return days.slice(-14).map((d) => ({ name: format(parseISO(d.date), 'd'), spent: Math.round(d.amount) }));
  }, [expenses, monthStart, monthEnd]);

  const chartData = useMemo(() => {
    if (chartView === 'daily') {
      return dailySpending(expenses, monthStart, monthEnd).map((d) => ({
        label: format(parseISO(d.date), 'd'),
        amount: Math.round(d.amount)
      }));
    }
    if (chartView === 'weekly') {
      const weeks: { label: string; amount: number }[] = [];
      let cur = startOfWeek(monthStart);
      while (cur <= monthEnd) {
        const wkEnd = endOfWeek(cur);
        const amt = expenses.filter((e) => {
          const d = parseISO(e.date);
          return d >= cur && d <= wkEnd;
        }).reduce((s, e) => s + e.amount, 0);
        weeks.push({ label: format(cur, 'd MMM'), amount: Math.round(amt) });
        cur = new Date(wkEnd.getTime() + 86400000);
      }
      return weeks;
    }
    const months: { label: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = endOfMonth(m);
      const amt = expenses.filter((e) => {
        const d = parseISO(e.date);
        return d >= m && d <= mEnd;
      }).reduce((s, e) => s + e.amount, 0);
      months.push({ label: format(m, 'MMM'), amount: Math.round(amt) });
    }
    return months;
  }, [chartView, expenses, monthStart, monthEnd, now]);

  const catBreakdown = useMemo(() => categoryTotals(thisMonthExpenses, categories), [thisMonthExpenses, categories]);
  const pieData = catBreakdown.slice(0, 8).map((c) => ({
    name: c.category.name,
    value: Math.round(c.total),
    color: c.category.color,
    icon: c.category.icon
  }));

  const topCat = selectedCat ? catBreakdown.find((c) => c.category.id === selectedCat) : null;
  const selectedCatExpenses = useMemo(
    () => (topCat ? thisMonthExpenses.filter((e) => e.category_id === topCat.category.id).slice(0, 6) : []),
    [topCat, thisMonthExpenses]
  );

  const recent = useMemo(
    () =>
      [
        ...expenses.map((e) => ({ kind: 'expense' as const, ...e, sortDate: `${e.date}${e.time ?? ''}` })),
        ...income.map((i) => ({
          kind: 'income' as const,
          id: i.id,
          merchant_name: i.source_name,
          amount: i.amount,
          category_id: '',
          date: i.date,
          time: '',
          description: i.description ?? '',
          sortDate: i.date
        }))
      ]
        .sort((a, b) => (a.sortDate < b.sortDate ? 1 : -1))
        .slice(0, 10),
    [expenses, income]
  );

  const budgetList = useMemo(() => budgets.filter((b) => b.category_id), [budgets]);

  useEffect(() => {
    if (settings.notifications.daily_summary && !celebrated) {
      const spent = totalSpent;
      const txnCount = thisMonthExpenses.length;
      if (spent > 0) {
        toast(`${relativeDay(todayKey)}, you spent ${symbol}${spent.toLocaleString()} across ${txnCount} transactions`, {
          icon: '📋',
          duration: 6000
        });
        setCelebrated(true);
      }
    }
  }, [settings.notifications.daily_summary, totalSpent, thisMonthExpenses.length, symbol, celebrated, todayKey]);

  const monthlySaved = Math.max(0, totalIncome - totalSpent);
  useEffect(() => {
    if (monthlySaved > 0 && (user?.monthly_budget ?? 0) > 0 && totalIncome > 0 && !confettiFired.current) {
      confettiFired.current = true;
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2000);
      return () => clearTimeout(t);
    }
  }, [monthlySaved, user?.monthly_budget, totalIncome]);

  const handleTemplate = async (merchant: string, amount: number, categoryId: string, method: string) => {
    await addExpense({
      amount,
      merchant_name: merchant,
      category_id: categoryId,
      payment_method: method as never,
      source: 'manual',
      date: todayKey,
      description: 'Quick template expense',
      is_recurring: false,
      tags: []
    });
    toast.success(`${merchant} added`);
  };

  if (expenses.length === 0 && income.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <Header user={user?.full_name ?? ''} symbol={symbol} streak={streak.count} />
        <EmptyState
          icon={<Wallet className="h-9 w-9 text-primary" />}
          title="No transactions yet"
          description="Add your first expense manually, or let SmartSpend auto-detect from bank SMS and voice!"
          action={
            <div className="flex gap-2">
              <button onClick={() => navigate('/add-expense')} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
                Add Expense
              </button>
              <button onClick={() => navigate('/sms')} className="rounded-xl border px-4 py-2.5 text-sm font-medium">
                Parse SMS
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <Confetti trigger={celebrate} />
      <Header user={user?.full_name ?? ''} symbol={symbol} streak={streak.count} />

      {templates.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {templates.slice(0, 4).map((t) => {
            const cat = categories.find((c) => c.id === t.category_id);
            return (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTemplate(t.merchant, t.amount, t.category_id, t.payment_method)}
                className="flex shrink-0 items-center gap-2 rounded-2xl border bg-card px-4 py-2.5 shadow-sm transition-colors hover:bg-accent"
              >
                <span className="text-lg">{cat?.icon ?? '⚡'}</span>
                <div className="text-left">
                  <div className="text-xs font-semibold">{t.merchant}</div>
                  <div className="text-[10px] text-muted-foreground">{symbol}{t.amount.toLocaleString()}</div>
                </div>
                <Zap className="h-3.5 w-3.5 text-amber-500" />
              </motion.button>
            );
          })}
        </div>
      )}

      <SummaryCards
        totalSpent={totalSpent}
        remaining={remaining}
        budgetPercent={budgetPercent}
        todaySpent={todaySpent}
        totalIncome={totalIncome}
        changePercent={comp.changePercent}
        symbol={symbol}
        code={code}
        sparkData={sparkData}
      />

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Spending Overview</h2>
          <div className="flex rounded-xl bg-muted p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setChartView(v)}
                className={cn(
                  'rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all',
                  chartView === v ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                formatter={(value: number) => [formatMoney(value, symbol, code), 'Spent']}
              />
              <Area type="monotone" dataKey="amount" stroke="#6366F1" strokeWidth={2.5} fill="url(#spend)" animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Category Breakdown</h2>
            {topCat && (
              <button onClick={() => setSelectedCat(null)} className="text-xs text-primary hover:underline">
                ← Back to all
              </button>
            )}
          </div>
          {topCat ? (
            <div className="space-y-2">
              {selectedCatExpenses.map((e) => (
                <TransactionItem
                  key={e.id}
                  merchant={e.merchant_name}
                  amount={e.amount}
                  date={e.date}
                  category={topCat.category}
                  paymentMethod={e.payment_method}
                  symbol={symbol}
                  code={code}
                  onClick={() => navigate(`/history?category=${topCat.category.id}`)}
                />
              ))}
            </div>
          ) : pieData.length > 0 ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={3}
                      strokeWidth={0}
                      onClick={(d) => {
                        const id = catBreakdown.find((c) => c.category.name === d.name)?.category.id;
                        if (id) setSelectedCat(id);
                      }}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} className="cursor-pointer outline-none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} formatter={(value: number) => formatMoney(value, symbol, code)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-2">
                {catBreakdown.map((c) => {
                  const pct = totalSpent > 0 ? (c.total / totalSpent) * 100 : 0;
                  return (
                    <button
                      key={c.category.id}
                      onClick={() => setSelectedCat(c.category.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-accent"
                    >
                      <CategoryIcon icon={c.category.icon} color={c.category.color} size="sm" />
                      <span className="flex-1 text-left text-sm font-medium">{c.category.name}</span>
                      <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                      <span className="text-sm font-bold">{formatMoney(c.total, symbol, code)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No spending this month yet.</p>
          )}
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent Transactions</h2>
            <button onClick={() => navigate('/history')} className="flex items-center text-xs font-medium text-primary hover:underline">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {recent.map((t) => {
              const cat = t.kind === 'expense' ? categories.find((c) => c.id === t.category_id) : undefined;
              return (
                <TransactionItem
                  key={t.id}
                  merchant={t.merchant_name}
                  amount={t.amount}
                  date={t.date}
                  category={cat}
                  paymentMethod={t.kind === 'expense' ? t.payment_method : undefined}
                  isIncome={t.kind === 'income'}
                  symbol={symbol}
                  code={code}
                  onClick={() => navigate('/history')}
                />
              );
            })}
          </div>
        </Card>
      </div>

      {budgetList.length > 0 && (
        <Card className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Budget Progress</h2>
            <button onClick={() => navigate('/budgets')} className="flex items-center text-xs font-medium text-primary hover:underline">
              Manage <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {budgetList.map((b) => {
              const cat = categories.find((c) => c.id === b.category_id);
              const spent = thisMonthExpenses.filter((e) => e.category_id === b.category_id).reduce((s, e) => s + e.amount, 0);
              const usage = budgetUsage(thisMonthExpenses, b);
              const barColor = usage >= 100 ? 'bg-red-500 animate-pulse' : usage >= 85 ? 'bg-red-400' : usage >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
              return (
                <div key={b.id} className="rounded-2xl border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <CategoryIcon icon={cat?.icon ?? '📦'} color={cat?.color ?? '#6366F1'} size="sm" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{cat?.name ?? 'Budget'}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(spent, symbol, code)} of {formatMoney(b.amount, symbol, code)}
                      </div>
                    </div>
                    <Badge variant={usage >= 100 ? 'destructive' : usage >= 60 ? 'warning' : 'success'}>{Math.round(usage)}%</Badge>
                  </div>
                  <Progress value={Math.min(100, usage)} indicatorClassName={barColor} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-500/10 to-emerald-500/10">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
          <Award className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">
            {streak.count > 0 ? (
              <>🔥 {streak.count}-day streak! You've stayed under budget for {streak.count} days!</>
            ) : (
              'Set a daily budget to start your streak!'
            )}
          </div>
          <div className="text-xs text-muted-foreground">Best streak: {streak.best} days</div>
        </div>
        <button onClick={() => navigate('/budgets')} className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary">
          Set budget
        </button>
      </Card>
    </div>
  );
}

function Header({ user, symbol, streak }: { user: string; symbol: string; streak: number }) {
  const today = new Date();
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Hello, {user.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-xs text-muted-foreground">{format(today, 'EEEE, d MMMM')}</p>
      </div>
      <div className="flex items-center gap-2">
        {streak > 0 && (
          <Badge variant="warning" className="gap-1">
            <Flame className="h-3 w-3" /> {streak}
          </Badge>
        )}
        <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 px-3 py-2 text-sm font-bold text-white shadow">
          {symbol}
        </div>
      </div>
    </div>
  );
}

function SummaryCards({
  totalSpent, remaining, budgetPercent, todaySpent, totalIncome, changePercent, symbol, code, sparkData
}: {
  totalSpent: number;
  remaining: number;
  budgetPercent: number;
  todaySpent: number;
  totalIncome: number;
  changePercent: number;
  symbol: string;
  code: string;
  sparkData: Array<{ name: string; spent: number }>;
}) {
  const budgetColor = budgetPercent >= 100 ? 'text-red-500' : budgetPercent >= 85 ? 'text-amber-500' : budgetPercent >= 60 ? 'text-amber-400' : 'text-emerald-500';
  const changeColor = changePercent <= 0 ? 'text-emerald-500' : 'text-red-500';

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
      <SummaryCard>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total Spent This Month</span>
          <span className={cn('flex items-center gap-0.5 text-xs font-semibold', changeColor)}>
            {changePercent <= 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
            {Math.abs(changePercent).toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 text-2xl font-bold">
          <AnimatedNumber value={totalSpent} symbol={symbol} code={code} />
        </div>
        <div className="mt-2 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="spent" stroke="#EF4444" strokeWidth={2} fill="url(#spark)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">vs last month</div>
      </SummaryCard>

      <SummaryCard>
        <span className="text-xs font-medium text-muted-foreground">Budget Remaining</span>
        <div className="mt-2 text-2xl font-bold">
          <AnimatedNumber value={remaining} symbol={symbol} code={code} />
        </div>
        <Progress value={budgetPercent} className="mt-3" indicatorClassName={budgetColor === 'text-red-500' ? 'bg-red-500' : budgetColor.includes('amber') ? 'bg-amber-500' : 'bg-emerald-500'} />
        <div className={cn('mt-1 text-[10px] font-medium', budgetColor)}>{Math.round(budgetPercent)}% used</div>
      </SummaryCard>

      <SummaryCard>
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Today's Spending</span>
        </div>
        <div className="mt-2 text-2xl font-bold">
          <AnimatedNumber value={todaySpent} symbol={symbol} code={code} />
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">{relativeDay(new Date().toISOString().slice(0, 10))}</div>
      </SummaryCard>

      <SummaryCard>
        <span className="text-xs font-medium text-muted-foreground">Total Income This Month</span>
        <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-emerald-500">
          <AnimatedNumber value={totalIncome} symbol={symbol} code={code} />
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
          <TrendingUp className="h-3 w-3" /> Income track
        </div>
      </SummaryCard>
    </div>
  );
}

function SummaryCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="min-w-[170px] shrink-0 rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:min-w-0"
    >
      {children}
    </motion.div>
  );
}
