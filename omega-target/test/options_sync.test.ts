import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import OptionsSync from '../src/options_sync'
import Storage from '../src/storage'
import Log from '../src/log'

beforeAll(() => {
  vi.spyOn(Log, 'log').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

function hookPostBasic<T extends (...args: unknown[]) => unknown>(
  func: T,
  hook: (...args: unknown[]) => void
): T {
  return function (this: unknown, ...args: unknown[]) {
    const result = func.apply(this, args)
    hook.apply(this, args)
    return result
  } as T
}

function hookPost(obj: Record<string, unknown>, method: string, hook: (...args: unknown[]) => void): void {
  obj[method] = hookPostBasic(obj[method] as (...args: unknown[]) => unknown, hook)
}

describe('OptionsSync', () => {
  describe('#merge', () => {
    const sync = new OptionsSync()

    it('should choose the one with newer revision', () => {
      const newVal = { revision: '2' }
      const oldVal = { revision: '1' }
      expect(sync.merge('example', newVal, oldVal)).toBe(newVal)
    })

    it('should use oldVal when sync is disabled in newVal', () => {
      const newVal = { revision: '2', is: 'newVal', syncOptions: 'disabled' }
      const oldVal = { revision: '1', is: 'oldVal' }
      expect(sync.merge('example', newVal, oldVal)).toBe(oldVal)
    })

    it('should use oldVal when sync is disabled in oldVal', () => {
      const newVal = { revision: '2', is: 'newVal' }
      const oldVal = { revision: '1', is: 'oldVal', syncOptions: 'disabled' }
      expect(sync.merge('example', newVal, oldVal)).toBe(oldVal)
    })

    it('should favor oldVal when revisions are equal', () => {
      const newVal = { revision: '1', is: 'newVal' }
      const oldVal = { revision: '1', is: 'oldVal' }
      expect(sync.merge('example', newVal, oldVal)).toBe(oldVal)
    })

    it('should favor oldVal when newVal deeply equals oldVal', () => {
      const newVal = { they: 'are', the: 'same' }
      const oldVal = { they: 'are', the: 'same' }
      expect(sync.merge('example', newVal, oldVal)).toBe(oldVal)
    })

    it('should choose newVal when newVal is different', () => {
      const newVal = { they: 'are', not: 'equal' }
      const oldVal = { they: 'are', not: 'identical' }
      expect(sync.merge('example', newVal, oldVal)).toBe(newVal)
    })
  })

  describe('#requestPush', () => {
    const unlimited = new OptionsSync.TokenBucket()

    it('should store pendingChanges', () => {
      const sync = new OptionsSync()
      sync.enabled = false
      sync.requestPush({ a: 1 })
      expect(sync.pendingChanges()).toEqual({ a: 1 })
    })

    it('should schedule storage write', () =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (
            (storage.set as ReturnType<typeof vi.fn>).mock.calls.length === 0 ||
            (storage.remove as ReturnType<typeof vi.fn>).mock.calls.length === 0
          )
            return
          expect(storage.set).toHaveBeenCalledOnce()
          expect(storage.set).toHaveBeenCalledWith({ b: 1 })
          expect(storage.remove).toHaveBeenCalledOnce()
          expect(storage.remove).toHaveBeenCalledWith(['a'])
          resolve()
        }

        const storage = new Storage()
        storage.set({ a: 1 })
        hookPost(storage as unknown as Record<string, unknown>, 'set', check)
        hookPost(storage as unknown as Record<string, unknown>, 'remove', check)

        vi.spyOn(storage, 'set')
        vi.spyOn(storage, 'remove')

        const sync = new OptionsSync(storage, unlimited as unknown as Storage)
        sync.debounce = 0
        sync.requestPush({ a: undefined, b: 1 })
      }))

    it('should combine multiple write operations', () =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (
            (storage.set as ReturnType<typeof vi.fn>).mock.calls.length === 0 ||
            (storage.remove as ReturnType<typeof vi.fn>).mock.calls.length === 0
          )
            return
          expect(storage.set).toHaveBeenCalledOnce()
          expect(storage.set).toHaveBeenCalledWith({ c: 1, d: 1 })
          expect(storage.remove).toHaveBeenCalledOnce()
          expect(storage.remove).toHaveBeenCalledWith(['a', 'b'])
          resolve()
        }

        const storage = new Storage()
        storage.set({ a: 1, b: 1 })
        hookPost(storage as unknown as Record<string, unknown>, 'set', check)
        hookPost(storage as unknown as Record<string, unknown>, 'remove', check)

        vi.spyOn(storage, 'set')
        vi.spyOn(storage, 'remove')

        const sync = new OptionsSync(storage, unlimited as unknown as Storage)
        sync.debounce = 0
        sync.requestPush({ a: undefined })
        sync.requestPush({ b: 2 })
        sync.requestPush({ b: undefined })
        sync.requestPush({ c: 1 })
        sync.requestPush({ d: 1 })
        sync.requestPush({ e: 1 })
        sync.requestPush({ e: undefined })
      }))

    it('should disable syncing for the profiles if quota is exceeded', () =>
      new Promise<void>((resolve) => {
        const options: Record<string, unknown> = {
          '+a': { is: 'a', oversized: true },
          b: { is: 'b' },
        }

        const storage = new Storage()
        const originalSet = storage.set.bind(storage)
        let setSpy: ReturnType<typeof vi.fn>
        storage.set = (items) => {
          for (const value of Object.values(items)) {
            if ((value as Record<string, unknown>)?.['oversized']) {
              const err = new Storage.QuotaExceededError()
              err.perItem = true
              return Promise.reject(err)
            }
          }
          // second call should succeed
          expect(setSpy.mock.calls.length).toBe(2)
          expect(setSpy).toHaveBeenCalledWith(options)
          expect(setSpy).toHaveBeenCalledWith({ b: { is: 'b' } })
          expect((options['+a'] as Record<string, unknown>)['syncOptions']).toBe(
            'disabled'
          )
          expect(
            (
              (options['+a'] as Record<string, unknown>)['syncError'] as Record<
                string,
                unknown
              >
            )['reason']
          ).toBe('quotaPerItem')
          resolve()
          return originalSet(items)
        }
        setSpy = vi.fn(storage.set.bind(storage))
        storage.set = setSpy

        const sync = new OptionsSync(storage, unlimited as unknown as Storage)
        sync.debounce = 0
        sync.requestPush(options)
      }))
  })

  describe('#copyTo', () => {
    it('should fetch all items from remote storage', () =>
      new Promise<void>((resolve) => {
        const remote = new Storage()
        remote.set({ a: 1, b: 2, c: 3 })

        const storage = new Storage()
        hookPost(storage as unknown as Record<string, unknown>, 'set', () => {
          expect(storage.set).toHaveBeenCalledOnce()
          expect(storage.set).toHaveBeenCalledWith({ a: 1, b: 2, c: 3 })
          resolve()
        })

        vi.spyOn(storage, 'set')

        const sync = new OptionsSync(remote)
        sync.copyTo(storage)
      }))

    it('should merge with local as base', () =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (
            (storage.set as ReturnType<typeof vi.fn>).mock.calls.length === 0 ||
            (storage.remove as ReturnType<typeof vi.fn>).mock.calls.length === 0
          )
            return
          expect(storage.set).toHaveBeenCalledOnce()
          expect(storage.set).toHaveBeenCalledWith({ b: 2, c: 3 })
          expect(storage.remove).toHaveBeenCalledOnce()
          expect(storage.remove).toHaveBeenCalledWith(['d'])
          resolve()
        }

        const remote = new Storage()
        remote.set({ a: 1, b: 2, c: 3, d: undefined })

        const storage = new Storage()
        storage.set({ a: 1, b: 0, d: 4 })

        hookPost(storage as unknown as Record<string, unknown>, 'set', check)
        hookPost(storage as unknown as Record<string, unknown>, 'remove', check)

        vi.spyOn(storage, 'set')
        vi.spyOn(storage, 'remove')

        const sync = new OptionsSync(remote)
        sync.copyTo(storage)
      }))
  })

  describe('#watchAndPull', () => {
    it('should pull changes into local when remote changes', () =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (
            (storage.set as ReturnType<typeof vi.fn>).mock.calls.length === 0 ||
            (storage.remove as ReturnType<typeof vi.fn>).mock.calls.length === 0
          )
            return
          expect(remote.watch).toHaveBeenCalledOnce()
          expect(storage.set).toHaveBeenCalledOnce()
          expect(storage.set).toHaveBeenCalledWith({ b: 2, c: 3 })
          expect(storage.remove).toHaveBeenCalledOnce()
          expect(storage.remove).toHaveBeenCalledWith(['d'])
          resolve()
        }

        const remote = new Storage()
        const originalWatch = remote.watch.bind(remote)
        remote.watch = (keys, callback) => {
          setTimeout(() => {
            callback({ a: 1 })
            callback({ b: 2 })
            callback({ c: 3 })
            callback({ d: undefined })
          }, 10)
          return originalWatch(keys, callback)
        }
        vi.spyOn(remote, 'watch')

        const storage = new Storage()
        storage.set({ a: 1, b: 0, d: 4 })

        hookPost(storage as unknown as Record<string, unknown>, 'set', check)
        hookPost(storage as unknown as Record<string, unknown>, 'remove', check)

        vi.spyOn(storage, 'set')
        vi.spyOn(storage, 'remove')

        const sync = new OptionsSync(remote)
        sync.pullThrottle = 0
        sync.watchAndPull(storage)
      }))
  })
})
