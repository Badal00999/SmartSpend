import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  User, Settings as SettingsIcon, Palette, Bell, Database, Info, LogOut,
  Moon, Sun, Plus, Trash2, Pencil, Upload, RefreshCw, Check, ChevronRight
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { CURRENCIES } from '@/lib/format';
import { CATEGORY_ICON_CHOICES, CATEGORY_COLOR_CHOICES } from '@/lib/seed';
import { downloadFile } from '@/lib/utils';
import { expensesToCsv } from '@/lib/analytics';
import { useTheme } from '@/components/layout/ThemeProvider';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export default function Settings() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const categories = useStore((s) => s.categories);
  const expenses = useStore((s) => s.expenses);
  const settings = useStore((s) => s.settings);
  const updateProfile = useStore((s) => s.updateProfile);
  const updateSettings = useStore((s) => s.updateSettings);
  const addCategory = useStore((s) => s.addCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const importCsvData = useStore((s) => s.importCsvData);
  const resetAllData = useStore((s) => s.resetAllData);
  const signOut = useStore((s) => s.signOut);
  const { theme, toggleTheme } = useTheme();

  const [name, setName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatar, setAvatar] = useState<string | undefined>();
  const [monthly, setMonthly] = useState(String(user?.monthly_budget ?? 0));
  const [weekly, setWeekly] = useState(String(user?.weekly_budget ?? 0));
  const [daily, setDaily] = useState(String(user?.daily_budget ?? 0));
  const [currency, setCurrency] = useState(user?.currency ?? 'INR');
  const [catModal, setCatModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', icon: '🍔', color: '#6366F1', budget_limit: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const symbol = user?.currency_symbol ?? '₹';

  const saveProfile = async () => {
    await updateProfile({
      full_name: name.trim() || user?.full_name,
      email: email.trim() || user?.email,
      ...(avatar ? {} : {})
    });
    toast.success('Profile updated');
  };

  const saveBudgets = async () => {
    await updateProfile({
      monthly_budget: parseFloat(monthly) || 0,
      weekly_budget: parseFloat(weekly) || 0,
      daily_budget: parseFloat(daily) || 0
    });
    toast.success('Budgets updated');
  };

  const changeCurrency = async () => {
    const c = CURRENCIES.find((x) => x.code === currency);
    await updateProfile({ currency, currency_symbol: c?.symbol ?? symbol });
    toast.success(`Currency set to ${c?.name}`);
  };

  const openAddCat = () => {
    setCatForm({ name: '', icon: '🍔', color: '#6366F1', budget_limit: '' });
    setCatModal({ open: true });
  };

  const openEditCat = (id: string) => {
    const c = categories.find((x) => x.id === id);
    if (!c) return;
    setCatForm({ name: c.name, icon: c.icon, color: c.color, budget_limit: String(c.budget_limit || '') });
    setCatModal({ open: true, id });
  };

  const saveCat = async () => {
    if (!catForm.name.trim()) return toast.error('Enter a category name');
    try {
      if (catModal.id) {
        await updateCategory(catModal.id, {
          name: catForm.name.trim(),
          icon: catForm.icon,
          color: catForm.color,
          budget_limit: parseFloat(catForm.budget_limit) || 0
        });
        toast.success('Category updated');
      } else {
        await addCategory({
          name: catForm.name.trim(),
          icon: catForm.icon,
          color: catForm.color,
          budget_limit: parseFloat(catForm.budget_limit) || 0,
          is_default: false
        });
        toast.success('Category added');
      }
      setCatModal({ open: false });
    } catch {
      toast.error('Failed to save category');
    }
  };

  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      toast.error('Empty or invalid CSV');
      return;
    }
    const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.replace(/"/g, '').trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => (row[h] = vals[i] ?? ''));
      return row;
    });
    try {
      const n = await importCsvData(rows);
      toast.success(`Imported ${n} expenses`);
    } catch {
      toast.error('Failed to import CSV');
    }
    e.target.value = '';
  };

  const exportAll = () => {
    const data = {
      profile: user,
      categories,
      expenses,
      settings,
      exportedAt: new Date().toISOString()
    };
    downloadFile(JSON.stringify(data, null, 2), 'smartspend-export.json', 'application/json');
    toast.success('All data exported');
  };

  const exportCsv = () => {
    downloadFile(expensesToCsv(expenses, categories), 'smartspend-expenses.csv', 'text/csv');
    toast.success('Expenses exported as CSV');
  };

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <SettingsIcon className="h-6 w-6 text-primary" /> Settings
      </h1>

      <Accordion type="multiple" defaultValue={['profile', 'appearance']} className="space-y-3">
        <AccordionItem value="profile" className="rounded-2xl border bg-card px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Profile</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-2">
              <div className="flex items-center gap-4">
                <Avatar fallback={name || 'U'} size="lg" src={avatar} />
                <div>
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" /> Upload photo
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const r = new FileReader();
                      r.onload = () => setAvatar(r.result as string);
                      r.readAsDataURL(f);
                    }
                  }} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <Button onClick={saveProfile}>Save profile</Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="currency" className="rounded-2xl border bg-card px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><span className="text-base">💱</span> Currency</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-2 pb-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border-2 p-3 text-left transition-all active:scale-95',
                    currency === c.code ? 'border-primary bg-primary/10' : 'border-border'
                  )}
                >
                  <span className="text-xl">{c.symbol}</span>
                  <div>
                    <div className="text-sm font-semibold">{c.code}</div>
                    <div className="text-[10px] text-muted-foreground">{c.name}</div>
                  </div>
                  {currency === c.code && <Check className="ml-auto h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            <Button onClick={changeCurrency} className="mt-2">Apply currency</Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="budget" className="rounded-2xl border bg-card px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><span className="text-base">🎯</span> Default budgets</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 sm:grid-cols-3 pb-2">
              <div className="space-y-2">
                <Label>Monthly ({symbol})</Label>
                <Input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Weekly ({symbol})</Label>
                <Input type="number" value={weekly} onChange={(e) => setWeekly(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Daily ({symbol})</Label>
                <Input type="number" value={daily} onChange={(e) => setDaily(e.target.value)} />
              </div>
            </div>
            <Button onClick={saveBudgets} className="mb-2">Save budgets</Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="categories" className="rounded-2xl border bg-card px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><span className="text-base">🗂️</span> Categories</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="mb-3 flex justify-end">
              <Button size="sm" onClick={openAddCat} variant="gradient">
                <Plus className="h-4 w-4" /> Add category
              </Button>
            </div>
            <div className="space-y-1.5 pb-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="flex-1 text-sm font-medium">{c.name}</span>
                  {c.budget_limit > 0 && <span className="text-xs text-muted-foreground">{symbol}{c.budget_limit}</span>}
                  <Button variant="ghost" size="icon" onClick={() => openEditCat(c.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteCatId(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="appearance" className="rounded-2xl border bg-card px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Appearance</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center justify-between pb-2">
              <div>
                <div className="text-sm font-medium">Theme</div>
                <div className="text-xs text-muted-foreground">Switch between light and dark</div>
              </div>
              <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notifications" className="rounded-2xl border bg-card px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Bell className="h-4 w-4 text-primary" /> Notifications</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              {([
                ['daily_summary', 'Daily summary', 'End-of-day spending recap'],
                ['weekly_report', 'Weekly report', 'Weekly spending digest'],
                ['budget_alerts', 'Budget alerts', '50% / 80% / 100% warnings'],
                ['spending_alerts', 'Spending alerts', 'Large purchase alerts']
              ] as const).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <Switch
                    checked={settings.notifications[key]}
                    onCheckedChange={(v) => updateSettings({ notifications: { ...settings.notifications, [key]: v } })}
                  />
                </div>
              ))}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Carry forward budget</div>
                  <div className="text-xs text-muted-foreground">Roll unused budget to next month</div>
                </div>
                <Switch
                  checked={settings.carry_forward_budget}
                  onCheckedChange={(v) => updateSettings({ carry_forward_budget: v })}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="data" className="rounded-2xl border bg-card px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Data</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2 pb-2">
              <Button variant="outline" size="sm" onClick={exportCsv}><Upload className="h-3.5 w-3.5" /> Export CSV</Button>
              <Button variant="outline" size="sm" onClick={exportAll}><Upload className="h-3.5 w-3.5" /> Export all (JSON)</Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <DownloadIcon /> Import CSV
              </Button>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
            </div>
            <div className="flex flex-wrap gap-2 pb-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/reports')}><ChevronRight className="h-3.5 w-3.5" /> Monthly reports</Button>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" /> Reset all data
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="about" className="rounded-2xl border bg-card px-4">
          <AccordionTrigger>
            <span className="flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> About</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 pb-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 text-sm text-white">₹</div>
                <span className="font-bold">SmartSpend v1.0.0</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Automatic Expense Tracker with SMS parsing, voice input, budgets, and AI insights. Built with React, TypeScript, Supabase, and Recharts.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button
        variant="outline"
        className="mt-4 w-full text-destructive hover:text-destructive"
        onClick={async () => {
          await signOut();
          navigate('/login');
        }}
      >
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      <Dialog open={catModal.open} onOpenChange={(o) => setCatModal({ open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{catModal.id ? 'Edit category' : 'Add category'}</DialogTitle>
            <DialogDescription>Customize the icon and color.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="e.g. Pets" />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_ICON_CHOICES.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setCatForm({ ...catForm, icon })}
                    className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-all', catForm.icon === icon ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted hover:bg-accent')}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_COLOR_CHOICES.map((color) => (
                  <button
                    key={color}
                    onClick={() => setCatForm({ ...catForm, color })}
                    className={cn('h-8 w-8 rounded-full transition-transform', catForm.color === color && 'scale-110 ring-2 ring-offset-2 ring-primary')}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Budget limit (optional)</Label>
              <Input type="number" value={catForm.budget_limit} onChange={(e) => setCatForm({ ...catForm, budget_limit: e.target.value })} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatModal({ open: false })}>Cancel</Button>
            <Button onClick={saveCat}>{catModal.id ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCatId} onOpenChange={(o) => !o && setDeleteCatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>Expenses in this category will move to "Other".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (deleteCatId) await deleteCategory(deleteCatId); setDeleteCatId(null); toast.success('Category deleted'); }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all expenses, income, budgets and settings. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await resetAllData(); setResetOpen(false); toast.success('All data cleared'); }}>
              Reset everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
    </svg>
  );
}
