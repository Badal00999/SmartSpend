import { toDateOnly, uid } from './utils';
import type { Category, Expense, Income, Budget } from './types';

export const DEFAULT_CATEGORIES: Array<Omit<Category, 'id' | 'user_id' | 'created_at'>> = [
  { name: 'Food & Dining', icon: '🍔', color: '#EF4444', budget_limit: 0, is_default: true },
  { name: 'Travel & Transport', icon: '🚗', color: '#3B82F6', budget_limit: 0, is_default: true },
  { name: 'Shopping', icon: '🛍️', color: '#8B5CF6', budget_limit: 0, is_default: true },
  { name: 'Bills & Utilities', icon: '💡', color: '#F59E0B', budget_limit: 0, is_default: true },
  { name: 'Entertainment', icon: '🎬', color: '#EC4899', budget_limit: 0, is_default: true },
  { name: 'Health & Medical', icon: '💊', color: '#10B981', budget_limit: 0, is_default: true },
  { name: 'Education', icon: '📚', color: '#6366F1', budget_limit: 0, is_default: true },
  { name: 'Grocery', icon: '🛒', color: '#14B8A6', budget_limit: 0, is_default: true },
  { name: 'Fuel', icon: '⛽', color: '#F97316', budget_limit: 0, is_default: true },
  { name: 'Rent & Housing', icon: '🏠', color: '#64748B', budget_limit: 0, is_default: true },
  { name: 'EMI & Loans', icon: '💳', color: '#DC2626', budget_limit: 0, is_default: true },
  { name: 'Investment', icon: '💰', color: '#059669', budget_limit: 0, is_default: true },
  { name: 'Gifts & Donations', icon: '🎁', color: '#D946EF', budget_limit: 0, is_default: true },
  { name: 'Other', icon: '📦', color: '#6B7280', budget_limit: 0, is_default: true }
];

export const CATEGORY_ICON_CHOICES = [
  '🍔', '🚗', '🛍️', '💡', '🎬', '💊', '📚', '🛒', '⛽', '🏠', '💳', '💰',
  '🎁', '📦', '☕', '✈️', '🏥', '🍿', '📱', '💻', '👕', '🍎', '🎮', '🏋️',
  '📺', '🚌', '🧾', '🏦', '🧺', '💅'
];

export const CATEGORY_COLOR_CHOICES = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#14B8A6', '#3B82F6',
  '#6366F1', '#8B5CF6', '#D946EF', '#EC4899', '#64748B', '#059669',
  '#DC2626', '#6B7280'
];

export function buildDefaultCategories(userId: string): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    id: uid('cat'),
    user_id: userId,
    created_at: new Date().toISOString()
  }));
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateOnly(d);
}

