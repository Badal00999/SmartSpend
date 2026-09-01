export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  monthly_budget: number;
  weekly_budget: number;
  daily_budget: number;
  currency: string;
  currency_symbol: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  budget_limit: number;
  is_default: boolean;
  created_at: string;
}

export type ExpenseSource = 'manual' | 'sms' | 'voice' | 'receipt' | 'notification';
export type PaymentMethod = 'UPI' | 'Credit Card' | 'Debit Card' | 'Cash' | 'Net Banking' | 'Wallet';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Expense {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  merchant_name: string;
  description?: string;
  source: ExpenseSource;
  payment_method: PaymentMethod;
  date: string;
  time?: string;
  is_recurring: boolean;
  recurring_frequency?: RecurringFrequency;
  location?: string;
  receipt_url?: string;
  tags?: string[];
  created_at: string;
  category?: Category;
}

export interface Income {
  id: string;
  user_id: string;
  amount: number;
  source_name: string;
  description?: string;
  date: string;
  is_recurring: boolean;
  recurring_frequency?: RecurringFrequency;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date?: string;
  end_date?: string;
  created_at: string;
  category?: Category;
}

export interface SmsRule {
  id: string;
  user_id: string;
  keyword: string;
  category_id: string;
  created_at: string;
  category?: Category;
}

export interface ParsedSms {
  amount: number;
  merchant: string;
  date: string;
  accountLast4?: string;
  type: 'debit' | 'credit';
  raw: string;
}

export interface ParsedVoice {
  amount: number;
  merchant: string;
  categoryHint: string;
  raw: string;
}

export interface SplitExpense {
  id: string;
  total_amount: number;
  people: string[];
  per_person: number;
  paid_by: Record<string, boolean>;
  date: string;
  note?: string;
}

export interface ToastSettings {
  daily_summary: boolean;
  weekly_report: boolean;
  budget_alerts: boolean;
  spending_alerts: boolean;
}

export interface Settings {
  theme: 'light' | 'dark';
  notifications: ToastSettings;
  carry_forward_budget: boolean;
}
