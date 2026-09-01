import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  MessageSquareText, Wand2, Save, Plus, X, Clock, CreditCard, Type,
  Landmark, Loader2, MessageCircle
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { parseSms, categorizeMerchant, SAMPLE_SMS } from '@/lib/smsParser';
import { detectCategory } from '@/lib/merchantMap';
import { formatMoney } from '@/lib/format';
import { SuccessAnimation } from '@/components/SuccessAnimation';
import { EmptyState } from '@/components/EmptyState';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ParsedSms, Expense } from '@/lib/types';

export default function SmsParser() {
  const user = useStore((s) => s.user);
  const categories = useStore((s) => s.categories);
  const expenses = useStore((s) => s.expenses);
  const addExpense = useStore((s) => s.addExpense);
  const smsRules = useStore((s) => s.smsRules);
  const addSmsRule = useStore((s) => s.addSmsRule);

  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedSms | null>(null);
  const [catId, setCatId] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [method, setMethod] = useState<'UPI' | 'Credit Card' | 'Debit Card' | 'Cash' | 'Net Banking' | 'Wallet'>('UPI');

  const symbol = user?.currency_symbol ?? '₹';
  const code = user?.currency ?? 'INR';

  const smsExpenses = expenses.filter((e) => e.source === 'sms').slice(0, 20);

  const handleParse = async () => {
    setParsing(true);
    await new Promise((r) => setTimeout(r, 600));
    const result = parseSms(text);
    setParsed(result);
    setParsing(false);

    const detected = detectCategory(result.merchant);
    const rule = smsRules.find((r) => result.merchant.toLowerCase().includes(r.keyword.toLowerCase()));
    const cat = categories.find((c) => c.name === detected) ?? (rule ? rule.category : undefined) ?? categories.find((c) => c.name === 'Other');
    setCatId(cat?.id ?? '');
  };

  const loadSample = (s: string) => {
    setText(s);
    setParsed(null);
  };

  const handleSave = async () => {
    if (!parsed) return;
    if (parsed.type === 'credit') {
      toast('Credits are ignored for expenses. Try the income flow instead.', { icon: 'ℹ️' });
      return;
    }
    if (!catId) {
      toast.error('Please select a category');
      return;
    }
    setSaving(true);
    const exp = await addExpense({
      amount: parsed.amount,
      merchant_name: parsed.merchant,
      category_id: catId,
      payment_method: method,
      source: 'sms',
      date: parsed.date,
      description: `Auto-parsed from SMS${parsed.accountLast4 ? ` · A/C XX${parsed.accountLast4}` : ''}`,
      is_recurring: false,
      tags: ['sms']
    });
    setSaving(false);
    setSuccess(true);
    toast.success('Expense saved from SMS');
    setText('');
    setParsed(null);
    setTimeout(() => setSuccess(false), 1300);

    const category = categories.find((c) => c.id === catId);
    if (category && parsed.merchant !== 'Unknown Merchant') {
      const words = parsed.merchant.toLowerCase().split(/\s+/);
      if (!smsRules.some((r) => words.some((w) => r.keyword.toLowerCase() === w))) {
        await addSmsRule(words[0], category.id);
      }
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <SuccessAnimation show={success} title="Saved from SMS!" subtitle="Expense tracked automatically" />
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
          <MessageSquareText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">SMS Parser</h1>
          <p className="text-xs text-muted-foreground">Paste a bank SMS — SmartSpend extracts it automatically</p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-glass">
        <Textarea
          placeholder={'Paste your bank SMS here...\n\ne.g. INR 500.00 debited from A/C XXXX1234 on 12-Jan-25. Info: UPI/Zomato. Avl Bal: INR 9500.00'}
          className="min-h-32 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_SMS.slice(0, 4).map((s, i) => (
            <button key={i} onClick={() => loadSample(s)} className="rounded-full bg-muted px-3 py-1 text-[10px] text-muted-foreground hover:bg-primary/10 hover:text-primary">
              Sample {i + 1}
            </button>
          ))}
        </div>
        <Button onClick={handleParse} disabled={!text.trim() || parsing} className="w-full" size="lg">
          {parsing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
          {parsing ? 'Parsing...' : 'Parse SMS'}
        </Button>
      </div>

      <AnimatePresence>
        {parsed && (
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="mt-4">
            <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <Badge variant={parsed.type === 'credit' ? 'success' : 'destructive'} className="gap-1">
                  <Landmark className="h-3 w-3" />
                  {parsed.type === 'credit' ? 'CREDIT' : 'DEBIT'}
                </Badge>
                <Badge variant="indigo">✨ Auto-detected</Badge>
              </div>

              <div className="mb-4 text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount</div>
                <div className={cn('text-4xl font-bold', parsed.type === 'credit' ? 'text-emerald-500' : 'text-foreground')}>
                  {formatMoney(parsed.amount, symbol, code)}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 rounded-xl bg-background/60 p-3">
                  <Type className="h-4 w-4 text-primary" />
                  <span className="w-20 text-xs text-muted-foreground">Merchant</span>
                  <span className="font-medium">{parsed.merchant}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-background/60 p-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="w-20 text-xs text-muted-foreground">Date</span>
                  <span className="font-medium">{format(new Date(parsed.date), 'MMM d, yyyy')}</span>
                </div>
                {parsed.accountLast4 && (
                  <div className="flex items-center gap-2 rounded-xl bg-background/60 p-3">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span className="w-20 text-xs text-muted-foreground">Account</span>
                    <span className="font-medium font-mono">••••{parsed.accountLast4}</span>
                  </div>
                )}
              </div>

              {parsed.type === 'debit' && (
                <>
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">Category</div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {categories.slice(0, 10).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setCatId(c.id)}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all active:scale-95',
                            catId === c.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
                          )}
                        >
                          <span className="text-xl">{c.icon}</span>
                          <span className="text-[9px] font-medium text-center leading-tight">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">Payment method</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Net Banking', 'Wallet'] as const).map((m) => (
                        <button key={m} onClick={() => setMethod(m)} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all', method === m ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleSave} disabled={saving} className="mt-4 w-full" size="lg" variant="gradient">
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    Save Expense
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">SMS-Parsed History</h2>
        </div>
        {smsExpenses.length === 0 ? (
          <EmptyState
            icon={<MessageSquareText className="h-8 w-8 text-primary" />}
            title="No SMS expenses yet"
            description="Paste a bank SMS above and let SmartSpend parse it for you."
          />
        ) : (
          <div className="space-y-2">
            {smsExpenses.map((e) => {
              const cat = categories.find((c) => c.id === e.category_id);
              return (
                <div key={e.id} className="flex items-center gap-3 rounded-2xl border bg-card/70 p-3">
                  <CategoryIcon icon={cat?.icon ?? '📦'} color={cat?.color ?? '#6366F1'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{e.merchant_name}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(e.date), 'MMM d, yyyy')} · {cat?.name}</div>
                  </div>
                  <div className="text-sm font-bold">{formatMoney(e.amount, symbol, code)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
