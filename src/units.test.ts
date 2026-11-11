import { describe, expect, it, test } from 'vitest'
import { fromDisplayLength, fromDisplayWeight, toDisplayLength, toDisplayWeight } from './units'

describe('weight', () => {
  it('saves 100 lb as 45.36 kg and shows it as 45.4 kg', () => {
    expect(fromDisplayWeight(100, 'lb')).toBe(45.36)
    expect(toDisplayWeight(45.36, 'kg')).toBe(45.4)
    expect(toDisplayWeight(45.36, 'lb')).toBe(100)
  })

  it('keeps kg values, rounded to 2 decimals stored and 1 shown', () => {
    expect(fromDisplayWeight(82.555, 'kg')).toBe(82.56)
    expect(toDisplayWeight(82.56, 'kg')).toBe(82.6)
  })

  it('converts kg to lb for display', () => {
    expect(toDisplayWeight(100, 'lb')).toBe(220.5)
    expect(toDisplayWeight(0, 'lb')).toBe(0)
  })
})

describe('length', () => {
  it('converts inches to cm and back', () => {
    expect(fromDisplayLength(10, 'lb')).toBe(25.4)
    expect(toDisplayLength(25.4, 'lb')).toBe(10)
  })

  it('keeps cm values', () => {
    expect(fromDisplayLength(81.234, 'kg')).toBe(81.23)
    expect(toDisplayLength(81.23, 'kg')).toBe(81.2)
  })
})

test.each(['kg', 'lb'] as const)('round trip in %s is stable to 0.1', (unit) => {
  for (let tenths = 0; tenths <= 10000; tenths += 1) {
    const value = tenths / 10
    expect(toDisplayWeight(fromDisplayWeight(value, unit), unit)).toBe(value)
    expect(toDisplayLength(fromDisplayLength(value, unit), unit)).toBe(value)
  }
})

test('a stored kg value drifts less than 0.1 kg after a round trip through lb', () => {
  for (let hundredths = 0; hundredths <= 100000; hundredths += 1) {
    const kg = hundredths / 100
    const back = fromDisplayWeight(toDisplayWeight(kg, 'lb'), 'lb')
    expect(Math.abs(back - kg)).toBeLessThan(0.1)
  }
})
