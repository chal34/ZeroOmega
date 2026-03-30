import Storage, { StorageItems } from './storage'

declare const idbKeyval: {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

let _globalLocalStorageCache: boolean | null = null

class BrowserStorage extends Storage {
  private storage: Storage
  private prefix: string
  private proto: Record<string, unknown>

  constructor(storage: Storage, prefix = '') {
    super()
    this.storage = storage
    this.prefix = prefix
    this.proto = Object.getPrototypeOf(storage) as Record<string, unknown>
  }

  get(keys?: string | string[] | StorageItems | null): Promise<StorageItems> {
    const promiseResult = idbKeyval.get('localStorage').then((initValuesMap) => {
      if (!_globalLocalStorageCache) {
        const initFn = this.proto['initValuesMap'] as ((v: unknown) => void) | undefined
        initFn?.call(this.storage, initValuesMap)
        _globalLocalStorageCache = true
      }
      let map: StorageItems = {}
      if (typeof keys === 'string') {
        map[keys] = undefined
      } else if (Array.isArray(keys)) {
        for (const key of keys) {
          map[key] = undefined
        }
      } else if (typeof keys === 'object' && keys !== null) {
        map = { ...keys }
      }
      const getItem = this.proto['getItem'] as (key: string) => string | null
      for (const key of Object.keys(map)) {
        try {
          const raw = getItem.call(this.storage, this.prefix + key)
          const value = raw ? JSON.parse(raw) : undefined
          if (value != null) {
            map[key] = value
          }
        } catch (_) {
          // ignore parse errors
        }
        if (typeof map[key] === 'undefined') {
          delete map[key]
        }
      }
      return map
    })
    return Promise.resolve(promiseResult)
  }

  set(items: StorageItems): Promise<StorageItems> {
    const promiseResult = idbKeyval
      .get('localStorage')
      .then((initValuesMap) => {
        if (!_globalLocalStorageCache) {
          const initFn = this.proto['initValuesMap'] as ((v: unknown) => void) | undefined
          initFn?.call(this.storage, initValuesMap)
          _globalLocalStorageCache = true
        }
        const setItem = this.proto['setItem'] as (key: string, value: string) => void
        for (const key of Object.keys(items)) {
          const value = JSON.stringify(items[key])
          setItem.call(this.storage, this.prefix + key, value)
        }
        return new Promise<StorageItems>((resolve) => {
          setTimeout(() => resolve(items), 1)
        })
      })
      .then((result) => {
        const getValuesMap = this.proto['getValuesMap'] as (() => unknown) | undefined
        if (!getValuesMap) return result
        const initValuesMap = getValuesMap.call(this.storage)
        return idbKeyval.set('localStorage', initValuesMap).then(() => result)
      })
    return Promise.resolve(promiseResult)
  }

  remove(keys?: string | string[] | null): Promise<void> {
    const promiseResult = idbKeyval
      .get('localStorage')
      .then((initValuesMap) => {
        if (!_globalLocalStorageCache) {
          const initFn = this.proto['initValuesMap'] as ((v: unknown) => void) | undefined
          initFn?.call(this.storage, initValuesMap)
          _globalLocalStorageCache = true
        }
        const removeItem = this.proto['removeItem'] as (key: string) => void
        const clearFn = this.proto['clear'] as (() => void) | undefined
        const keyFn = this.proto['key'] as ((index: number) => string | null) | undefined
        if (keys == null) {
          if (!this.prefix) {
            clearFn?.call(this.storage)
          } else if (keyFn) {
            let index = 0
            while (true) {
              const key = keyFn.call(this.storage, index)
              if (key === null) break
              if (key.substring(0, this.prefix.length) === this.prefix) {
                removeItem.call(this.storage, key)
              } else {
                index++
              }
            }
          }
        } else if (typeof keys === 'string') {
          removeItem.call(this.storage, this.prefix + keys)
        } else {
          for (const key of keys) {
            removeItem.call(this.storage, this.prefix + key)
          }
        }
      })
      .then(() => {
        return new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 1)
        })
      })
      .then(() => {
        const getValuesMap = this.proto['getValuesMap'] as (() => unknown) | undefined
        if (!getValuesMap) return
        const initValuesMap = getValuesMap.call(this.storage)
        return idbKeyval.set('localStorage', initValuesMap).then(() => undefined)
      })
    return Promise.resolve(promiseResult)
  }
}

export default BrowserStorage
