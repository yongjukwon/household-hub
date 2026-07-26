import Svg, { Circle } from 'react-native-svg'
import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/theme/tokens'

export interface DonutSlice {
  key: string
  value: number
  color: string
}

interface DonutChartProps {
  slices: DonutSlice[]
  size?: number
  strokeWidth?: number
  emptyLabel?: string
}

/**
 * A stroke-based donut (react-native-svg `Circle` + `strokeDasharray`), the RN
 * equivalent of the design reference's CSS `conic-gradient` rings and web's
 * Recharts `Pie` (recharts is DOM-only, not usable in React Native).
 */
export function DonutChart({ slices, size = 72, strokeWidth = 12, emptyLabel = 'No data' }: DonutChartProps) {
  const { tokens } = useTheme()
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  if (total <= 0) {
    return (
      <View
        style={[
          styles.empty,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: tokens.cardAlt,
          },
        ]}
      >
        <Text style={[styles.emptyText, { color: tokens.muted }]}>{emptyLabel}</Text>
      </View>
    )
  }

  let offsetSoFar = 0

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((slice) => {
        const fraction = slice.value / total
        const dash = fraction * circumference
        const gap = circumference - dash
        const rotation = (offsetSoFar / total) * 360 - 90
        offsetSoFar += slice.value
        return (
          <Circle
            key={slice.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={slice.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="butt"
            fill="none"
            rotation={rotation}
            originX={size / 2}
            originY={size / 2}
          />
        )
      })}
    </Svg>
  )
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 10, textAlign: 'center' },
})
