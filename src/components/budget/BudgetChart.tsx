import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { centsToAmount } from '@/hooks/useBudget'

export interface BudgetChartDatum {
  name: string
  spentCents: number
  limitCents: number
}

interface BudgetChartProps {
  data: BudgetChartDatum[]
  formatCurrency: (amount: number) => string
}

export function BudgetChart({ data, formatCurrency }: BudgetChartProps) {
  if (data.length === 0) return null

  const chartData = data.map((item) => ({
    name: item.name,
    Spent: centsToAmount(item.spentCents),
    Limit: centsToAmount(item.limitCents),
  }))

  return (
    <section className="mt-6" aria-labelledby="budget-chart-title">
      <h2
        id="budget-chart-title"
        className="mb-3 text-xs font-semibold tracking-wide text-[var(--meta)]"
      >
        SPENDING BY CATEGORY
      </h2>
      <div
        className="h-44 rounded-xl border border-[var(--line2)] bg-[var(--panel)] px-2 py-4"
        role="img"
        aria-label="Bar chart comparing spending and monthly limits by category"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid stroke="var(--line2)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value: number) => formatCurrency(value)}
              tick={{ fill: 'var(--meta)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={64}
              tick={{ fill: 'var(--text)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Limit" fill="var(--barbg)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="Spent" fill="var(--accent)" radius={[0, 0, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only">
        {data.map((item) => (
          <li key={item.name}>
            {item.name}: {formatCurrency(centsToAmount(item.spentCents))} spent
            of {formatCurrency(centsToAmount(item.limitCents))}
          </li>
        ))}
      </ul>
    </section>
  )
}
