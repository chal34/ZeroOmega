declare const chrome: any
declare const browser: any

import { chromeApiPromisify } from './chrome_api'
const OmegaTarget = require('omega-target') as any

class ChromeStorage extends OmegaTarget.Storage {
  areaName: string
  storage: any

  static parseStorageErrors(err: any): Promise<never> {
    if (err?.message) {
      const sustainedPerMinute = 'MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE'
      if (err.message.indexOf('QUOTA_BYTES_PER_ITEM') >= 0) {
        err = new OmegaTarget.Storage.QuotaExceededError()
        err.perItem = true
      } else if (err.message.indexOf('QUOTA_BYTES') >= 0) {
        err = new OmegaTarget.Storage.QuotaExceededError()
      } else if (err.message.indexOf('MAX_ITEMS') >= 0) {
        err = new OmegaTarget.Storage.QuotaExceededError()
        err.maxItems = true
      } else if (err.message.indexOf('MAX_WRITE_OPERATIONS_') >= 0) {
        err = new OmegaTarget.Storage.RateLimitExceededError()
        if (err.message.indexOf('MAX_WRITE_OPERATIONS_PER_HOUR') >= 0) {
          err.perHour = true
        } else if (err.message.indexOf('MAX_WRITE_OPERATIONS_PER_MINUTE') >= 0) {
          err.perMinute = true
        }
      } else if (err.message.indexOf(sustainedPerMinute) >= 0) {
        err = new OmegaTarget.Storage.RateLimitExceededError()
        err.perMinute = true
        err.sustained = 10
      } else if (err.message.indexOf('is not available') >= 0) {
        err = new OmegaTarget.Storage.StorageUnavailableError()
      } else if (
        err.message.indexOf(
          'Please set webextensions.storage.sync.enabled to true'
        ) >= 0
      ) {
        err = new OmegaTarget.Storage.StorageUnavailableError()
      }
    }

    return Promise.reject(err)
  }

  static onChangedListenerInstalled = false
  static watchers: Record<string, Record<string, any>> = {}

  static onChangedListener(changes: any, areaName: string) {
    let map: any = null
    for (const [, watcher] of Object.entries<any>(
      ChromeStorage.watchers[areaName] || {}
    )) {
      let match = watcher.keys == null
      if (!match) {
        for (const key of Object.keys(changes)) {
          if (watcher.keys[key]) {
            match = true
            break
          }
        }
      }
      if (match) {
        if (map == null) {
          map = {}
          for (const [key, change] of Object.entries<any>(changes)) {
            map[key] = change.newValue
          }
        }
        watcher.callback(map)
      }
    }
  }

  constructor(areaName: string) {
    super()
    this.areaName = areaName
    if (typeof browser !== 'undefined' && browser?.storage?.[this.areaName]) {
      this.storage = browser.storage[this.areaName]
    } else {
      this.storage = {
        get: chromeApiPromisify(chrome.storage[this.areaName], 'get'),
        set: chromeApiPromisify(chrome.storage[this.areaName], 'set'),
        remove: chromeApiPromisify(chrome.storage[this.areaName], 'remove'),
        clear: chromeApiPromisify(chrome.storage[this.areaName], 'clear'),
      }
    }
  }

  get(keys?: any) {
    keys ??= null
    return Promise.resolve(this.storage.get(keys)).catch(
      ChromeStorage.parseStorageErrors
    )
  }

  set(items: any) {
    if (Object.keys(items).length == 0) {
      return Promise.resolve({})
    }
    return Promise.resolve(this.storage.set(items)).catch(
      ChromeStorage.parseStorageErrors
    )
  }

  remove(keys?: any) {
    if (keys == null) {
      return Promise.resolve(this.storage.clear())
    }
    if (Array.isArray(keys) && keys.length == 0) {
      return Promise.resolve({})
    }
    return Promise.resolve(this.storage.remove(keys)).catch(
      ChromeStorage.parseStorageErrors
    )
  }

  watch(keys: any, callback: any) {
    ChromeStorage.watchers[this.areaName] ??= {}
    const area = ChromeStorage.watchers[this.areaName]
    let id = Date.now().toString()
    while (area[id]) {
      id = Date.now().toString()
    }

    if (Array.isArray(keys)) {
      const keyMap: Record<string, boolean> = {}
      for (const key of keys) {
        keyMap[key] = true
      }
      keys = keyMap
    }
    area[id] = { keys: keys, callback: callback }
    if (!ChromeStorage.onChangedListenerInstalled) {
      chrome.storage.onChanged.addListener(ChromeStorage.onChangedListener)
      ChromeStorage.onChangedListenerInstalled = true
    }
    return () => {
      delete area[id]
    }
  }
}

export = ChromeStorage
