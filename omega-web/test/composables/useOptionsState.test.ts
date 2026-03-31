import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to mock useOmegaTarget since useOptionsState depends on it
vi.mock('@/composables/useOmegaTarget', () => {
  const mockTarget = {
    options: null as any,
    state: vi.fn(() => Promise.resolve(null)),
    getMessage: vi.fn((key: string) => key),
    addOptionsChangeCallback: vi.fn(),
    refresh: vi.fn(() => Promise.resolve()),
    renameProfile: vi.fn(),
    replaceRef: vi.fn(),
    optionsPatch: vi.fn(() => Promise.resolve()),
    resetOptions: vi.fn(() => Promise.resolve()),
    updateProfile: vi.fn(),
    lastUrl: vi.fn(),
    openOptions: vi.fn(),
    applyProfile: vi.fn(),
    applyProfileNoReply: vi.fn(),
    addTempRule: vi.fn(),
    addCondition: vi.fn(),
    addProfile: vi.fn(),
    setDefaultProfile: vi.fn(),
    getActivePageInfo: vi.fn(),
    refreshActivePage: vi.fn(),
    openManage: vi.fn(),
    openShortcutConfig: vi.fn(),
    setOptionsSync: vi.fn(),
    resetOptionsSync: vi.fn(),
    checkOptionsSyncChange: vi.fn(),
    setRequestInfoCallback: vi.fn(),
  }
  return {
    useOmegaTarget: () => mockTarget,
    __mockTarget: mockTarget,
  }
})

import { useOptionsState, type AlertState } from '@/composables/useOptionsState'
import { useOmegaTarget } from '@/composables/useOmegaTarget'

describe('useOptionsState', () => {
  let mockTarget: ReturnType<typeof useOmegaTarget>

  beforeEach(() => {
    vi.useFakeTimers()
    mockTarget = useOmegaTarget()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('state object', () => {
    it('exposes reactive state with expected initial shape', () => {
      const { state } = useOptionsState()
      expect(state).toHaveProperty('options')
      expect(state).toHaveProperty('optionsDirty')
      expect(state).toHaveProperty('isExperimental')
      expect(state).toHaveProperty('customCss')
      expect(state).toHaveProperty('syncOptions')
      expect(state).toHaveProperty('updatingProfile')
      expect(state).toHaveProperty('alertShown')
      expect(state).toHaveProperty('alert')
      expect(state).toHaveProperty('pacProfilesUnsupported')
    })
  })

  describe('showAlert / hideAlert', () => {
    it('sets alert and alertShown', () => {
      const { state, showAlert } = useOptionsState()
      const alert: AlertState = { type: 'success', message: 'Saved!' }
      showAlert(alert)
      expect(state.alertShown).toBe(true)
      expect(state.alert).toEqual(alert)
      expect(state.alertShownAt).toBeGreaterThan(0)
    })

    it('auto-hides alert after 3 seconds if shown for at least 1 second', () => {
      const { state, showAlert } = useOptionsState()
      showAlert({ type: 'success', message: 'test' })
      expect(state.alertShown).toBe(true)

      // Advance past the 3s timeout
      vi.advanceTimersByTime(3100)
      expect(state.alertShown).toBe(false)
    })

    it('does not hide if less than 1 second has passed', () => {
      const { state, showAlert, hideAlert } = useOptionsState()
      showAlert({ type: 'success', message: 'test' })
      // Call hideAlert immediately (less than 1s)
      hideAlert()
      expect(state.alertShown).toBe(true)
    })
  })

  describe('sortedProfiles', () => {
    it('returns empty array when options is null', () => {
      const { sortedProfiles } = useOptionsState()
      expect(sortedProfiles.value).toEqual([])
    })
  })

  describe('onFirstRun', () => {
    it('registers a callback', () => {
      const { onFirstRun } = useOptionsState()
      const cb = vi.fn()
      // Should not throw
      onFirstRun(cb)
    })
  })
})
