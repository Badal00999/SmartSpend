/**
 * CategoryDonut – spending split by category.
 * The chart is decorative for screen readers; the legend list beside it
 * carries the same data as real text, so nothing is lost without vision.
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { getCategory } from '../../utils/categories'
import { formatCurrency } from '../../utils/format'
import { percentOf } from '../../utils/stats'

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value, percent } = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-800">
      <p className="font-semibold">{name}</p>
      <p>
        {formatCurrency(value)} · {percent}%
      </p>
    </div>
  )
}

export default function CategoryDonut({ data, total }) {
  const chartData = data.map(({ category, total: value }) => {
    const cat = getCategory(category)
    return { name: cat.label, value, color: cat.color, percent: percentOf(value, total) }
  })

  if (!chartData.length) {
    return <p className="py-10 text-center text-sm text-slate-500">No expenses to chart yet.</p>
  }

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[200px_1fr]">
      <div className="relative mx-auto h-48 w-48" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              stroke="none"
              isAnimationActive
            >
              {chartData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Spent</span>
          <span className="text-base font-bold">{formatCurrency(total, 'INR', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      <ul className="space-y-2 text-sm" aria-label="Spending by category">
        {chartData.slice(0, 6).map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">{d.name}</span>
            <span className="text-slate-500 tabular-nums dark:text-slate-400">{d.percent}%</span>
            <span className="w-24 text-right font-medium tabular-nums">
              {formatCurrency(d.value, 'INR', { maximumFractionDigits: 0 })}
            </span>
          </li>
        ))}
        {chartData.length > 6 && <li className="text-xs text-slate-400">+{chartData.length - 6} more categories</li>}
      </ul>
    </div>
  )
}
