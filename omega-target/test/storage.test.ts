import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Storage from '../src/storage'
import type { StorageItems } from '../src/storage'
import Log from '../src/log'

beforeAll(() => {
  vi.spyOn(Log, 'log').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('Storage', () => {
  describe('#get', () => {
    it('should return empty object when no items stored', async () => {
      const storage = new Storage()
      expect(await storage.get()).toEqual({})
    })

    it('should return all items when called with null', async () => {
      const storage = new Storage()
      await storage.set({ a: 1, b: 2 })
      expect(await storage.get(null)).toEqual({ a: 1, b: 2 })
    })

    it('should return a copy, not a reference', async () => {
      const storage = new Storage()
      await storage.set({ x: 10 })
      const result = await storage.get(null)
      result['y'] = 20
      expect(await storage.get(null)).toEqual({ x: 10 })
    })

    it('should get a single key when passed a string', async () => {
      const storage = new Storage()
      await storage.set({ a: 1, b: 2 })
      expect(await storage.get('a')).toEqual({ a: 1 })
    })

    it('should return undefined for missing string key', async () => {
      const storage = new Storage()
      await storage.set({ a: 1 })
      const result = await storage.get('missing')
      expect(result).toEqual({ missing: undefined })
    })

    it('should get multiple keys when passed an array', async () => {
      const storage = new Storage()
      await storage.set({ a: 1, b: 2, c: 3 })
      expect(await storage.get(['a', 'c'])).toEqual({ a: 1, c: 3 })
    })

    it('should use defaults from object keys', async () => {
      const storage = new Storage()
      await storage.set({ a: 1 })
      const result = await storage.get({ a: 99, b: 42 })
      expect(result).toEqual({ a: 1, b: 42 })
    })

    it('should return empty when storage has no items and object keys used', async () => {
      const storage = new Storage()
      // When _items is undefined, get returns {}
      const result = await storage.get({ x: 'default' })
      expect(result).toEqual({})
    })

    it('should return defaults from object keys when items exist but key is missing', async () => {
      const storage = new Storage()
      await storage.set({ other: 'val' })
      const result = await storage.get({ x: 'default' })
      expect(result).toEqual({ x: 'default' })
    })
  })

  describe('#set', () => {
    it('should store and retrieve items', async () => {
      const storage = new Storage()
      await storage.set({ key: 'value' })
      expect(await storage.get('key')).toEqual({ key: 'value' })
    })

    it('should merge with existing items', async () => {
      const storage = new Storage()
      await storage.set({ a: 1 })
      await storage.set({ b: 2 })
      expect(await storage.get(null)).toEqual({ a: 1, b: 2 })
    })

    it('should overwrite existing keys', async () => {
      const storage = new Storage()
      await storage.set({ a: 1 })
      await storage.set({ a: 2 })
      expect(await storage.get('a')).toEqual({ a: 2 })
    })

    it('should return the items that were set', async () => {
      const storage = new Storage()
      const result = await storage.set({ x: 42 })
      expect(result).toEqual({ x: 42 })
    })
  })

  describe('#remove', () => {
    it('should remove a single key when passed a string', async () => {
      const storage = new Storage()
      await storage.set({ a: 1, b: 2 })
      await storage.remove('a')
      expect(await storage.get(null)).toEqual({ b: 2 })
    })

    it('should remove multiple keys when passed an array', async () => {
      const storage = new Storage()
      await storage.set({ a: 1, b: 2, c: 3 })
      await storage.remove(['a', 'c'])
      expect(await storage.get(null)).toEqual({ b: 2 })
    })

    it('should clear all items when called with null', async () => {
      const storage = new Storage()
      await storage.set({ a: 1, b: 2 })
      await storage.remove(null)
      expect(await storage.get(null)).toEqual({})
    })

    it('should be a no-op when storage is empty', async () => {
      const storage = new Storage()
      await storage.remove('a')
      expect(await storage.get()).toEqual({})
    })

    it('should handle removing non-existent keys gracefully', async () => {
      const storage = new Storage()
      await storage.set({ a: 1 })
      await storage.remove('nonexistent')
      expect(await storage.get(null)).toEqual({ a: 1 })
    })
  })

  describe('#watch', () => {
    it('should return a cleanup function', () => {
      const storage = new Storage()
      const stop = storage.watch(null, () => {})
      expect(typeof stop).toBe('function')
      stop()
    })
  })

  describe('#apply', () => {
    it('should apply set and remove operations', async () => {
      const storage = new Storage()
      await storage.set({ a: 1, b: 2, c: 3 })
      await storage.apply({ set: { d: 4 }, remove: ['a', 'b'] })
      expect(await storage.get(null)).toEqual({ c: 3, d: 4 })
    })

    it('should accept changes-based operations', async () => {
      const storage = new Storage()
      await storage.set({ a: 1, b: 2 })
      const ops = await storage.apply({
        changes: { a: undefined, c: 3 },
        base: { a: 1 },
      })
      expect(ops.set).toEqual({ c: 3 })
      expect(ops.remove).toEqual(['a'])
    })

    it('should return the operations that were applied', async () => {
      const storage = new Storage()
      const ops = await storage.apply({ set: { x: 1 }, remove: [] })
      expect(ops).toEqual({ set: { x: 1 }, remove: [] })
    })
  })

  describe('.operationsForChanges', () => {
    it('should separate set and remove operations', () => {
      const ops = Storage.operationsForChanges({
        a: 1,
        b: undefined,
        c: 'hello',
      })
      expect(ops.set).toEqual({ a: 1, c: 'hello' })
      expect(ops.remove).toEqual(['b'])
    })

    it('should skip unchanged values when base is provided', () => {
      const ops = Storage.operationsForChanges(
        { a: 1, b: 2, c: 3 },
        { base: { a: 1, b: 99 } }
      )
      expect(ops.set).toEqual({ b: 2, c: 3 })
      expect(ops.remove).toEqual([])
    })

    it('should apply merge function', () => {
      const merge = (_key: string, newVal: unknown, _oldVal: unknown) => {
        return (newVal as number) * 10
      }
      const ops = Storage.operationsForChanges(
        { a: 5 },
        { base: { a: 1 }, merge }
      )
      expect(ops.set).toEqual({ a: 50 })
    })

    it('should not remove undefined keys that do not exist in base', () => {
      const ops = Storage.operationsForChanges(
        { a: undefined },
        { base: {} }
      )
      expect(ops.remove).toEqual([])
    })

    it('should remove undefined keys when base has the key', () => {
      const ops = Storage.operationsForChanges(
        { a: undefined },
        { base: { a: 1 } }
      )
      expect(ops.remove).toEqual(['a'])
    })

    it('should remove undefined keys when no base is provided', () => {
      const ops = Storage.operationsForChanges({ a: undefined })
      expect(ops.remove).toEqual(['a'])
    })
  })

  describe('Error classes', () => {
    it('RateLimitExceededError should have correct name', () => {
      const err = new Storage.RateLimitExceededError()
      expect(err.name).toBe('RateLimitExceededError')
      expect(err).toBeInstanceOf(Error)
    })

    it('QuotaExceededError should have correct name and perItem flag', () => {
      const err = new Storage.QuotaExceededError()
      expect(err.name).toBe('QuotaExceededError')
      expect(err).toBeInstanceOf(Error)
      err.perItem = true
      expect(err.perItem).toBe(true)
    })

    it('StorageUnavailableError should have correct name', () => {
      const err = new Storage.StorageUnavailableError()
      expect(err.name).toBe('StorageUnavailableError')
      expect(err).toBeInstanceOf(Error)
    })
  })
})
