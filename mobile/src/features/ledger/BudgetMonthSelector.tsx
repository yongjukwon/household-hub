import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Card } from '@/components/Card'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { useTheme } from '@/theme/tokens'

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const BUDGET_MONTH_NAVIGATOR_HEIGHT = 48

interface BudgetMonthSelectorProps {
  month: number
  onChange: (month: number) => void
}

/** Compact month navigation that expands to the reference 12-month grid on demand. */
export function BudgetMonthSelector({
  month,
  onChange,
}: BudgetMonthSelectorProps) {
  const { tokens } = useTheme()
  const [expanded, setExpanded] = useState(false)

  function choose(next: number) {
    onChange(next)
    setExpanded(false)
  }

  return (
    <View>
      <Card style={styles.navigator}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: month === 1 }}
          disabled={month === 1}
          onPress={() => onChange(month - 1)}
          style={[styles.arrowButton, month === 1 && styles.disabled]}
        >
          <ChevronLeftIcon size={18} color={tokens.muted} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose month, ${LONG_MONTHS[month - 1]} selected`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={styles.monthLabelButton}
        >
          <Text style={[styles.monthLabel, { color: tokens.ink }]}>
            {LONG_MONTHS[month - 1]}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: month === 12 }}
          disabled={month === 12}
          onPress={() => onChange(month + 1)}
          style={[styles.arrowButton, month === 12 && styles.disabled]}
        >
          <ChevronRightIcon size={18} color={tokens.muted} />
        </Pressable>
      </Card>

      {expanded ? (
        <Card style={styles.grid}>
          {SHORT_MONTHS.map((label, index) => {
            const value = index + 1
            const active = value === month
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${LONG_MONTHS[index]}`}
                accessibilityState={{ selected: active }}
                onPress={() => choose(value)}
                style={[
                  styles.monthCell,
                  {
                    backgroundColor: active ? tokens.ink : tokens.control,
                    borderRadius: tokens.radiusControl,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.monthCellText,
                    { color: active ? tokens.canvas : tokens.ink },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </Card>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  navigator: {
    minHeight: BUDGET_MONTH_NAVIGATOR_HEIGHT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabelButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: { fontSize: 16, fontWeight: '800' },
  grid: {
    marginTop: 10,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthCell: {
    width: '23%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  monthCellText: { fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.35 },
})
