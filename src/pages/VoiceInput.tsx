import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Mic, MicOff, Loader2, Save, Pencil, Volume2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { parseVoice, speechRecognitionAvailable, SAMPLE_VOICE_PHRASES } from '@/lib/voiceParser';
import { formatMoney } from '@/lib/format';
import { toDateOnly } from '@/lib/utils';
import { SuccessAnimation } from '@/components/SuccessAnimation';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface VoiceResult {
  amount: number;
  merchant: string;
  categoryHint: string;
  raw: string;
}

export default function VoiceInput() {
  const user = useStore((s) => s.user);
  const categories = useStore((s) => s.categories);
  const addExpense = useStore((s) => s.addExpense);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [catId, setCatId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState(false);
  const recRef = useRef<unknown>(null);

  const symbol = user?.currency_symbol ?? '₹';
  const code = user?.currency ?? 'INR';
  const available = speechRecognitionAvailable();

  useEffect(() => {
    return () => {
      if (recRef.current) {
        try {
          (recRef.current as { stop?: () => void }).stop?.();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  const handleResult = (finalText: string) => {
    setTranscript(finalText);
    setParsing(true);
    setTimeout(() => {
      const parsed = parseVoice(finalText);
      setResult(parsed);
      setMerchant(parsed.merchant);
      setAmount(String(parsed.amount || ''));
      const cat = categories.find((c) => c.name === parsed.categoryHint) ?? categories.find((c) => c.name === 'Other');
      setCatId(cat?.id ?? '');
      setParsing(false);
      setEditing(false);
      if (parsed.amount === 0) {
        toast.error('Could not detect an amount. Please type it manually.');
      }
    }, 900);
  };

  const startListening = () => {
    setResult(null);
    setTranscript('');
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => unknown) | undefined;
    if (!SR) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    (rec as { lang: string }).lang = 'en-IN';
    (rec as { continuous: boolean }).continuous = false;
    (rec as { interimResults: boolean }).interimResults = true;

    (rec as { onstart: () => void }).onstart = () => setListening(true);
    (rec as { onend: () => void }).onend = () => setListening(false);
    (rec as { onresult: (e: unknown) => void }).onresult = (event: unknown) => {
      const ev = event as { results: ArrayLike<ArrayLike<{ transcript: string }>> };
      let final = '';
      for (let i = 0; i < ev.results.length; i++) {
        final += ev.results[i][0].transcript + ' ';
      }
      const text = final.trim();
      setTranscript(text);
      if (text) {
        (rec as { stop: () => void }).stop();
        handleResult(text);
      }
    };
    (rec as { onerror: () => void }).onerror = () => {
      setListening(false);
      toast.error('Microphone error — check permissions');
    };
    try {
      (rec as { start: () => void }).start();
    } catch {
      /* already started */
    }
  };

  const stopListening = () => {
    try {
      (recRef.current as { stop?: () => void }).stop?.();
    } catch {
      /* noop */
    }
    setListening(false);
  };

  const handleSave = async () => {
    if (!result) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!catId) {
      toast.error('Please select a category');
      return;
    }
    await addExpense({
      amount: amt,
      merchant_name: merchant.trim() || result.merchant || 'Voice Expense',
      category_id: catId,
      payment_method: 'UPI',
      source: 'voice',
      date: toDateOnly(new Date()),
      description: `🎙️ "${result.raw}"`,
      is_recurring: false,
      tags: ['voice']
    });
    setSuccess(true);
    toast.success('Voice expense saved');
    setTimeout(() => {
      setSuccess(false);
      setResult(null);
      setTranscript('');
    }, 1400);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center p-4 sm:p-6">
      <SuccessAnimation show={success} title="Voice expense saved!" subtitle="Talked and it happened 🎙️" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Voice Input</h1>
      <p className="mb-8 text-sm text-muted-foreground">"I spent 200 rupees on coffee at Starbucks"</p>

      {!available && (
        <div className="mb-6 rounded-xl bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-600">
          Speech recognition isn't supported in this browser. Try Chrome or Edge on desktop/mobile.
        </div>
      )}

      <div className="relative flex items-center justify-center">
        <AnimatePresence>
          {listening && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute h-40 w-40 rounded-full bg-indigo-500/20 animate-pulse-ring"
            />
          )}
          {listening && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.15 }}
              className="absolute h-52 w-52 rounded-full bg-emerald-500/10 animate-pulse-ring"
            />
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.92 }}
          animate={listening ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={listening ? { repeat: Infinity, duration: 1.2 } : {}}
          onClick={listening ? stopListening : startListening}
          className={cn(
            'relative z-10 flex h-32 w-32 items-center justify-center rounded-full text-white shadow-glass-lg transition-colors',
            listening ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-indigo-500 to-emerald-500'
          )}
        >
          {listening ? <MicOff className="h-14 w-14" /> : <Mic className="h-14 w-14" />}
        </motion.button>
      </div>

      <div className="mt-6 text-center">
        {listening && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-primary">
            Listening... speak now 🎤
          </motion.div>
        )}
        {transcript && !result && <div className="text-sm text-muted-foreground">"{transcript}"</div>}
      </div>

      <AnimatePresence>
        {result && !listening && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 w-full">
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-indigo-500/10 p-5">
              <div className="mb-3 flex items-center justify-between">
                <Badge variant="success" className="gap-1">
                  <Volume2 className="h-3 w-3" /> Heard & parsed
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>
                  <Pencil className="h-3.5 w-3.5" /> {editing ? 'Done' : 'Edit'}
                </Button>
              </div>

              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Amount</label>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-bold" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Merchant</label>
                    <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="mb-4 text-center">
                  <div className="text-4xl font-bold">{formatMoney(parseFloat(amount) || 0, symbol, code)}</div>
                  <div className="mt-1 text-sm text-muted-foreground">at {merchant}</div>
                </div>
              )}

              <div className="mb-1 text-xs font-medium text-muted-foreground">Category</div>
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
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <span className="text-[9px] font-medium leading-tight text-center">{c.name}</span>
                  </button>
                ))}
              </div>

              <Button onClick={handleSave} className="mt-4 w-full" size="lg" variant="gradient">
                <Save className="h-4 w-4" /> Confirm & Save
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {parsing && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Parsing your voice...
        </div>
      )}

      <div className="mt-10 w-full">
        <div className="mb-3 text-xs font-medium text-muted-foreground">Try saying:</div>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_VOICE_PHRASES.map((p) => (
            <button key={p} onClick={() => handleResult(p)} className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
              "{p}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
