import { format, parseISO } from 'date-fns';

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' }
];

export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? '₹';
}

export function formatMoney(
  amount: number,
  symbol = '₹',
  code = 'INR',
  showDecimals = false
): string {
  const locale = CURRENCIES.find((c) => c.code === code)?.locale ?? 'en-IN';
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : amount % 1 !== 0 ? 2 : 0
  }).format(abs);
  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

export function formatMoneyFull(amount: number, symbol = '₹', code = 'INR') {
  return formatMoney(amount, symbol, code, true);
}

export function formatCompact(n: number, symbol = '₹') {
  if (Math.abs(n) >= 100000) return `${symbol}${(n / 100000).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `${symbol}${(n / 1000).toFixed(1)}K`;
  return `${symbol}${Math.round(n)}`;
}

export function formatDatePretty(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  try {
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h, 10), parseInt(m, 10));
    return format(d, 'h:mm a');
  } catch {
    return timeStr;
  }
}

export function relativeDay(dateStr: string): string {
  const today = new Date();
  const target = parseISO(dateStr);
  const todayStr = format(today, 'yyyy-MM-dd');
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestStr = format(yest, 'yyyy-MM-dd');
  if (dateStr === todayStr) return 'Today';
  if (dateStr === yestStr) return 'Yesterday';
  return formatDatePretty(dateStr);
}
