import { calendarDotTone } from './activityIndicators'

describe('Calendar activity indicators', () => {
  it('gives unread red dots precedence over ordinary sage event dots', () => {
    expect(calendarDotTone(true, true)).toBe('unread')
    expect(calendarDotTone(true, false)).toBe('ordinary')
    expect(calendarDotTone(false, false)).toBe('none')
  })
})
