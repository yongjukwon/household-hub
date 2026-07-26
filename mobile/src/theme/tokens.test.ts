import { darkTokens, lightTokens } from './tokens'

describe('theme surface hierarchy', () => {
  it('uses the approved light-mode tonal surfaces', () => {
    expect(lightTokens).toMatchObject({
      canvas: '#FFFFFF',
      card: '#F6F7F9',
      cardAlt: '#EFF0F2',
      ink: '#14151A',
      line: 'rgba(20, 21, 26, 0.08)',
      accent: '#6F9483',
      accentSecondary: '#8FA89F',
    })

    expect(
      new Set([lightTokens.canvas, lightTokens.card, lightTokens.cardAlt]).size,
    ).toBe(3)
  })

  it('uses the approved dark-mode tonal surfaces', () => {
    expect(darkTokens).toMatchObject({
      canvas: '#0F1014',
      card: '#191B22',
      cardAlt: '#242731',
      ink: '#F4F5F8',
      line: 'rgba(255, 255, 255, 0.09)',
      accent: '#6F9483',
      accentSecondary: '#8FA89F',
    })

    expect(
      new Set([darkTokens.canvas, darkTokens.card, darkTokens.cardAlt]).size,
    ).toBe(3)
  })
})

describe('v2 glassmorphism tokens', () => {
  it('defines distinct glass and row surface treatments per mode', () => {
    expect(lightTokens.glass).toEqual({
      fill: 'rgba(255, 255, 255, 0.65)',
      border: 'rgba(255, 255, 255, 0.75)',
    })
    expect(lightTokens.row).toEqual({
      fill: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.8)',
    })
    expect(darkTokens.glass).toEqual({
      fill: 'rgba(255, 255, 255, 0.08)',
      border: 'rgba(255, 255, 255, 0.12)',
    })
    expect(darkTokens.row).toEqual({
      fill: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(255, 255, 255, 0.1)',
    })
  })

  it('defines the diagonal gradient and glow colors for both modes', () => {
    expect(lightTokens.gradientColors).toEqual(['#eef2ef', '#f7f2ea', '#eef1f5'])
    expect(lightTokens.glow).toEqual({
      primary: 'rgba(143, 168, 159, 0.22)',
      secondary: 'rgba(255, 157, 102, 0.15)',
    })
    expect(darkTokens.glow).toEqual({
      primary: 'rgba(143, 168, 159, 0.14)',
      secondary: 'rgba(255, 157, 102, 0.1)',
    })
  })

  it('defines a sage FAB gradient in both modes', () => {
    expect(lightTokens.accentGradient).toEqual(['#6F9483', '#8FA89F'])
    expect(darkTokens.accentGradient).toEqual(['#6F9483', '#8FA89F'])
  })
})
