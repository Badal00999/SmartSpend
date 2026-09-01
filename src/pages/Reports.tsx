import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import toast from 'react-hot-toast';
import { FileText, Download, Mail, ArrowLeft, ArrowRight, Printer } from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatMoney, formatDatePretty } from '@/lib/format';
import { dailySpending, categoryTotals } from '@/lib/analytics';
import { downloadFile } from '@/lib/utils';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function Reports() {
  const user = useStore((s) => s.user);
  const categories = useStore((s) => s.categories);
  const expenses = useStore((s) => s.expenses);
  const income = useStore((s) => s.income);
  const budgets = useStore((s) => s.budgets);
  const [monthOffset, setMonthOffset] = useState(0);

  const symbol = user?.currency_symbol ?? '₹';
  const code = user?.currency ?? 'INR';

  const refDate = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth() - monthOffset, 1), [monthOffset]);
  const refStart = startOfMonth(refDate);
  const refEnd = endOfMonth(refDate);
  const prevStart = startOfMonth(subMonths(refDate, 1));
  const prevEnd = endOfMonth(subMonths(refDate, 1));

  const monthExpenses = useMemo(
    () => expenses.filter((e) => parseISO(e.date) >= refStart && parseISO(e.date) <= refEnd),
    [expenses, refStart, refEnd]
  );
  const monthIncome = useMemo(
    () => income.filter((i) => parseISO(i.date) >= refStart && parseISO(i.date) <= refEnd),
    [income, refStart, refEnd]
  );
  const prevExpenses = useMemo(
    () => expenses.filter((e) => parseISO(e.date) >= prevStart && parseISO(e.date) <= prevEnd),
    [expenses, prevStart, prevEnd]
  );

  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = monthIncome.reduce((s, i) => s + i.amount, 0);
  const prevTotal = prevExpenses.reduce((s, e) => s + e.amount, 0);
  const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

  const cats = useMemo(() => categoryTotals(monthExpenses, categories), [monthExpenses, categories]);
  const daily = useMemo(
    () => dailySpending(expenses, refStart, refEnd).map((d) => ({ name: format(parseISO(d.date), 'd'), amount: Math.round(d.amount) })),
    [expenses, refStart, refEnd]
  );
  const topExpenses = [...monthExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

  const budgetCats = useMemo(() => budgets.filter((b) => b.category_id), [budgets]);

  const printReport = () => {
    window.print();
  };

  const downloadReport = () => {
    const content = `SMARTSPEND MONTHLY REPORT
${format(refDate, 'MMMM yyyy')}
Generated: ${new Date().toLocaleString()}

MONTH SUMMARY
  Total spent: ${formatMoney(total, symbol, code)}
  Total income: ${formatMoney(totalIncome, symbol, code)}
  Savings: ${formatMoney(totalIncome - total, symbol, code)}
  Change vs last month: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%

CATEGORY BREAKDOWN
${cats.map((c) => `  ${c.category.name}: ${formatMoney(c.total, symbol, code)} (${total > 0 ? ((c.total / total) * 100).toFixed(1) : 0}%)`).join('\n')}

TOP EXPENSES
${topExpenses.map((e, i) => `  ${i + 1}. ${e.merchant_name} - ${formatMoney(e.amount, symbol, code)} (${formatDatePretty(e.date)})`).join('\n')}

BUDGET VS ACTUAL
${budgetCats.map((b) => {
  const spent = monthExpenses.filter((e) => e.category_id === b.category_id).reduce((s, e) => s + e.amount, 0);
  const cat = categories.find((c) => c.id === b.category_id);
  return `  ${cat?.name ?? 'Budget'}: ${formatMoney(spent, symbol, code)} / ${formatMoney(b.amount, symbol, code)}`;
}).join('\n')}
`;
    downloadFile(content, `smartspend-report-${format(refDate, 'yyyy-MM')}.txt`, 'text/plain');
    toast.success('Report downloaded');
  };

  const emailReport = () => {
    const body = encodeURIComponent(`SmartSpend Monthly Report for ${format(refDate, 'MMMM yyyy')}%0D%0A%0D%0ATotal spent: ${formatMoney(total, symbol, code)}%0D%0ATotal income: ${formatMoney(totalIncome, symbol, code)}`);
    window.location.href = `mailto:${user?.email ?? ''}?subject=SmartSpend Monthly Report - ${format(refDate, 'MMMM yyyy')}&body=${body}`;
    toast.success('Opening email app...');
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="print:hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileText className="h-6 w-6 text-primary" /> Reports
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={monthOffset >= 12} onClick={() => setMonthOffset((m) => m + 1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="w-24 text-center text-sm font-medium">{format(refDate, 'MMMM yyyy')}</span>
            <Button variant="outline" size="icon" disabled={monthOffset <= 0} onClick={() => setMonthOffset((m) => m - 1)}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={printReport}><Printer className="h-3.5 w-3.5" /> Print / PDF</Button>
          <Button variant="outline" size="sm" onClick={downloadReport}><Download className="h-3.5 w-3.5" /> Download</Button>
          <Button variant="outline" size="sm" onClick={emailReport}><Mail className="h-3.5 w-3.5" /> Email report</Button>
        </div>
      </div>

      <div id="report" className="space-y-4 rounded-3xl border bg-card p-5 shadow-glass print:border-0 print:shadow-none sm:p-8">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 text-sm text-white">₹</span>
              SmartSpend
            </div>
            <div className="text-xs text-muted-foreground">Monthly Expense Report</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">{format(refDate, 'MMMM yyyy')}</div>
            <div className="text-xs text-muted-foreground">Generated {format(new Date(), 'd MMM yyyy')}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total spent" value={formatMoney(total, symbol, code)} accent="text-red-500" />
          <Stat label="Total income" value={formatMoney(totalIncome, symbol, code)} accent="text-emerald-500" />
          <Stat label="Net savings" value={formatMoney(totalIncome - total, symbol, code)} accent={(totalIncome - total) >= 0 ? 'text-emerald-500' : 'text-red-500'} />
          <Stat
            label="vs last month"
            value={`${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}
            accent={change <= 0 ? 'text-emerald-500' : 'text-red-500'}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Daily spending</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} formatter={(v: number) => formatMoney(v, symbol, code)} />
                <Area type="monotone" dataKey="amount" stroke="#6366F1" strokeWidth={2} fill="url(#reportGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Category breakdown</h3>
            {cats.length > 0 ? (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={cats.map((c) => ({ name: c.category.name, value: Math.round(c.total), color: c.category.color }))} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={3} strokeWidth={0}>
                        {cats.map((c) => <Cell key={c.category.id} fill={c.category.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} formatter={(v: number) => formatMoney(v, symbol, code)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1">
                  {cats.slice(0, 5).map((c) => (
                    <div key={c.category.id} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.category.color }} />
                      <span className="flex-1">{c.category.icon} {c.category.name}</span>
                      <span className="font-medium">{formatMoney(c.total, symbol, code)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No spending this month.</p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Budget vs Actual</h3>
            {budgetCats.length > 0 ? (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetCats.slice(0, 5).map((b) => {
                    const spent = monthExpenses.filter((e) => e.category_id === b.category_id).reduce((s, e) => s + e.amount, 0);
                    const cat = categories.find((c) => c.id === b.category_id);
                    return { name: cat?.name ?? 'Budget', Budget: Math.round(b.amount), Actual: Math.round(spent) };
                  })} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }} formatter={(v: number) => formatMoney(v, symbol, code)} />
                    <Bar dataKey="Budget" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Actual" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No budgets set.</p>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Top expenses</h3>
          {topExpenses.length > 0 ? (
            <div className="space-y-2">
              {topExpenses.map((e, i) => {
                const cat = categories.find((c) => c.id === e.category_id);
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl border p-2.5 text-sm">
                    <span className={cn('flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold text-white', i === 0 ? 'bg-red-500' : i === 1 ? 'bg-amber-500' : i === 2 ? 'bg-indigo-500' : 'bg-muted-foreground')}>
                      {i + 1}
                    </span>
                    <CategoryIcon icon={cat?.icon ?? '📦'} color={cat?.color ?? '#6366F1'} size="sm" />
                    <span className="flex-1 font-medium">{e.merchant_name}</span>
                    <span className="text-xs text-muted-foreground">{formatDatePretty(e.date)}</span>
                    <span className="font-bold">{formatMoney(e.amount, symbol, code)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-muted-foreground">No expenses recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border bg-card/60 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-base font-bold sm:text-lg', accent)}>{value}</div>
    </div>
  );
}
