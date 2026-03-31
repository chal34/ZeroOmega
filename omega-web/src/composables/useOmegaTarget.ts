/**
 * Composable that wraps Chrome extension messaging for communication
 * with the background script. Replaces the Angular 'omegaTarget' service.
 */

const queryTab = (cb: (tab?: any) => void) => {
  chrome.tabs.query(
    { active: true, lastFocusedWindow: true },
    (tabs) => {
      if (tabs.length === 0 || !(tabs[0].pendingUrl || tabs[0].url)) {
        cb()
      } else {
        cb(tabs[0])
      }
    }
  )
}

const getActiveTab = (activeTabId: any, cb: (tab?: any) => void) => {
  if (!activeTabId) {
    const sp = new URLSearchParams(document.location.search)
    activeTabId = sp.get('activeTabId')
  }
  activeTabId = parseInt(activeTabId)
  if (activeTabId) {
    chrome.tabs
      .get(activeTabId)
      .then(cb)
      .catch(() => cb())
  } else {
    queryTab(cb)
  }
}

const decodeError = (obj: any) => {
  if (obj._error === 'error') {
    const err: any = new Error(obj.message)
    err.name = obj.name
    err.stack = obj.stack
    err.original = obj.original
    return err
  }
  return obj
}

const callBackgroundNoReply = (method: string, ...args: any[]) => {
  chrome.runtime.sendMessage({
    method,
    args,
    noReply: true,
  })
}

const callBackground = (method: string, ...args: any[]): Promise<any> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { method, args },
      (response: any) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
          return
        }
        if (response.error) {
          reject(decodeError(response.error))
        } else {
          resolve(response.result)
        }
      }
    )
  })
}

const connectBackground = (name: string, message: any, callback: any) => {
  const port = chrome.runtime.connect({ name })
  const onDisconnect = () => {
    port.onDisconnect.removeListener(onDisconnect)
    port.onMessage.removeListener(callback)
  }
  port.onDisconnect.addListener(onDisconnect)
  port.postMessage(message)
  port.onMessage.addListener(callback)
}

const isChromeUrl = (url: string) =>
  url.startsWith('chrome') || url.startsWith('moz-') || url.startsWith('about:')

let optionsChangeCallbacks: Array<(options: any) => void> = []
let requestInfoCallback: any = null
const prefix = 'omega.local.'
const urlParser = document.createElement('a')

export interface OmegaTarget {
  options: any
  state(name: string | string[], value?: any): Promise<any>
  lastUrl(url?: string): string | undefined
  addOptionsChangeCallback(callback: (options: any) => void): void
  refresh(args?: any): Promise<any>
  renameProfile(fromName: string, toName: string): Promise<any>
  replaceRef(fromName: string, toName: string): Promise<any>
  optionsPatch(patch: any): Promise<any>
  resetOptions(opt: any): Promise<any>
  updateProfile(name: string, bypassCache?: boolean): Promise<any>
  getMessage(key: string, substitutions?: string[]): string
  openOptions(hash?: string): Promise<void>
  applyProfile(name: string): Promise<any>
  applyProfileNoReply(name: string): void
  addTempRule(domain: string, profileName: string, toggle: boolean): Promise<any>
  addCondition(condition: any, profileName: string): Promise<any>
  addProfile(profile: any): Promise<any>
  setDefaultProfile(profileName: string, defaultProfileName: string): Promise<any>
  getActivePageInfo(activeTabId?: any): Promise<any>
  refreshActivePage(activeTabId?: any): Promise<void>
  openManage(): void
  openShortcutConfig(): void
  setOptionsSync(enabled: boolean, args: any): Promise<any>
  resetOptionsSync(args: any): Promise<any>
  checkOptionsSyncChange(): Promise<any>
  setRequestInfoCallback(callback: any): void
}

