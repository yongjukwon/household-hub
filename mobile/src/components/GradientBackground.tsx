import { StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { useTheme } from '@/theme/tokens'

/**
 * Diagonal gradient + two soft radial glows, mounted once per independently-
 * navigated native screen (see the v2 design reference). Renders behind all
 * content — every screen using it must keep its own background transparent.
 */
export function GradientBackground() {
  const { tokens } = useTheme()

  return (
    <>
      <LinearGradient
        colors={tokens.gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="glowPrimary" cx="85%" cy="8%" r="60%">
            <Stop offset="0%" stopColor={tokens.glow.primary} stopOpacity={1} />
            <Stop offset="100%" stopColor={tokens.glow.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glowSecondary" cx="8%" cy="80%" r="55%">
            <Stop offset="0%" stopColor={tokens.glow.secondary} stopOpacity={1} />
            <Stop offset="100%" stopColor={tokens.glow.secondary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="85%" cy="8%" r="35%" fill="url(#glowPrimary)" />
        <Circle cx="8%" cy="80%" r="32%" fill="url(#glowSecondary)" />
      </Svg>
    </>
  )
}
