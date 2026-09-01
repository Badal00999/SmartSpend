import { format, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { formatMoney } from './format';
import type { Expense, Income, Category, Budget, UserProfile } from './types';

export interface SpendingDay {
  date: string;
  amount: number;
}

export function monthKey(dateStr: string): string {
  return format(parseISO(dateStr), 'yyyy-MM');
}

export function dailySpending(expenses: Expense[], monthStart: Date, monthEnd: Date): SpendingDay[] {
  const map = new Map<string, number>();
  for (const e of expenses) {
    const d = parseISO(e.date);
    if (d >= monthStart && d <= monthEnd) {
      map.set(e.date, (map.get(e.date) ?? 0) + e.amount);
    }
  }
  const days: SpendingDay[] = [];
  let cur = new Date(monthStart);
  while (cur <= monthEnd) {
    const key = format(cur, 'yyyy-MM-dd');
    days.push({ date: key, amount: map.get(key) ?? 0 });
    cur = new Date(cur.getTime() + 86400000);
  }
  return days;
}

export function categoryTotals(expenses: Expense[], categories: Category[]): Array<{ category: Category; total: number }> {
  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.category_id, (totals.get(e.category_id) ?? 0) + e.amount);
  return categories
    .filter((c) => totals.has(c.id))
    .map((c) => ({ category: c, total: totals.get(c.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

export function monthComparison(
  expenses: Expense[],
  reference = new Date()
): { current: number; previous: number; changePercent: number } {
  const curStart = startOfMonth(reference);
  const curEnd = endOfMonth(reference);
  const prevStart = startOfMonth(subMonths(reference, 1));
  const prevEnd = endOfMonth(subMonths(reference, 1));

  let current = 0;
  let previous = 0;
  for (const e of expenses) {
    const d = parseISO(e.date);
    if (d >= curStart && d <= curEnd) current += e.amount;
    else if (d >= prevStart && d <= prevEnd) previous += e.amount;
  }
  const changePercent = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  return { current, previous, changePercent };
}

export function budgetUsage(expenses: Expense[], budget: Budget): number {
  if (!budget.amount || budget.amount <= 0) return 0;
  const now = new Date();
  let total = 0;
  for (const e of expenses) {
    const d = parseISO(e.date);
    let inPeriod = false;
    if (budget.period === 'monthly') {
      inPeriod = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    } else if (budget.period === 'daily') {
      inPeriod = format(d, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
    } else if (budget.period === 'weekly') {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      inPeriod = d >= weekStart && d <= weekEnd;
    } else {
      inPeriod = d.getFullYear() === now.getFullYear();
    }
    if (inPeriod) total += e.amount;
  }
  return (total / budget.amount) * 100;
}

export function weekdayPattern(expenses: Expense[]): Array<{ day: number; amount: number; isTop: boolean }> {
  const sums = new Array(7).fill(0);
  for (const e of expenses) sums[parseISO(e.date).getDay()] += e.amount;
  const max = Math.max(...sums);
  return sums.map((amount, day) => ({ day, amount, isTop: max > 0 && amount === max }));
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function generateInsights(
  expenses: Expense[],
  income: Income[],
  categories: Category[],
  budgets: Budget[],
  profile: UserProfile
): string[] {
  const insights: string[] = [];
  const now = new Date();
  const curStart = startOfMonth(now);
  const curEnd = endOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));

  const curExpenses = expenses.filter((e) => {
    const d = parseISO(e.date);
    return d >= curStart && d <= curEnd;
  });
  const prevExpenses = expenses.filter((e) => {
    const d = parseISO(e.date);
    return d >= prevStart && d <= prevEnd;
  });

  const sym = profile.currency_symbol;
  const code = profile.currency;

  if (curExpenses.length === 0) {
    insights.push('No expenses recorded this month yet. Start tracking to get smart insights! 📊');
    return insights;
  }

  const curTotal = curExpenses.reduce((s, e) => s + e.amount, 0);
  const prevTotal = prevExpenses.reduce((s, e) => s + e.amount, 0);

  if (prevTotal > 0) {
    const diff = ((curTotal - prevTotal) / prevTotal) * 100;
    if (Math.abs(diff) < 5) {
      insights.push(`Your spending is consistent with last month. Good job! 👏`);
    } else if (diff > 0) {
      insights.push(`You spent ${diff.toFixed(0)}% more this month compared to last month.`);
    } else {
      insights.push(`You spent ${Math.abs(diff).toFixed(0)}% less this month compared to last month. Excellent! 🎉`);
    }
  }

  const byCategory = categoryTotals(curExpenses, categories);
  if (byCategory.length > 0) {
    const prevByCategory = categoryTotals(prevExpenses, categories);
    const topCat = byCategory[0];
    const prevTop = prevByCategory.find((c) => c.category.id === topCat.category.id);
    if (prevTop && prevTop.total > 0 && topCat.total > prevTop.total) {
      const growth = ((topCat.total - prevTop.total) / prevTop.total) * 100;
      insights.push(`You spent ${growth.toFixed(0)}% more on ${topCat.category.name} this month compared to last month.`);
    } else {
      insights.push(`Your biggest spending category this month is ${topCat.category.name} at ${formatMoney(topCat.total, sym, code)}.`);
    }
  }

  const highest = [...curExpenses].sort((a, b) => b.amount - a.amount)[0];
  if (highest) {
    insights.push(
      `Your highest single expense was ${formatMoney(highest.amount, sym, code)} at ${highest.merchant_name} on ${format(parseISO(highest.date), 'MMM d')}.`
    );
  }

  const weekend = curExpenses.filter((e) => [0, 6].includes(parseISO(e.date).getDay()));
  const weekday = curExpenses.filter((e) => ![0, 6].includes(parseISO(e.date).getDay()));
  if (weekend.length > 0 && weekday.length > 0) {
    const wdAvg = weekday.reduce((s, e) => s + e.amount, 0) / weekday.length;
    const weAvg = weekend.reduce((s, e) => s + e.amount, 0) / weekend.length;
    if (weAvg > wdAvg * 1.2) {
      insights.push(
        `You tend to overspend on weekends. Weekend spending is ${Math.round((weAvg / wdAvg - 1) * 100)}% higher than weekdays.`
      );
    } else {
      insights.push(`You spend fairly evenly across the week. Nice balance! ⚖️`);
    }
  }

  const daysLeft = endOfMonth(now).getDate() - now.getDate();
  const remaining = Math.max(0, (profile.monthly_budget || 0) - curTotal);
  if (daysLeft > 0 && profile.monthly_budget > 0) {
    const daily = remaining / daysLeft;
    insights.push(
      `You have ${daysLeft} days left this month and ${formatMoney(remaining, sym, code)} budget remaining. Try to spend under ${formatMoney(daily, sym, code)}/day.`
    );
  }

  const merchantTotals = new Map<string, number>();
  for (const e of curExpenses) {
    const name = e.merchant_name || 'Unknown';
    merchantTotals.set(name, (merchantTotals.get(name) ?? 0) + e.amount);
  }
  const topMerchants = [...merchantTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topMerchants.length > 0) {
    insights.push(
      `Your top 3 merchants this month: ${topMerchants.map(([n, a]) => `${n} (${formatMoney(a, sym, code)})`).join(', ')}.`
    );
  }

  const foodTotal = byCategory.find((c) => c.category.name === 'Food & Dining')?.total ?? 0;
  if (foodTotal > 1000) {
    insights.push(
      `You could save ${formatMoney(foodTotal * 0.2, sym, code)}/month by reducing Food spending by 20%.`
    );
  }

  const totalIncome = income
    .filter((i) => {
      const d = parseISO(i.date);
      return d >= curStart && d <= curEnd;
    })
    .reduce((s, i) => s + i.amount, 0);

  if (totalIncome > 0 && curTotal > 0) {
    const savingsRate = ((totalIncome - curTotal) / totalIncome) * 100;
    if (savingsRate < 10) {
      insights.push(`Your savings rate is only ${savingsRate.toFixed(0)}%. Try to save at least 20% of your income.`);
    } else if (savingsRate > 30) {
      insights.push(`Great job! You're saving ${savingsRate.toFixed(0)}% of your income this month. Keep it up! 💪`);
    }
  }

  const overBudget = budgets
    .map((b) => ({ b, usage: budgetUsage(curExpenses, b) }))
    .filter((x) => x.usage >= 100)
    .slice(0, 2);
  if (overBudget.length > 0) {
    insights.push(
      `Heads up: You've exceeded your ${overBudget[0].b.category?.name ?? 'monthly'} budget by ${Math.round(overBudget[0].usage - 100)}%.`
    );
  }

  return insights.slice(0, 8);
}

export function expensesToCsv(expenses: Expense[], categories: Category[]): string {
  const header = ['Date', 'Merchant', 'Category', 'Amount', 'Payment Method', 'Source', 'Description', 'Tags'];
  const rows = expenses.map((e) => {
    const cat = categories.find((c) => c.id === e.category_id);
    return [
      e.date,
      `"${e.merchant_name}"`,
      `"${cat?.name ?? ''}"`,
      e.amount,
      e.payment_method,
      e.source,
      `"${e.description ?? ''}"`,
      `"${(e.tags ?? []).join(',')}"`
    ].join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

export function monthRange(date: Date): { start: Date; end: Date } {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}
