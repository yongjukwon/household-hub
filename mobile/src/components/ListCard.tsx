import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { useTheme } from '@/theme/tokens'
import { Card } from './Card'

interface ListCardProps {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/** Tappable collection-row surface matching the Ledger segmented track. */
export function ListCard({ children, style }: ListCardProps) {
  const { tokens } = useTheme()
  const radiusStyle = { borderRadius: tokens.radiusControl }

  return (
    <Card variant="row" style={style ? [radiusStyle, style] : radiusStyle}>
      {children}
    </Card>
  )
}
