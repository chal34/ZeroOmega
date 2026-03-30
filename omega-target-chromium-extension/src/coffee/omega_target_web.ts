const queryTab = (cb: any) => {
  chrome.tabs.query(
    { active: true, lastFocusedWindow: true },
    (tabs: any[]) => {
      if (tabs.length == 0 || !(tabs[0].pendingUrl || tabs[0].url)) {
        cb()
      } else {
        cb(tabs[0])
      }
    }
  )
}

const getActiveTab = (activeTabId: any, cb: any) => {
  if (!activeTabId) {
    const sp = new URLSearchParams(document.location.search)
    activeTabId = sp.get('activeTabId')
  }
  activeTabId = parseInt(activeTabId)
  if (activeTabId) {
    chrome.tabs
      .get(activeTabId)
      .then(cb)
      .catch(() => {
        cb()
      })
  } else {
    queryTab(cb)
  }
}

angular.module('omegaTarget', []).factory('omegaTarget', ($q: any) => {
  const decodeError = (obj: any) => {
    if (obj._error == 'error') {
      const err: any = new Error(obj.message)
      err.name = obj.name
      err.stack = obj.stack
      err.original = obj.original
      return err
    } else {
      return obj
    }
  }

  const callBackgroundNoReply = (method: string, ...args: any[]) => {
    chrome.runtime.sendMessage({
      method: method,
      args: args,
      noReply: true,
    })
  }

  const callBackground = (method: string, ...args: any[]) => {
    const d = $q['defer']()
    chrome.runtime.sendMessage(
      {
        method: method,
        args: args,
      },
      (response: any) => {
        if (chrome.runtime.lastError) {
          d.reject(chrome.runtime.lastError)
          return
        }
        if (response.error) {
          d.reject(decodeError(response.error))
        } else {
          d.resolve(response.result)
        }
      }
    )
    return d.promise
  }

  const connectBackground = (
    name: string,
    message: any,
    callback: any
  ) => {
    const port = chrome.runtime.connect({ name: name })
    const onDisconnect = () => {
      port.onDisconnect.removeListener(onDisconnect)
      port.onMessage.removeListener(callback)
    }
    port.onDisconnect.addListener(onDisconnect)

    port.postMessage(message)
    port.onMessage.addListener(callback)
    return
  }

  const isChromeUrl = (url: string) =>
    url.substr(0, 6) == 'chrome' ||
    url.substr(0, 4) == 'moz-' ||
    url.substr(0, 6) == 'about:'

  let optionsChangeCallback: any[] = []
  let requestInfoCallback: any = null
  const prefix = 'omega.local.'
  const urlParser = document.createElement('a')
  const omegaTarget: any = {
    options: null,
    state: function(name: any, value?: any) {
      const d = $q.defer()
      if (arguments.length == 1) {
        if (Array.isArray(name)) {
          callBackground('getState', name).then((values: any) => {
            d.resolve(name.map((key: string) => values[key]))
          })
        } else {
          callBackground('getState', [name]).then(
            (values: any) => {
              d.resolve(values[name])
            }
          )
        }
      } else {
        const newItem: any = {}
        newItem[name] = value
        callBackground('setState', newItem).then(() => {
          d.resolve(value)
        })
      }
      return d.promise
    },
    lastUrl: (url?: string) => {
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
    addOptionsChangeCallback: (callback: any) => {
      optionsChangeCallback.push(callback)
    },
    refresh: (args: any) => {
      return callBackground('getAll').then((opt: any) => {
        omegaTarget.options = opt
        for (const callback of optionsChangeCallback) {
          callback(omegaTarget.options)
        }
        return args
      })
    },
    renameProfile: (fromName: string, toName: string) => {
      return callBackground('renameProfile', fromName, toName).then(
        omegaTarget.refresh
      )
    },
    replaceRef: (fromName: string, toName: string) => {
      return callBackground('replaceRef', fromName, toName).then(
        omegaTarget.refresh
      )
    },
    optionsPatch: (patch: any) => {
      return callBackground('patch', patch).then(omegaTarget.refresh)
    },
    resetOptions: (opt: any) => {
      return callBackground('reset', opt).then(omegaTarget.refresh)
    },
    updateProfile: (name: string, opt_bypass_cache?: boolean) => {
      return callBackground('updateProfile', name, opt_bypass_cache)
        .then((results: any) => {
          for (const [key, value] of Object.entries(results)) {
            results[key] = decodeError(value)
          }
          return results
        })
        .then(omegaTarget.refresh)
    },
    getMessage: chrome.i18n.getMessage.bind(chrome.i18n),
    openOptions: (hash?: string) => {
      const d = $q['defer']()
      const options_url = chrome.runtime.getURL('options.html')
      chrome.tabs.query({ url: options_url }, (tabs: any[]) => {
        let url: string
        if (hash) {
          urlParser.href = tabs[0]?.url || options_url
          urlParser.hash = hash
          url = urlParser.href
        } else {
          url = options_url
        }
        if (tabs.length > 0) {
          const props: any = { active: true }
          if (hash) {
            props.url = url
          }
          chrome.tabs.update(tabs[0].id, props)
        } else {
          chrome.tabs.create({ url: url })
        }
        d.resolve()
      })
      return d.promise
    },
    applyProfile: (name: string) => {
      return callBackground('applyProfile', name)
    },
    applyProfileNoReply: (name: string) => {
      callBackgroundNoReply('applyProfile', name)
    },
    addTempRule: (
      domain: string,
      profileName: string,
      toggle: boolean
    ) => {
      return callBackground('addTempRule', domain, profileName, toggle)
    },
    addCondition: (condition: any, profileName: string) => {
      return callBackground('addCondition', condition, profileName)
    },
    addProfile: (profile: any) => {
      return callBackground('addProfile', profile).then(
        omegaTarget.refresh
      )
    },
    setDefaultProfile: (
      profileName: string,
      defaultProfileName: string
    ) => {
      return callBackground(
        'setDefaultProfile',
        profileName,
        defaultProfileName
      )
    },
    getActivePageInfo: (activeTabId?: any) => {
      const clearBadge = true
      const d = $q['defer']()
      getActiveTab(activeTabId, (tab: any) => {
        if (!tab) {
          d.resolve(null)
          return
        }
        const args = {
          tabId: tab.id,
          url: tab.pendingUrl || tab.url,
        }
        if (tab.id && requestInfoCallback) {
          connectBackground(
            'tabRequestInfo',
            args,
            requestInfoCallback
          )
        }
        d.resolve(callBackground('getPageInfo', args))
      })
      return d.promise.then((info: any) =>
        info?.url ? info : null
      )
    },
    refreshActivePage: (activeTabId?: any) => {
      const d = $q['defer']()
      getActiveTab(activeTabId, (tab: any) => {
        if (!tab) {
          return d.resolve()
        }
        const url = tab.pendingUrl || tab.url
        if (url && !isChromeUrl(url)) {
          if (tab.pendingUrl) {
            chrome.tabs.update(tab.id, { url })
          } else {
            chrome.tabs.reload(tab.id, { bypassCache: true })
          }
        }
        d.resolve()
      })
      return d.promise
    },
    openManage: () => {
      chrome.tabs.create({
        url: 'chrome://extensions/?id=' + chrome.runtime.id,
      })
    },
    openShortcutConfig: () => {
      chrome.tabs.create({
        url: 'chrome://extensions/configureCommands',
      })
    },
    setOptionsSync: (enabled: boolean, args: any) => {
      return callBackground('setOptionsSync', enabled, args)
    },
    resetOptionsSync: (args: any) => {
      return callBackground('resetOptionsSync', args)
    },
    checkOptionsSyncChange: () => {
      return callBackground('checkOptionsSyncChange')
    },
    setRequestInfoCallback: (callback: any) => {
      requestInfoCallback = callback
    },
  }

  return omegaTarget
})