const omegaTarget: OmegaTarget = {
  options: null,

  state(name: any, value?: any): Promise<any> {
    if (arguments.length === 1) {
      if (Array.isArray(name)) {
        return callBackground('getState', name).then((values: any) =>
          name.map((key: string) => values[key])
        )
      } else {
        return callBackground('getState', [name]).then(
          (values: any) => values[name]
        )
      }
    } else {
      const newItem: any = {}
      newItem[name] = value
      return callBackground('setState', newItem).then(() => value)
    }
  },

  lastUrl(url?: string): string | undefined {
    const name = 'web.last_url'
    if (url) {
      localStorage[prefix + name] = url
      return url
    } else {
      try {
        return JSON.parse(localStorage[prefix + name])
      } catch (_) {
        return undefined
      }
    }
  },

  addOptionsChangeCallback(callback: (options: any) => void) {
    optionsChangeCallbacks.push(callback)
  },

  refresh(args?: any): Promise<any> {
    return callBackground('getAll').then((opt: any) => {
      omegaTarget.options = opt
      for (const callback of optionsChangeCallbacks) {
        callback(omegaTarget.options)
      }
      return args
    })
  },

  renameProfile(fromName: string, toName: string) {
    return callBackground('renameProfile', fromName, toName).then(() =>
      omegaTarget.refresh()
    )
  },

  replaceRef(fromName: string, toName: string) {
    return callBackground('replaceRef', fromName, toName).then(() =>
      omegaTarget.refresh()
    )
  },

  optionsPatch(patch: any) {
    return callBackground('patch', patch).then(() => omegaTarget.refresh())
  },

  resetOptions(opt: any) {
    return callBackground('reset', opt).then(() => omegaTarget.refresh())
  },

  updateProfile(name: string, bypassCache?: boolean) {
    return callBackground('updateProfile', name, bypassCache)
      .then((results: any) => {
        for (const [key, value] of Object.entries(results)) {
          results[key] = decodeError(value)
        }
        return results
      })
      .then(() => omegaTarget.refresh())
  },

  getMessage: chrome.i18n.getMessage.bind(chrome.i18n),

  openOptions(hash?: string): Promise<void> {
    return new Promise((resolve) => {
      const optionsUrl = chrome.runtime.getURL('options.html')
      chrome.tabs.query({ url: optionsUrl }, (tabs) => {
        let url: string
        if (hash) {
          urlParser.href = tabs[0]?.url || optionsUrl
          urlParser.hash = hash
          url = urlParser.href
        } else {
          url = optionsUrl
        }
        if (tabs.length > 0) {
          const props: any = { active: true }
          if (hash) {
            props.url = url
          }
          chrome.tabs.update(tabs[0].id!, props)
        } else {
          chrome.tabs.create({ url })
        }
        resolve()
      })
    })
  },

  applyProfile(name: string) {
    return callBackground('applyProfile', name)
  },

  applyProfileNoReply(name: string) {
    callBackgroundNoReply('applyProfile', name)
  },

  addTempRule(domain: string, profileName: string, toggle: boolean) {
    return callBackground('addTempRule', domain, profileName, toggle)
  },

  addCondition(condition: any, profileName: string) {
    return callBackground('addCondition', condition, profileName)
  },

  addProfile(profile: any) {
    return callBackground('addProfile', profile).then(() =>
      omegaTarget.refresh()
    )
  },

  setDefaultProfile(profileName: string, defaultProfileName: string) {
    return callBackground('setDefaultProfile', profileName, defaultProfileName)
  },

  getActivePageInfo(activeTabId?: any): Promise<any> {
    return new Promise((resolve) => {
      getActiveTab(activeTabId, (tab?: any) => {
        if (!tab) {
          resolve(null)
          return
        }
        const args = {
          tabId: tab.id,
          url: tab.pendingUrl || tab.url,
        }
        if (tab.id && requestInfoCallback) {
          connectBackground('tabRequestInfo', args, requestInfoCallback)
        }
        resolve(callBackground('getPageInfo', args))
      })
    }).then((info: any) => (info?.url ? info : null))
  },

  refreshActivePage(activeTabId?: any): Promise<void> {
    return new Promise((resolve) => {
      getActiveTab(activeTabId, (tab?: any) => {
        if (!tab) {
          resolve()
          return
        }
        const url = tab.pendingUrl || tab.url
        if (url && !isChromeUrl(url)) {
          if (tab.pendingUrl) {
            chrome.tabs.update(tab.id!, { url })
          } else {
            chrome.tabs.reload(tab.id!, { bypassCache: true })
          }
        }
        resolve()
      })
    })
  },

  openManage() {
    chrome.tabs.create({
      url: 'chrome://extensions/?id=' + chrome.runtime.id,
    })
  },

  openShortcutConfig() {
    chrome.tabs.create({
      url: 'chrome://extensions/configureCommands',
    })
  },

  setOptionsSync(enabled: boolean, args: any) {
    return callBackground('setOptionsSync', enabled, args)
  },

  resetOptionsSync(args: any) {
    return callBackground('resetOptionsSync', args)
  },

  checkOptionsSyncChange() {
    return callBackground('checkOptionsSyncChange')
  },

  setRequestInfoCallback(callback: any) {
    requestInfoCallback = callback
  },
}

// Singleton - shared across all components
export function useOmegaTarget(): OmegaTarget {
  return omegaTarget
}
