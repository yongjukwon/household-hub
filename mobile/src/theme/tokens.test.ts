import { darkTokens, lightTokens } from './tokens'

describe('theme surface hierarchy', () => {
  it('uses the approved light-mode tonal surfaces', () => {
    expect(lightTokens).toMatchObject({
      canvas: '#FFFFFF',
      card: '#F6F7F9',
      cardAlt: '#EFF0F2',
      ink: '#14151A',
      line: 'rgba(20, 21, 26, 0.08)',
      accent: '#FF7A45',
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
      accent: '#FF7A45',
    })

    expect(
      new Set([darkTokens.canvas, darkTokens.card, darkTokens.cardAlt]).size,
    ).toBe(3)
  })
})
