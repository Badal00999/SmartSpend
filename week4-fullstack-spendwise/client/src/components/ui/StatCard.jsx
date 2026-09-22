/**
 * StatCard – headline number on the dashboard (balance, income, expense).
 */

import Icon from './Icon'

const tones = {
  brand: 'bg-brand-600 text-white',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export default function StatCard({ label, value, hint, icon, tone = 'slate', highlight = false }) {
  return (
    <article
      className={`card flex items-center gap-4 p-5 ${
        highlight
          ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white border-transparent dark:border-transparent'
          : ''
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          highlight ? 'bg-white/15 text-white' : tones[tone]
        }`}
      >
        <Icon name={icon} size={22} />
      </div>
      <div className="min-w-0">
        <p className={`text-sm ${highlight ? 'text-brand-100' : 'text-slate-500 dark:text-slate-400'}`}>{label}</p>
        <p className="truncate text-2xl font-bold tracking-tight">{value}</p>
        {hint && (
          <p className={`mt-0.5 text-xs ${highlight ? 'text-brand-100/80' : 'text-slate-400 dark:text-slate-500'}`}>
            {hint}
          </p>
        )}
      </div>
    </article>
  )
}
