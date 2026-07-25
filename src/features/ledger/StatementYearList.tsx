import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChartBarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { StatementYearSummary } from './StatementYearSummary'
import type { LedgerYear } from './statements'

export function StatementYearList({
  householdId,
  years,
}: {
  householdId: string
  years: LedgerYear[]
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(yearId: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(yearId)) next.delete(yearId)
      else next.add(yearId)
      return next
    })
  }

  return (
    <ul className="divide-y divide-[var(--hh-line)]">
      {years.map((year) => {
        const isExpanded = expanded.has(year.id)
        return (
          <li key={year.id} className="py-3">
            <div className="flex items-center gap-3 px-2">
              <div className="min-w-0 flex-1">
                <p className="text-xl font-medium text-[var(--hh-ink)]">{year.year}</p>
                <p className="text-sm text-[var(--hh-muted)]">12-month statement</p>
              </div>
              <button
                type="button"
                aria-label={`Toggle ${year.year} summary`}
                aria-expanded={isExpanded}
                onClick={() => toggle(year.id)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--hh-surface-2)] text-[var(--hh-ink)]"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-5 w-5" />
                ) : (
                  <ChartBarIcon className="h-5 w-5" />
                )}
              </button>
              <Link
                to={`/ledger/${year.id}`}
                aria-label={`Open ${year.year} statement`}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--hh-surface-2)] text-[var(--hh-muted)]"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </Link>
            </div>
            {isExpanded && (
              <div className="mt-4">
                <StatementYearSummary householdId={householdId} yearId={year.id} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
