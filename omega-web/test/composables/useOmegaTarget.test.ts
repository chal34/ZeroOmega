import { describe, it, expect, vi, beforeEach } from 'vitest'

// Reset module state between tests since useOmegaTarget is a singleton
let useOmegaTarget: typeof import('@/composables/useOmegaTarget').useOmegaTarget

beforeEach(async () => {
  vi.resetModules()
  // Reset chrome mocks
  vi.mocked(chrome.runtime.sendMessage).mockReset()
  vi.mocked(chrome.runtime.lastError, { partial: true })
  ;(chrome.runtime as any).lastError = null

  const mod = await import('@/composables/useOmegaTarget')
  useOmegaTarget = mod.useOmegaTarget
})

describe('useOmegaTarget', () => {
  describe('singleton', () => {
    it('returns the same instance on multiple calls', () => {
      const a = useOmegaTarget()
      const b = useOmegaTarget()
      expect(a).toBe(b)
    })
  })

  describe('getMessage', () => {
    it('delegates to chrome.i18n.getMessage', () => {
      const target = useOmegaTarget()
      target.getMessage('test_key')
      expect(chrome.i18n.getMessage).toHaveBeenCalledWith('test_key')
    })
  })

  describe('state (get single)', () => {
    it('sends getState message and resolves single value', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: any, cb?: any) => {
          if (cb) cb({ result: { myKey: 'myValue' } })
        },
      )
      const target = useOmegaTarget()
      const result = await target.state('myKey')
      expect(result).toBe('myValue')
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { method: 'getState', args: [['myKey']] },
        expect.any(Function),
      )
    })
  })

  describe('state (get array)', () => {
    it('sends getState with array and maps results', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: any, cb?: any) => {
          if (cb) cb({ result: { a: 1, b: 2 } })
        },
      )
      const target = useOmegaTarget()
      const result = await target.state(['a', 'b'])
      expect(result).toEqual([1, 2])
    })
  })

  describe('state (set)', () => {
    it('sends setState message and resolves to the value', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: any, cb?: any) => {
          if (cb) cb({ result: null })
        },
      )
      const target = useOmegaTarget()
      const result = await target.state('myKey', 42)
      expect(result).toBe(42)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { method: 'setState', args: [{ myKey: 42 }] },
        expect.any(Function),
      )
    })
  })

  describe('applyProfile', () => {
    it('sends applyProfile message', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: any, cb?: any) => {
          if (cb) cb({ result: 'ok' })
        },
      )
      const target = useOmegaTarget()
      const result = await target.applyProfile('myProxy')
      expect(result).toBe('ok')
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { method: 'applyProfile', args: ['myProxy'] },
        expect.any(Function),
      )
    })
  })

  describe('applyProfileNoReply', () => {
    it('sends applyProfile with noReply flag', () => {
      const target = useOmegaTarget()
      target.applyProfileNoReply('myProxy')
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        method: 'applyProfile',
        args: ['myProxy'],
        noReply: true,
      })
    })
  })

  describe('addOptionsChangeCallback + refresh', () => {
    it('invokes registered callbacks on refresh', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: any, cb?: any) => {
          if (cb) cb({ result: { '+test': { name: 'test' } } })
        },
      )
      const target = useOmegaTarget()
      const callback = vi.fn()
      target.addOptionsChangeCallback(callback)
      await target.refresh()
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ '+test': { name: 'test' } }),
      )
    })

    it('passes through args from refresh', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: any, cb?: any) => {
          if (cb) cb({ result: {} })
        },
      )
      const target = useOmegaTarget()
      const result = await target.refresh('passthrough')
      expect(result).toBe('passthrough')
    })
  })

  describe('error handling', () => {
    it('rejects when response has error', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: any, cb?: any) => {
          if (cb) cb({ error: { _error: 'error', name: 'TestError', message: 'fail' } })
        },
      )
      const target = useOmegaTarget()
      await expect(target.applyProfile('test')).rejects.toThrow('fail')
    })

    it('rejects when chrome.runtime.lastError is set', async () => {
      ;(chrome.runtime as any).lastError = { message: 'extension error' }
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: any, cb?: any) => {
          if (cb) cb({ result: null })
        },
      )
      const target = useOmegaTarget()
      await expect(target.applyProfile('test')).rejects.toEqual({
        message: 'extension error',
      })
    })
  })

  describe('lastUrl', () => {
    it('stores and retrieves url from localStorage', () => {
      const target = useOmegaTarget()
      target.lastUrl('https://example.com')
      expect(localStorage['omega.local.web.last_url']).toBe('https://example.com')
    })

    it('returns undefined when no url stored', () => {
      delete localStorage['omega.local.web.last_url']
      const target = useOmegaTarget()
      expect(target.lastUrl()).toBeUndefined()
    })

    it('returns the url passed in as setter', () => {
      const target = useOmegaTarget()
      expect(target.lastUrl('https://test.com')).toBe('https://test.com')
    })
  })

  describe('addTempRule', () => {
    it('sends addTempRule message with correct args', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (_msg: any, cb?: any) => {
          if (cb) cb({ result: 'ok' })
        },
      )
      const target = useOmegaTarget()
      await target.addTempRule('example.com', 'myProxy', true)
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { method: 'addTempRule', args: ['example.com', 'myProxy', true] },
        expect.any(Function),
      )
    })
  })

  describe('renameProfile', () => {
    it('calls renameProfile then refreshes', async () => {
      let callCount = 0
      vi.mocked(chrome.runtime.sendMessage).mockImplementation(
        (msg: any, cb?: any) => {
          callCount++
          if (cb) cb({ result: {} })
        },
      )
      const target = useOmegaTarget()
      await target.renameProfile('old', 'new')
      // Should have called sendMessage at least twice: renameProfile + getAll (refresh)
      expect(callCount).toBeGreaterThanOrEqual(2)
    })
  })
})
