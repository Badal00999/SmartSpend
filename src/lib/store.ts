import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import toast from 'react-hot-toast';
import { supabase, DEMO_MODE } from './supabase';
import { uid, toDateOnly } from './utils';
import {
  buildDefaultCategories,
  buildSampleExpenses,
  buildSampleIncome,
  buildSampleBudgets
} from './seed';
import { detectCategory } from './merchantMap';
import type {
  UserProfile,
  Category,
  Expense,
  Income,
  Budget,
  SmsRule,
  Settings,
  SplitExpense,
  PaymentMethod,
  ExpenseSource,
  RecurringFrequency
} from './types';

export interface Template {
  id: string;
  merchant: string;
  amount: number;
  category_id: string;
  payment_method: PaymentMethod;
  source: ExpenseSource;
}

interface StreakState {
  count: number;
  lastUnderBudgetDay: string;
  best: number;
}

interface PersistedState {
  user: UserProfile | null;
  categories: Category[];
  expenses: Expense[];
  income: Income[];
  budgets: Budget[];
  smsRules: SmsRule[];
  settings: Settings;
  streak: StreakState;
  templates: Template[];
  splits: SplitExpense[];
  onboarded: boolean;
}

interface StoreState extends PersistedState {
  initialized: boolean;
  loading: boolean;
  init(): Promise<void>;
  refresh(): Promise<void>;
  signUp(email: string, password: string, fullName: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signInGoogle(): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  completeOnboarding(monthlyBudget: number, categoryNames: string[], currency: string, symbol: string): Promise<void>;

  updateProfile(partial: Partial<UserProfile>): Promise<void>;
  updateSettings(partial: Partial<Settings>): Promise<void>;

  addCategory(data: Omit<Category, 'id' | 'user_id' | 'created_at'>): Promise<void>;
  updateCategory(id: string, partial: Partial<Category>): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  addExpense(data: Omit<Expense, 'id' | 'user_id' | 'created_at'>): Promise<Expense>;
  updateExpense(id: string, partial: Partial<Expense>): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  restoreLastDeleted(): Promise<void>;

  addIncome(data: Omit<Income, 'id' | 'user_id' | 'created_at'>): Promise<void>;
  updateIncome(id: string, partial: Partial<Income>): Promise<void>;
  deleteIncome(id: string): Promise<void>;

  addBudget(data: Omit<Budget, 'id' | 'user_id' | 'created_at'>): Promise<void>;
  updateBudget(id: string, partial: Partial<Budget>): Promise<void>;
  deleteBudget(id: string): Promise<void>;

  addSmsRule(keyword: string, categoryId: string): Promise<void>;
  deleteSmsRule(id: string): Promise<void>;

  addTemplate(data: Omit<Template, 'id'>): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
  autoCreateTemplates(): void;

  addSplit(data: Omit<SplitExpense, 'id'>): Promise<void>;
  updateSplit(id: string, partial: Partial<SplitExpense>): Promise<void>;
  deleteSplit(id: string): Promise<void>;

  refreshStreak(): void;
  importCsvData(rows: Array<Record<string, string>>): Promise<number>;
  resetAllData(): Promise<void>;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  notifications: {
    daily_summary: true,
    weekly_report: true,
    budget_alerts: true,
    spending_alerts: true
  },
  carry_forward_budget: false
};

const DEFAULT_STREAK: StreakState = { count: 0, lastUnderBudgetDay: '', best: 0 };

let lastDeleted: { type: 'expense' | 'income'; data: unknown } | null = null;

const todayStr = () => toDateOnly(new Date());

export function checkBudgetAlert(exp: Expense) {
  const s = useStore.getState();
  if (!s.settings.notifications.budget_alerts) return;
  const now = new Date();
  const budget = s.budgets.find((b) => b.category_id === exp.category_id);
  if (!budget || budget.amount <= 0) return;
  const monthExpenses = s.expenses.filter((e) => {
    const d = new Date(e.date);
    return e.category_id === exp.category_id && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const spent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const usage = (spent / budget.amount) * 100;
  const cat = s.categories.find((c) => c.id === exp.category_id);
  const name = cat?.name ?? 'this category';
  if (usage >= 100) {
    toast.error(`Monthly budget exceeded for ${name}! 🔴`, { icon: '🚨' });
  } else if (usage >= 85) {
    toast(`You've used ${Math.round(usage)}% of your ${name} budget!`, { icon: '⚠️' });
  } else if (usage >= 50) {
    toast(`You've used ${Math.round(usage)}% of your ${name} budget.`, { icon: '📊' });
  }
  const monthlyTotal = s.expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((sum, e) => sum + e.amount, 0);
  const user = s.user;
  if (user && user.monthly_budget > 0) {
    const mUsage = (monthlyTotal / user.monthly_budget) * 100;
    if (mUsage >= 100) {
      toast.error(`Monthly budget exceeded by ${user.currency_symbol}${Math.round(monthlyTotal - user.monthly_budget)}!`, { icon: '🚨' });
    } else if (mUsage >= 85) {
      toast(`You've used ${Math.round(mUsage)}% of your monthly budget.`, { icon: '⚠️' });
    }
  }
}


export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      user: null,
      categories: [],
      expenses: [],
      income: [],
      budgets: [],
      smsRules: [],
      settings: DEFAULT_SETTINGS,
      streak: DEFAULT_STREAK,
      templates: [],
      splits: [],
      onboarded: false,
      initialized: false,
      loading: false,

      async init() {
        set({ loading: true });
        try {
          if (!DEMO_MODE && supabase) {
            const { data: session } = await supabase.auth.getSession();
            if (session?.session?.user) {
              const user = session.session.user;
              const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
              const profile: UserProfile =
                (profiles as UserProfile) ??
                ({
                  id: user.id,
                  email: user.email ?? '',
                  full_name: user.user_metadata?.full_name ?? '',
                  monthly_budget: 0,
                  weekly_budget: 0,
                  daily_budget: 0,
                  currency: 'INR',
                  currency_symbol: '₹',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                } as UserProfile);
              set({ user: profile });
              await get().refresh();
            }
          }
        } finally {
          set({ loading: false, initialized: true });
        }
      },

      async refresh() {
        if (!get().user || DEMO_MODE) return;
        if (!supabase) return;
        const uid_ = get().user!.id;
        const [cats, exps, inc, buds, rules] = await Promise.all([
          supabase.from('categories').select('*').eq('user_id', uid_),
          supabase.from('expenses').select('*, category:categories(*)').eq('user_id', uid_),
          supabase.from('income').select('*').eq('user_id', uid_),
          supabase.from('budgets').select('*, category:categories(*)').eq('user_id', uid_),
          supabase.from('sms_rules').select('*, category:categories(*)').eq('user_id', uid_)
        ]);
        set({
          categories: (cats.data ?? []) as Category[],
          expenses: (exps.data ?? []) as Expense[],
          income: (inc.data ?? []) as Income[],
          budgets: (buds.data ?? []) as Budget[],
          smsRules: (rules.data ?? []) as SmsRule[]
        });
      },

      async signUp(email, password, fullName) {
        set({ loading: true });
        try {
          if (DEMO_MODE) {
            const user: UserProfile = {
              id: uid('usr'),
              email,
              full_name: fullName,
              monthly_budget: 0,
              weekly_budget: 0,
              daily_budget: 0,
              currency: 'INR',
              currency_symbol: '₹',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            const cats = buildDefaultCategories(user.id);
            set({ user, categories: cats, onboarded: false, initialized: true });
            return;
          }
          if (!supabase) throw new Error('Supabase not configured');
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
          });
          if (error) throw error;
          if (data.user) {
            const user: UserProfile = {
              id: data.user.id,
              email,
              full_name: fullName,
              monthly_budget: 0,
              weekly_budget: 0,
              daily_budget: 0,
              currency: 'INR',
              currency_symbol: '₹',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            await supabase.from('profiles').insert({ ...user });
            const cats = buildDefaultCategories(user.id);
            await supabase.from('categories').insert(cats.map((c) => ({ ...c, id: undefined })));
            set({ user, categories: cats, onboarded: false });
          }
        } finally {
          set({ loading: false });
        }
      },

      async signIn(email, password) {
        set({ loading: true });
        try {
          if (DEMO_MODE) {
            const stored = localStorage.getItem('smartspend-storage');
            let existing: PersistedState | null = null;
            if (stored) {
              try {
                existing = JSON.parse(stored).state as PersistedState;
              } catch {
                existing = null;
              }
            }
            let user = existing?.user;
            if (user && user.email === email) {
              set({ ...existing, onboarded: true, initialized: true, loading: false });
              return;
            }
            const newUser: UserProfile = {
              id: uid('usr'),
              email,
              full_name: email.split('@')[0],
              monthly_budget: 25000,
              weekly_budget: 6000,
              daily_budget: 900,
              currency: 'INR',
              currency_symbol: '₹',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            const cats = buildDefaultCategories(newUser.id);
            const expenses = buildSampleExpenses(newUser.id, cats);
            const income = buildSampleIncome(newUser.id);
            const budgets = buildSampleBudgets(newUser.id, cats);
            set({
              user: newUser,
              categories: cats,
              expenses,
              income,
              budgets,
              onboarded: true,
              initialized: true
            });
            return;
          }
          if (!supabase) throw new Error('Supabase not configured');
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          await get().init();
        } finally {
          set({ loading: false });
        }
      },

      async signInGoogle() {
        set({ loading: true });
        try {
          if (DEMO_MODE) {
            await get().signIn('demo@gmail.com', 'google');
            return;
          }
          if (!supabase) throw new Error('Supabase not configured');
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
          });
          if (error) throw error;
        } finally {
          set({ loading: false });
        }
      },

      async signOut() {
        if (!DEMO_MODE && supabase) {
          await supabase.auth.signOut();
        }
        set({
          user: null,
          categories: [],
          expenses: [],
          income: [],
          budgets: [],
          smsRules: [],
          templates: [],
          splits: [],
          onboarded: false
        });
      },

      async resetPassword(email) {
        if (DEMO_MODE) {
          toast.success('Password reset link sent (demo mode)');
          return;
        }
        if (!supabase) throw new Error('Supabase not configured');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password'
        });
        if (error) throw error;
      },

      async updatePassword(password) {
        if (DEMO_MODE) return;
        if (!supabase) throw new Error('Supabase not configured');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },

      async completeOnboarding(monthlyBudget, categoryNames, currency, symbol) {
        const user = get().user;
        if (!user) return;
        const newUser = {
          ...user,
          monthly_budget: monthlyBudget,
          weekly_budget: Math.round(monthlyBudget / 4),
          daily_budget: Math.round(monthlyBudget / 30),
          currency,
          currency_symbol: symbol
        };
        set({ user: newUser, onboarded: true });

        const filtered = get().categories.filter((c) => categoryNames.includes(c.name));
        const missing = buildDefaultCategories(user.id).filter((c) => categoryNames.includes(c.name) && !filtered.some((f) => f.name === c.name));
        const cats = [...filtered, ...missing];
        set({ categories: cats });

        if (DEMO_MODE) {
          const sampleExps = buildSampleExpenses(user.id, cats);
          const sampleIncome = buildSampleIncome(user.id);
          const sampleBudgets = buildSampleBudgets(user.id, cats);
          set({ expenses: sampleExps, income: sampleIncome, budgets: sampleBudgets });
        } else if (supabase) {
          await supabase.from('profiles').update(newUser).eq('id', user.id);
          await supabase.from('categories').insert(
            missing.map((c) => ({ name: c.name, icon: c.icon, color: c.color, budget_limit: 0, is_default: true }))
          );
        }
      },

      async updateProfile(partial) {
        const user = get().user;
        if (!user) return;
        const updated = { ...user, ...partial, updated_at: new Date().toISOString() };
        set({ user: updated });
        if (!DEMO_MODE && supabase) {
          await supabase.from('profiles').update(partial).eq('id', user.id);
        }
      },

      async updateSettings(partial) {
        const settings = { ...get().settings, ...partial };
        set({ settings });
      },

      async addCategory(data) {
        const user = get().user;
        if (!user) return;
        const cat: Category = {
          ...data,
          id: uid('cat'),
          user_id: user.id,
          created_at: new Date().toISOString()
        };
        set({ categories: [...get().categories, cat] });
        if (!DEMO_MODE && supabase) {
          await supabase.from('categories').insert({ ...data, user_id: user.id });
        }
      },

      async updateCategory(id, partial) {
        set({
          categories: get().categories.map((c) => (c.id === id ? { ...c, ...partial } : c))
        });
        if (!DEMO_MODE && supabase) {
          await supabase.from('categories').update(partial).eq('id', id);
        }
      },

      async deleteCategory(id) {
        set({
          categories: get().categories.filter((c) => c.id !== id),
          expenses: get().expenses.map((e) => (e.category_id === id ? { ...e, category_id: '' } : e))
        });
        if (!DEMO_MODE && supabase) {
          await supabase.from('categories').delete().eq('id', id);
        }
      },

      async addExpense(data) {
        const user = get().user;
        if (!user) throw new Error('Not signed in');
        const exp: Expense = {
          ...data,
          id: uid('exp'),
          user_id: user.id,
          created_at: new Date().toISOString()
        };
        set({ expenses: [exp, ...get().expenses] });
        if (!DEMO_MODE && supabase) {
          const { data: inserted } = await supabase
            .from('expenses')
            .insert({ ...data, user_id: user.id })
            .select('*, category:categories(*)')
            .single();
          if (inserted) {
            set({ expenses: get().expenses.map((e) => (e.id === exp.id ? (inserted as Expense) : e)) });
          }
        }
        checkBudgetAlert(exp);
        get().refreshStreak();
        get().autoCreateTemplates();
        return exp;
      },

      async updateExpense(id, partial) {
        set({
          expenses: get().expenses.map((e) => (e.id === id ? { ...e, ...partial } : e))
        });
        if (!DEMO_MODE && supabase) {
          await supabase.from('expenses').update(partial).eq('id', id);
        }
      },

      async deleteExpense(id) {
        const target = get().expenses.find((e) => e.id === id);
        if (target) lastDeleted = { type: 'expense', data: target };
        set({ expenses: get().expenses.filter((e) => e.id !== id) });
        if (!DEMO_MODE && supabase) {
          await supabase.from('expenses').delete().eq('id', id);
        }
        get().refreshStreak();
      },

      async restoreLastDeleted() {
        if (!lastDeleted) return;
        if (lastDeleted.type === 'expense') {
          const e = lastDeleted.data as Expense;
          set({ expenses: [e, ...get().expenses] });
          if (!DEMO_MODE && supabase) {
            await supabase.from('expenses').insert({ ...e, id: undefined, user_id: e.user_id });
          }
        } else {
          const i = lastDeleted.data as Income;
          set({ income: [i, ...get().income] });
          if (!DEMO_MODE && supabase) {
            await supabase.from('income').insert({ ...i, id: undefined, user_id: i.user_id });
          }
        }
        lastDeleted = null;
      },

      async addIncome(data) {
        const user = get().user;
        if (!user) return;
        const inc: Income = {
          ...data,
          id: uid('inc'),
          user_id: user.id,
          created_at: new Date().toISOString()
        };
        set({ income: [inc, ...get().income] });
        if (!DEMO_MODE && supabase) {
          await supabase.from('income').insert({ ...data, user_id: user.id });
        }
      },

      async updateIncome(id, partial) {
        set({
          income: get().income.map((i) => (i.id === id ? { ...i, ...partial } : i))
        });
        if (!DEMO_MODE && supabase) {
          await supabase.from('income').update(partial).eq('id', id);
        }
      },

      async deleteIncome(id) {
        const target = get().income.find((i) => i.id === id);
        if (target) lastDeleted = { type: 'income', data: target };
        set({ income: get().income.filter((i) => i.id !== id) });
        if (!DEMO_MODE && supabase) {
          await supabase.from('income').delete().eq('id', id);
        }
      },

      async addBudget(data) {
        const user = get().user;
        if (!user) return;
        const budget: Budget = {
          ...data,
          id: uid('bud'),
          user_id: user.id,
          created_at: new Date().toISOString()
        };
        set({ budgets: [...get().budgets, budget] });
        if (!DEMO_MODE && supabase) {
          await supabase.from('budgets').insert({ ...data, user_id: user.id });
        }
      },

      async updateBudget(id, partial) {
        set({
          budgets: get().budgets.map((b) => (b.id === id ? { ...b, ...partial } : b))
        });
        if (!DEMO_MODE && supabase) {
          await supabase.from('budgets').update(partial).eq('id', id);
        }
      },

      async deleteBudget(id) {
        set({ budgets: get().budgets.filter((b) => b.id !== id) });
        if (!DEMO_MODE && supabase) {
          await supabase.from('budgets').delete().eq('id', id);
        }
      },

      async addSmsRule(keyword, categoryId) {
        const user = get().user;
        if (!user) return;
        const rule: SmsRule = {
          id: uid('rule'),
          user_id: user.id,
          keyword,
          category_id: categoryId,
          created_at: new Date().toISOString()
        };
        set({ smsRules: [...get().smsRules, rule] });
        if (!DEMO_MODE && supabase) {
          await supabase.from('sms_rules').insert({ keyword, category_id: categoryId, user_id: user.id });
        }
      },

      async deleteSmsRule(id) {
        set({ smsRules: get().smsRules.filter((r) => r.id !== id) });
        if (!DEMO_MODE && supabase) {
          await supabase.from('sms_rules').delete().eq('id', id);
        }
      },

      async addTemplate(data) {
        const t: Template = { ...data, id: uid('tpl') };
        set({ templates: [...get().templates, t] });
      },

      async deleteTemplate(id) {
        set({ templates: get().templates.filter((t) => t.id !== id) });
      },

      autoCreateTemplates() {
        const { expenses, templates } = get();
        const recent = [...expenses]
          .filter((e) => e.source === 'manual')
          .slice(0, 30);
        const count = new Map<string, number>();
        for (const e of recent) {
          count.set(e.merchant_name, (count.get(e.merchant_name) ?? 0) + 1);
        }
        const frequent = [...count.entries()]
          .filter(([, c]) => c >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        const existingNames = new Set(templates.map((t) => t.merchant.toLowerCase()));
        const fresh: Template[] = [];
        for (const [merchant] of frequent) {
          if (existingNames.has(merchant.toLowerCase())) continue;
          const sample = expenses.find((e) => e.merchant_name === merchant);
          if (!sample) continue;
          fresh.push({
            id: uid('tpl'),
            merchant: sample.merchant_name,
            amount: Math.round(sample.amount),
            category_id: sample.category_id,
            payment_method: sample.payment_method,
            source: 'manual'
          });
        }
        if (fresh.length) set({ templates: [...templates, ...fresh] });
      },

      async addSplit(data) {
        const s: SplitExpense = { ...data, id: uid('split') };
        set({ splits: [...get().splits, s] });
      },

      async updateSplit(id, partial) {
        set({
          splits: get().splits.map((s) => (s.id === id ? { ...s, ...partial } : s))
        });
      },

      async deleteSplit(id) {
        set({ splits: get().splits.filter((s) => s.id !== id) });
      },

      refreshStreak() {
        const { expenses, user } = get();
        if (!user) return;
        const today = todayStr();
        const spentToday = expenses
          .filter((e) => e.date === today)
          .reduce((s, e) => s + e.amount, 0);
        const underBudgetToday = user.daily_budget > 0 && spentToday <= user.daily_budget;

        let streak = get().streak;
        const yesterday = toDateOnly(new Date(Date.now() - 86400000));

        if (streak.lastUnderBudgetDay === today) return;

        if (underBudgetToday) {
          if (streak.lastUnderBudgetDay === yesterday) {
            streak = { ...streak, count: streak.count + 1, lastUnderBudgetDay: today, best: Math.max(streak.best, streak.count + 1) };
          } else {
            streak = { count: 1, lastUnderBudgetDay: today, best: Math.max(streak.best, 1) };
          }
        } else if (streak.lastUnderBudgetDay !== today && streak.lastUnderBudgetDay !== yesterday) {
          if (streak.count > 0) {
            toast(`😢 Your ${streak.count}-day streak has been broken. Add today's expenses to rebuild it!`);
          }
          streak = { count: 0, lastUnderBudgetDay: '', best: streak.best };
        }
        set({ streak });
      },

      async importCsvData(rows) {
        const user = get().user;
        if (!user) return 0;
        let added = 0;
        const cats = get().categories;
        for (const row of rows) {
          const amount = parseFloat(String(row['Amount'] ?? row['amount'] ?? 0));
          const merchant = String(row['Merchant'] ?? row['merchant'] ?? row['Merchant Name'] ?? 'Imported');
          const date = String(row['Date'] ?? row['date'] ?? todayStr());
          if (!amount || isNaN(amount)) continue;
          const categoryName = String(row['Category'] ?? row['category'] ?? detectCategory(merchant) ?? 'Other');
          let cat = cats.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
          if (!cat) {
            cat = cats.find((c) => c.name === 'Other') ?? cats[0];
          }
          await get().addExpense({
            amount,
            merchant_name: merchant,
            category_id: cat.id,
            payment_method: (String(row['Payment Method'] ?? 'UPI') as PaymentMethod) || 'UPI',
            source: 'manual',
            date: toDateOnly(new Date(date)),
            description: String(row['Description'] ?? ''),
            is_recurring: false,
            tags: []
          });
          added++;
        }
        return added;
      },

      async resetAllData() {
        const user = get().user;
        if (!user) return;
        if (!DEMO_MODE && supabase) {
          await Promise.all([
            supabase.from('expenses').delete().eq('user_id', user.id),
            supabase.from('income').delete().eq('user_id', user.id),
            supabase.from('budgets').delete().eq('user_id', user.id),
            supabase.from('splits').delete().eq('user_id', user.id),
            supabase.from('templates').delete().eq('user_id', user.id)
          ]);
        }
        const cats = get().categories.length ? get().categories : buildDefaultCategories(user.id);
        set({
          expenses: [],
          income: [],
          budgets: [],
          smsRules: [],
          templates: [],
          splits: [],
          streak: DEFAULT_STREAK,
          categories: cats
        });
      }
    }),
    {
      name: 'smartspend-storage',
      partialize: (s) => ({
        user: s.user,
        categories: s.categories,
        expenses: s.expenses,
        income: s.income,
        budgets: s.budgets,
        smsRules: s.smsRules,
        settings: s.settings,
        streak: s.streak,
        templates: s.templates,
        splits: s.splits,
        onboarded: s.onboarded
      })
    }
  )
);
