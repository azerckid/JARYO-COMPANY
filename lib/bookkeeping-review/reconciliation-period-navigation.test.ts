import { describe, expect, it } from 'vitest'
import {
  convertReconciliationPeriodKey,
  shiftReconciliationPeriodKey,
} from './reconciliation-period-navigation'

describe('reconciliation period navigation', () => {
  it('converts the same point in time across month, quarter, and half-year scopes', () => {
    expect(convertReconciliationPeriodKey('2026-H1', 'month')).toBe('2026-03')
    expect(convertReconciliationPeriodKey('2026-05', 'quarter')).toBe('2026-Q2')
    expect(convertReconciliationPeriodKey('2026-Q4', 'half_year')).toBe('2026-H2')
  })

  it('moves across year boundaries in the active scope', () => {
    expect(shiftReconciliationPeriodKey('2026-01', -1)).toBe('2025-12')
    expect(shiftReconciliationPeriodKey('2026-Q4', 1)).toBe('2027-Q1')
    expect(shiftReconciliationPeriodKey('2026-H1', -1)).toBe('2025-H2')
  })

  it('leaves unsupported keys unchanged', () => {
    expect(convertReconciliationPeriodKey('2026', 'month')).toBe('2026')
    expect(shiftReconciliationPeriodKey('custom', 1)).toBe('custom')
  })
})
