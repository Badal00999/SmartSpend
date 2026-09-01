import { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Users, Plus, Trash2, Check, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatMoney, formatDatePretty } from '@/lib/format';
import { toDateOnly } from '@/lib/utils';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { SplitExpense } from '@/lib/types';

export default function Splits() {
  const user = useStore((s) => s.user);
  const splits = useStore((s) => s.splits);
  const addSplit = useStore((s) => s.addSplit);
  const updateSplit = useStore((s) => s.updateSplit);
  const deleteSplit = useStore((s) => s.deleteSplit);

  const [modal, setModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [people, setPeople] = useState<string[]>(['You']);
  const [nameInput, setNameInput] = useState('');

  const symbol = user?.currency_symbol ?? '₹';
  const code = user?.currency ?? 'INR';

  const perPerson = people.length > 0 ? parseFloat(amount) / people.length : 0;

  const addPerson = () => {
    const n = nameInput.trim();
    if (!n) return;
    setPeople((p) => [...p, n]);
    setNameInput('');
  };

  const createSplit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error('Enter a valid total amount');
    if (people.length < 2) return toast.error('Add at least one other person');
    const paidBy: Record<string, boolean> = {};
    people.forEach((p) => (paidBy[p] = p === 'You'));
    await addSplit({
      total_amount: amt,
      people,
      per_person: amt / people.length,
      paid_by: paidBy,
      date: toDateOnly(new Date()),
      note: note.trim() || undefined
    });
    toast.success('Split created');
    setModal(false);
    setAmount('');
    setNote('');
    setPeople(['You']);
  };

  const togglePaid = async (s: SplitExpense, person: string) => {
    await updateSplit(s.id, { paid_by: { ...s.paid_by, [person]: !s.paid_by[person] } });
  };

  const allPaid = (s: SplitExpense) => s.people.every((p) => s.paid_by[p]);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-500">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Split Expenses</h1>
            <p className="text-xs text-muted-foreground">Split bills and track who owes what</p>
          </div>
        </div>
        <Button onClick={() => setModal(true)} variant="gradient" size="sm">
          <Plus className="h-4 w-4" /> Split
        </Button>
      </div>

      {splits.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8 text-primary" />}
          title="No splits yet"
          description="Split a dinner, trip, or rent with friends."
          action={<Button onClick={() => setModal(true)}><Plus className="h-4 w-4" /> Create split</Button>}
        />
      ) : (
        <div className="space-y-3">
          {splits.map((s) => (
            <motion.div key={s.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{formatMoney(s.total_amount, symbol, code)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDatePretty(s.date)} · {s.note}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatMoney(s.per_person, symbol, code)} each
                  </span>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { deleteSplit(s.id); toast.success('Split removed'); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                {s.people.map((p) => (
                  <button
                    key={p}
                    onClick={() => togglePaid(s, p)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl border p-2.5 text-sm transition-all active:scale-[0.98]',
                      s.paid_by[p] ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border'
                    )}
                  >
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border', s.paid_by[p] ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground')}>
                      {s.paid_by[p] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 text-muted-foreground" />}
                    </span>
                    <span className="flex-1 text-left font-medium">{p}</span>
                    <span className={cn('text-xs', s.paid_by[p] ? 'text-emerald-500' : 'text-muted-foreground')}>
                      {s.paid_by[p] ? 'Paid' : `Owes ${formatMoney(s.per_person, symbol, code)}`}
                    </span>
                  </button>
                ))}
              </div>
              {allPaid(s) && (
                <div className="mt-3 rounded-xl bg-emerald-500/10 p-2 text-center text-xs font-medium text-emerald-500">
                  ✅ All settled — everyone's paid their share!
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a split</DialogTitle>
            <DialogDescription>Enter the total and who was involved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Total amount ({symbol})</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2000" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dinner at Barbeque Nation" />
            </div>
            <div className="space-y-2">
              <Label>People</Label>
              <div className="flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <span key={p} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                    {p}
                    {p !== 'You' && (
                      <button onClick={() => setPeople(people.filter((x) => x !== p))} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Friend's name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPerson())} />
                <Button variant="outline" onClick={addPerson}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            {perPerson > 0 && (
              <div className="rounded-xl bg-primary/10 p-3 text-center text-sm">
                Each person pays <span className="font-bold">{formatMoney(perPerson, symbol, code)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={createSplit} variant="gradient">Create split</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
