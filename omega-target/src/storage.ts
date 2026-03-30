/** @module omega-target/storage */
import Log from './log'

export type StorageItems = Record<string, unknown>

export interface StorageOperations {
  set: StorageItems
  remove: string[]
}

export interface OperationsForChangesOptions {
  base?: StorageItems
  merge?: (key: string, newVal: unknown, oldVal: unknown) => unknown
}

export interface StorageChangesOptions extends OperationsForChangesOptions {
  changes: StorageItems
}

class Storage {
  protected _items?: StorageItems

  static RateLimitExceededError = class RateLimitExceededError extends Error {
    constructor() {
      super()
      this.name = 'RateLimitExceededError'
    }
  }

  static QuotaExceededError = class QuotaExceededError extends Error {
    perItem?: boolean
    constructor() {
      super()
      this.name = 'QuotaExceededError'
    }
  }

  static StorageUnavailableError = class StorageUnavailableError extends Error {
    constructor() {
      super()
      this.name = 'StorageUnavailableError'
    }
  }

  static operationsForChanges(
    changes: StorageItems,
    { base, merge }: OperationsForChangesOptions = {}
  ): StorageOperations {
    const set: StorageItems = {}
    const remove: string[] = []
    for (const key of Object.keys(changes)) {
      let newVal = changes[key]
      const oldVal = base != null ? base[key] : newVal
      if (merge) {
        newVal = merge(key, newVal, oldVal)
      }
      if (base != null && newVal === oldVal) continue
      if (typeof newVal === 'undefined') {
        if (typeof oldVal !== 'undefined' || base == null) {
          remove.push(key)
        }
      } else {
        set[key] = newVal
      }
    }
    return { set, remove }
  }

  get(keys?: string | string[] | StorageItems | null): Promise<StorageItems> {
    Log.method('Storage#get', this, arguments)
    if (!this._items) return Promise.resolve({})
    if (keys == null) {
      return Promise.resolve({ ...this._items })
    }
    const map: StorageItems = {}
    if (typeof keys === 'string') {
      map[keys] = this._items[keys]
    } else if (Array.isArray(keys)) {
      for (const key of keys) {
        map[key] = this._items[key]
      }
    } else if (typeof keys === 'object') {
      for (const key of Object.keys(keys)) {
        const val = this._items[key]
        map[key] = val !== undefined ? val : keys[key]
      }
    }
    return Promise.resolve(map)
  }

  set(items: StorageItems): Promise<StorageItems> {
    Log.method('Storage#set', this, arguments)
    if (!this._items) this._items = {}
    for (const key of Object.keys(items)) {
      this._items[key] = items[key]
    }
    return Promise.resolve(items)
  }

  remove(keys?: string | string[] | null): Promise<void> {
    Log.method('Storage#remove', this, arguments)
    if (this._items != null) {
      if (keys == null) {
        this._items = {}
      } else if (Array.isArray(keys)) {
        for (const key of keys) {
          delete this._items[key]
        }
      } else {
        delete this._items[keys]
      }
    }
    return Promise.resolve()
  }

  watch(
    keys: string | string[] | null,
    callback: (changes: StorageItems) => void
  ): () => void {
    Log.method('Storage#watch', this, arguments)
    return () => null
  }

  apply(
    operations: StorageOperations | StorageChangesOptions
  ): Promise<StorageOperations> {
    let ops: StorageOperations
    if ('changes' in operations) {
      ops = Storage.operationsForChanges(
        (operations as StorageChangesOptions).changes,
        operations as OperationsForChangesOptions
      )
    } else {
      ops = operations as StorageOperations
    }
    return this.set(ops.set).then(() => this.remove(ops.remove)).then(() => ops)
  }
}

export default Storage
