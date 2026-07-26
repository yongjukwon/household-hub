import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { formatMoney } from '@household-hub/domain'

import { HOUSEHOLD_CURRENCY } from './assets'
import {
  spendingCategoryTotals,
  statementTotals,
  type LedgerYearData,
} from './statements'

const COLORS = ['#5B73EA', '#FF7A45', '#D99500', '#2CA58D', '#8B5CF6', '#EC4899']

export function StatementCharts({
  data,
  monthId,
}: {
  data: LedgerYearData
  monthId?: string
}) {
  const totals = statementTotals(data, monthId)
  const categories = spendingCategoryTotals(data, monthId)

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--hh-radius-card)] bg-[var(--hh-surface)] p-4 shadow-[var(--hh-shadow-card)]">
        <h3 className="text-sm font-semibold text-[var(--hh-muted)]">
          {monthId ? 'Monthly statement' : 'Statement summary'}
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Metric label="Income" value={totals.incomeCents} />
          <Metric label="Spending" value={totals.spendingCents} />
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div className="h-32 w-32 shrink-0" aria-label="Spending category chart">
            {categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="totalCents"
                    nameKey="name"
                    innerRadius={34}
                    outerRadius={55}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {categories.map((category, index) => (
                      <Cell
                        key={category.categoryId}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      formatMoney(Number(value), HOUSEHOLD_CURRENCY)
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-full border-[16px] border-[var(--hh-surface-2)] text-xs text-[var(--hh-muted)]">
                No spending
              </div>
            )}
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {categories.map((category, index) => (
              <li
                key={category.categoryId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2 text-[var(--hh-muted)]">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate">{category.name}</span>
                </span>
                <span className="font-semibold tabular-nums text-[var(--hh-ink)]">
                  {formatMoney(category.totalCents, HOUSEHOLD_CURRENCY)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-bold tabular-nums text-[var(--hh-ink)]">
        {formatMoney(value, HOUSEHOLD_CURRENCY)}
      </p>
      <p className="text-sm text-[var(--hh-muted)]">{label}</p>
    </div>
  )
}
