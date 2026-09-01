-- ============================================================
-- SmartSpend - Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- users / profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  full_name text,
  monthly_budget numeric default 0,
  weekly_budget numeric default 0,
  daily_budget numeric default 0,
  currency text default 'INR',
  currency_symbol text default '₹',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- categories
-- ------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  icon text default '📦',
  color text default '#6366F1',
  budget_limit numeric default 0,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- expenses
-- ------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  amount numeric not null check (amount > 0),
  merchant_name text default '',
  description text,
  source text default 'manual',
  payment_method text default 'UPI',
  date date not null default current_date,
  time time default now(),
  is_recurring boolean default false,
  recurring_frequency text,
  location text,
  receipt_url text,
  tags text[],
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- income
-- ------------------------------------------------------------
create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  amount numeric not null check (amount > 0),
  source_name text not null,
  description text,
  date date not null default current_date,
  is_recurring boolean default false,
  recurring_frequency text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- budgets
-- ------------------------------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  amount numeric not null,
  period text default 'monthly',
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- sms_rules
-- ------------------------------------------------------------
create table if not exists public.sms_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  keyword text not null,
  category_id uuid references public.categories (id) on delete set null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.income enable row level security;
alter table public.budgets enable row level security;
alter table public.sms_rules enable row level security;

-- users can only read/update their own profile
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- categories
create policy "categories_all" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- expenses
create policy "expenses_all" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- income
create policy "income_all" on public.income
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- budgets
create policy "budgets_all" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- sms_rules
create policy "sms_rules_all" on public.sms_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_expenses_user on public.expenses (user_id);
create index if not exists idx_expenses_date on public.expenses (date);
create index if not exists idx_expenses_category on public.expenses (category_id);
create index if not exists idx_categories_user on public.categories (user_id);
create index if not exists idx_income_user on public.income (user_id);
create index if not exists idx_budgets_user on public.budgets (user_id);

-- Real-time: enable for live dashboard updates
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.income;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.budgets;