export function buildSampleExpenses(
  userId: string,
  categories: Category[]
): Expense[] {
  const cat = (name: string) => categories.find((c) => c.name === name) ?? categories[0];
  const now = new Date().toISOString();
  const mk = (
    merchant_name: string,
    categoryName: string,
    amount: number,
    dateOffset: number,
    method: Expense['payment_method'],
    description?: string
  ): Expense => ({
    id: uid('exp'),
    user_id: userId,
    category_id: cat(categoryName).id,
    amount,
    merchant_name,
    description,
    source: 'manual',
    payment_method: method,
    date: daysAgo(dateOffset),
    time: `${String(9 + (dateOffset % 10)).padStart(2, '0')}:${String((dateOffset * 7) % 60).padStart(2, '0')}`,
    is_recurring: false,
    tags: [],
    created_at: now
  });

  return [
    mk('Zomato', 'Food & Dining', 245, 0, 'UPI', 'Dinner'),
    mk('Starbucks', 'Food & Dining', 350, 0, 'UPI', 'Coffee'),
    mk('Uber', 'Travel & Transport', 180, 1, 'Wallet', 'Office ride'),
    mk('BigBasket', 'Grocery', 1240, 1, 'Credit Card', 'Weekly groceries'),
    mk('Amazon', 'Shopping', 999, 2, 'Debit Card', 'New headphones'),
    mk('Shell Petrol', 'Fuel', 1200, 2, 'Credit Card'),
    mk('Netflix', 'Entertainment', 649, 3, 'Credit Card', 'Monthly sub'),
    mk('Electricity Bill', 'Bills & Utilities', 1850, 3, 'Net Banking'),
    mk('Apollo Pharmacy', 'Health & Medical', 460, 4, 'Cash', 'Medicine'),
    mk('Swiggy', 'Food & Dining', 520, 4, 'UPI', 'Lunch'),
    mk('Flipkart', 'Shopping', 1499, 5, 'UPI'),
    mk('Metro', 'Travel & Transport', 60, 5, 'Wallet'),
    mk('Blinkit', 'Grocery', 310, 6, 'UPI', 'Snacks'),
    mk('Dominos Pizza', 'Food & Dining', 599, 7, 'UPI'),
    mk('Croma', 'Shopping', 1599, 8, 'Debit Card', 'Mobile cover'),
    mk('Jio Recharge', 'Bills & Utilities', 299, 9, 'UPI'),
    mk('Rent', 'Rent & Housing', 15000, 9, 'Net Banking', 'Monthly rent'),
    mk('Pharmeasy', 'Health & Medical', 380, 11, 'UPI'),
    mk('IRCTC', 'Travel & Transport', 850, 12, 'UPI', 'Train ticket'),
    mk('Myntra', 'Shopping', 899, 13, 'UPI', 'T-shirt'),
    mk('Ola', 'Travel & Transport', 240, 14, 'Wallet'),
    mk('Zepto', 'Grocery', 420, 15, 'UPI'),
    mk('KFC', 'Food & Dining', 799, 16, 'Debit Card'),
    mk('Amazon', 'Shopping', 2599, 17, 'Credit Card', 'Shoes'),
    mk('Spotify', 'Entertainment', 119, 18, 'UPI', 'Premium'),
    mk('Water Bill', 'Bills & Utilities', 620, 19, 'Cash'),
    mk('BigBasket', 'Grocery', 1890, 20, 'Credit Card'),
    mk('Fuel - Indian Oil', 'Fuel', 1500, 21, 'Credit Card'),
    mk('BookMyShow', 'Entertainment', 900, 22, 'UPI', 'Movie'),
    mk('Gym Membership', 'Health & Medical', 1500, 24, 'UPI'),
    mk('EMI - Phone', 'EMI & Loans', 4999, 26, 'Debit Card'),
    mk('Udemy Course', 'Education', 650, 28, 'UPI'),
    mk('Salary Credit', 'Investment', 0, 0, 'Net Banking') // placeholder replaced below
  ].filter((e) => e.amount > 0);
}

export function buildSampleIncome(userId: string): Income[] {
  const now = new Date().toISOString();
  return [
    {
      id: uid('inc'),
      user_id: userId,
      amount: 65000,
      source_name: 'Salary',
      description: 'Monthly salary',
      date: daysAgo(0),
      is_recurring: true,
      recurring_frequency: 'monthly',
      created_at: now
    },
    {
      id: uid('inc'),
      user_id: userId,
      amount: 2500,
      source_name: 'Freelance',
      description: 'Design project',
      date: daysAgo(9),
      is_recurring: false,
      created_at: now
    },
    {
      id: uid('inc'),
      user_id: userId,
      amount: 1200,
      source_name: 'Cashback & Refunds',
      description: 'Amazon refund',
      date: daysAgo(14),
      is_recurring: false,
      created_at: now
    },
    {
      id: uid('inc'),
      user_id: userId,
      amount: 5000,
      source_name: 'Investment',
      description: 'Dividend payout',
      date: daysAgo(20),
      is_recurring: false,
      created_at: now
    }
  ];
}

export function buildSampleBudgets(userId: string, categories: Category[]): Budget[] {
  const now = new Date().toISOString();
  const cat = (name: string) => categories.find((c) => c.name === name) ?? categories[0];
  return [
    { id: uid('bud'), user_id: userId, category_id: cat('Food & Dining').id, amount: 6000, period: 'monthly', created_at: now },
    { id: uid('bud'), user_id: userId, category_id: cat('Grocery').id, amount: 5000, period: 'monthly', created_at: now },
    { id: uid('bud'), user_id: userId, category_id: cat('Travel & Transport').id, amount: 3000, period: 'monthly', created_at: now },
    { id: uid('bud'), user_id: userId, category_id: cat('Entertainment').id, amount: 2000, period: 'monthly', created_at: now },
    { id: uid('bud'), user_id: userId, category_id: cat('Shopping').id, amount: 5000, period: 'monthly', created_at: now },
    { id: uid('bud'), user_id: userId, category_id: cat('Bills & Utilities').id, amount: 3500, period: 'monthly', created_at: now }
  ];
}

export const DEMO_USER_EMAIL = 'demo@smartspend.app';
