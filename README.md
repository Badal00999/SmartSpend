# SmartSpend 💸 — Automatic Expense Tracker

A production-ready, fully functional expense tracker built with React + TypeScript, Tailwind CSS, shadcn/ui, Zustand, Recharts, and Supabase.

## Features

- **SMS Parsing** — paste any bank SMS, SmartSpend extracts amount, merchant, date & account automatically (regex-based, 7+ formats)
- **Voice Input** — speak "I spent 200 on coffee at Starbucks" using the Web Speech API
- **Smart Auto-Categorization** — 200+ merchant keyword mapping
- **Dashboard** — summary cards, spending charts, category donut, budget progress, recent transactions
- **Analytics & AI Insights** — month comparison, category trends, payment distribution, day-wise patterns, savings potential
- **Budgets** — monthly + category budgets with real-time color-coded alerts (50/80/100%)
- **Recurring Expenses** — EMIs & subscriptions tracking
- **Split Expenses** — split bills and track who paid
- **Reports** — monthly PDF-style reports with export/print/email
- **Streaks & Gamification** — stay under budget to build a streak 🔥
- **Quick Templates** — one-tap re-add frequent expenses
- **PWA + Offline** — installable, works offline, syncs when online
- **Multi-currency** — INR / USD / EUR / GBP
- **Full dark mode**, pull-to-refresh, skeleton loaders, undo-delete, confetti 🎉

## Quick Start (Demo Mode — no backend needed)

The app ships with a **demo mode** that works entirely in the browser (localStorage) with pre-loaded sample data, so you can explore every feature immediately:

```bash
npm install
npm run dev
```

Then in the browser:
- **Sign up** → create any account → set budget/categories/currency in onboarding
- or **Sign in** → use the "Try demo account" button for pre-seeded data

## Connecting Supabase (production)

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run everything in `supabase/schema.sql`
3. Copy your project URL & anon key from **Project Settings → API**
4. Rename `.env.example` to `.env` and fill it in:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. (Optional) Enable **Google OAuth** under Authentication → Providers
6. Restart the dev server. The app now uses Supabase auth + database + real-time automatically.

> When `.env` is empty, the app runs in demo mode. Add the env vars to switch to Supabase.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Type-check + production build (PWA-ready) |
| `npm run preview` | Preview the production build |
| `npm run lint` | Type-check only |

## Tech Stack

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Zustand · Recharts · Supabase · Framer Motion · React Router v6 · date-fns · Lucide · React Hot Toast · Vite PWA

## Project Structure

```
src/
├── pages/            # All 15 pages (Dashboard, History, SmsParser, VoiceInput, Analytics, ...)
├── components/       # shadcn/ui primitives + layout + shared components
├── lib/              # store, smsParser, voiceParser, merchantMap, analytics, seed, format
└── main.tsx / App.tsx
```
