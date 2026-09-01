import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  Sparkles, TrendingUp, CreditCard, CalendarDays, PiggyBank, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatMoney } from '@/lib/format';
import { generateInsights, weekdayPattern, WEEKDAYS, categoryTotals } from '@/lib/analytics';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function Analytics() {
  const user = useStore((s) => s.user);
  const categories = useStore((s) => s.categories);
  const expenses = useStore((s) => s.expenses);
  const income = useStore((s) => s.income);
  const budgets = useStore((s) => s.budgets);

  const [trendRange, setTrendRange] = useState<3 | 6 | 12>(6);
  const [trendCats, setTrendCats] = useState<string[]>([]);

  const symbol = user?.currency_symbol ?? '₹';
  const code = user?.currency ?? 'INR';
  const now = new Date();

  const comparison = useMemo(() => {
    const curStart = startOfMonth(now);
    const curEnd = endOfMonth(now);
    const prevStart = startOfMonth(subMonths(now, 1));
    const prevEnd = endOfMonth(subMonths(now, 1));

    const cur = expenses.filter((e) => parseISO(e.date) >= curStart && parseISO(e.date) <= curEnd);
    const prev = expenses.filter((e) => parseISO(e.date) >= prevStart && parseISO(e.date) <= prevEnd);

    const byCat = new Map<string, { catName: string; color: string; icon: string; cur: number; prev: number }>();
    for (const c of categories) {
      byCat.set(c.id, { catName: c.name, color: c.color, icon: c.icon, cur: 0, prev: 0 });
    }
    for (const e of cur) {
      const item = byCat.get(e.category_id);
      if (item) item.cur += e.amount;
    }
    for (const e of prev) {
      const item = byCat.get(e.category_id);
      if (item) item.prev += e.amount;
    }
    return [...byCat.values()]
      .filter((x) => x.cur > 0 || x.prev > 0)
      .sort((a, b) => b.cur - a.cur)
      .slice(0, 8)
      .map((x) => ({
        name: x.catName,
        current: Math.round(x.cur),
        previous: Math.round(x.prev),
        color: x.color,
        icon: x.icon,
        change: x.prev > 0 ? ((x.cur - x.prev) / x.prev) * 100 : 100
      }));
  }, [expenses, categories, now]);

  const trends = useMemo(() => {
    const months: { label: string; key: string }[] = [];
    for (let i = trendRange - 1; i >= 0; i--) {
      const m = subMonths(now, i);
      months.push({ label: format(m, 'MMM yy'), key: `${m.getFullYear()}-${m.getMonth()}` });
    }
    const result = months.map((m) => {
      const row: Record<string, string | number> = { label: m.label };
      for (const c of categories) row[c.name] = 0;
      for (const e of expenses) {
        const d = parseISO(e.date);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key === m.key) {
          const cat = categories.find((c) => c.id === e.category_id);
          if (cat) row[cat.name] = (row[cat.name] as number) + Math.round(e.amount);
        }
      }
      return row;
    });
    return result;
  }, [expenses, categories, trendRange, now]);

  const activeTrendCats = trendCats.length ? trendCats : categories.slice(0, 4).map((c) => c.name);

  const paymentDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.payment_method, (map.get(e.payment_method) ?? 0) + e.amount);
    return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [expenses]);
  const paymentColors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const weekdays = useMemo(() => weekdayPattern(expenses), [expenses]);
  const topDay = weekdays.reduce((best, d) => (d.amount > best.amount ? d : best), weekdays[0]);
  const avgWeekday = weekdays.slice(1, 6).reduce((s, d) => s + d.amount, 0) / 5;
  const avgWeekend = (weekdays[0].amount + weekdays[6].amount) / 2;

  const insights = useMemo(() => generateInsights(expenses, income, categories, budgets, user!), [expenses, income, categories, budgets, user]);

  const savings = useMemo(() => {
    const curStart = startOfMonth(now);
    const curEnd = endOfMonth(now);
    const cur = expenses.filter((e) => parseISO(e.date) >= curStart && parseISO(e.date) <= curEnd);
    const total = cur.reduce((s, e) => s + e.amount, 0);
    const byCat = categoryTotals(cur, categories);
    const potential = Math.round(total * 0.12);
    const top3 = byCat.slice(0, 3).map((c) => ({
      name: c.category.name,
      total: c.total,
      save: Math.round(c.total * 0.2)
    }));
    return { total, potential, top3 };
  }, [expenses, categories, now]);

  if (expenses.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="mb-2 text-2xl font-bold">Analytics & Insights</h1>
        <Card className="p-10 text-center text-muted-foreground">
          <div className="mb-2 text-4xl">📊</div>
          Add some expenses to unlock powerful insights.
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight">Analytics & Insights</h1>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">This month vs Last month</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparison} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                formatter={(value: number, name: string) => [formatMoney(value, symbol, code), name === 'current' ? 'This month' : 'Last month']}
              />
              <Legend formatter={(v) => (v === 'current' ? 'This month' : 'Last month')} />
              <Bar dataKey="previous" fill="hsl(var(--muted))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="current" fill="#6366F1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {comparison.slice(0, 5).map((c) => (
            <Badge key={c.name} variant="outline" className="gap-1">
              {c.icon} {c.name}
              <span className={cn('flex items-center gap-0.5', c.change >= 0 ? 'text-red-500' : 'text-emerald-500')}>
                {c.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(c.change).toFixed(0)}%
              </span>
            </Badge>
          ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Category Trends</h2>
          </div>
          <div className="flex gap-1.5">
            {([3, 6, 12] as const).map((r) => (
              <button key={r} onClick={() => setTrendRange(r)} className={cn('rounded-lg px-3 py-1 text-xs font-medium transition-all', trendRange === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                {r}M
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {categories.slice(0, 8).map((c) => (
            <button
              key={c.id}
              onClick={() => setTrendCats((prev) => (prev.includes(c.name) ? prev.filter((x) => x !== c.name) : [...prev, c.name]))}
              className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium transition-all', activeTrendCats.includes(c.name) ? 'text-white' : 'bg-muted text-muted-foreground')}
              style={activeTrendCats.includes(c.name) ? { backgroundColor: c.color } : undefined}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                formatter={(value: number) => formatMoney(value, symbol, code)}
              />
              <Legend />
              {activeTrendCats.map((name, i) => {
                const cat = categories.find((c) => c.name === name);
                return <Line key={name} type="monotone" dataKey={name} stroke={cat?.color ?? ['#6366F1', '#10B981', '#F59E0B', '#EF4444'][i % 4]} strokeWidth={2.5} dot={false} />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Payment Method Distribution</h2>
          </div>
          {paymentDist.length > 0 ? (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                      {paymentDist.map((_, i) => (
                        <Cell key={i} fill={paymentColors[i % paymentColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} formatter={(value: number) => formatMoney(value, symbol, code)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5">
                {paymentDist.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: paymentColors[i % paymentColors.length] }} />
                    <span className="flex-1">{p.name}</span>
                    <span className="font-medium">{formatMoney(p.value, symbol, code)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No payment data yet.</p>
          )}
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Day-wise Spending Pattern</h2>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdays.map((d, i) => ({ day: WEEKDAYS[i].slice(0, 3), amount: Math.round(d.amount) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} formatter={(value: number) => formatMoney(value, symbol, code)} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {weekdays.map((d, i) => (
                    <Cell key={i} fill={d.isTop ? '#EF4444' : '#6366F1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {topDay.amount > 0 && (
            <p className="mt-3 rounded-xl bg-primary/5 p-3 text-sm">
              💡 You spend most on <span className="font-semibold">{WEEKDAYS[topDay.day]}s</span> ({formatMoney(topDay.amount, symbol, code)}).{" "}
              {avgWeekend > avgWeekday && <span>Weekend spending is {Math.round((avgWeekend / Math.max(1, avgWeekday) - 1) * 100)}% higher than weekdays.</span>}
            </p>
          )}
        </Card>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h2 className="font-semibold">AI Insights</h2>
        </div>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="rounded-xl border bg-card/60 p-3 text-sm">
              💡 {insight}
            </motion.div>
          ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-6 bg-gradient-to-br from-emerald-500/10 to-indigo-500/10">
        <div className="mb-3 flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-emerald-500" />
          <h2 className="font-semibold">Savings Potential</h2>
        </div>
        <div className="mb-3 text-center">
          <div className="text-xs text-muted-foreground">Potential monthly savings</div>
          <div className="text-4xl font-bold text-emerald-500">
            <AnimatedNumber value={savings.potential} symbol={symbol} code={code} />
          </div>
        </div>
        <div className="space-y-2">
          {savings.top3.map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-xl bg-background/60 p-3 text-sm">
              <span>{s.name}</span>
              <span>
                Spend {formatMoney(s.total, symbol, code)} → <span className="font-semibold text-emerald-500">save {formatMoney(s.save, symbol, code)}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
