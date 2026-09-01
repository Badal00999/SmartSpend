import { motion } from 'framer-motion';
import { formatMoney, formatDatePretty } from '@/lib/format';
import type { Category, PaymentMethod } from '@/lib/types';
import { CategoryIcon } from './CategoryIcon';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

interface TransactionItemProps {
  merchant: string;
  amount: number;
  date: string;
  category?: Category;
  paymentMethod?: PaymentMethod;
  isIncome?: boolean;
  symbol?: string;
  code?: string;
  note?: string;
  onClick?: () => void;
}

export function TransactionItem({
  merchant,
  amount,
  date,
  category,
  paymentMethod,
  isIncome,
  symbol = '₹',
  code = 'INR',
  note,
  onClick
}: TransactionItemProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border bg-card/70 p-3 text-left shadow-sm transition-colors hover:bg-accent/50"
    >
      {category ? (
        <CategoryIcon icon={category.icon} color={category.color} />
      ) : (
        <CategoryIcon icon={isIncome ? '💰' : '📦'} color={isIncome ? '#10B981' : '#6366F1'} />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{merchant || (isIncome ? 'Income' : 'Expense')}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDatePretty(date)}</span>
          {category && <span>· {category.name}</span>}
          {note && <span className="truncate">· {note}</span>}
        </div>
        {paymentMethod && (
          <Badge variant="soft" className="mt-1 hidden text-[10px] sm:inline-flex">
            {paymentMethod}
          </Badge>
        )}
      </div>
      <div className={cn('text-sm font-bold whitespace-nowrap', isIncome ? 'text-emerald-500' : 'text-foreground')}>
        {isIncome ? '+' : '-'}
        {formatMoney(amount, symbol, code)}
      </div>
    </motion.button>
  );
}
