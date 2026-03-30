const OmegaTargetCurrent = Object.create(OmegaTargetChromium)

OmegaTargetCurrent.Log = Object.create(OmegaTargetCurrent.Log)
const Log = OmegaTargetCurrent.Log

const BUILTINSYNCKEY = 'zeroOmegaSync'

;(globalThis as any).isBrowserRestart = false
const startupCheck = () => {
  setTimeout(() => {
    ;(globalThis as any).isBrowserRestart = false
  }, 2000)
  return (globalThis as any).isBrowserRestart
}
let options: any = null

chrome.runtime.onStartup.addListener(() => {
  ;(globalThis as any).isBrowserRestart = true
})

chrome.contextMenus?.onClicked.addListener((info: any, tab: any) => {
  options?.ready.then(() => {
    switch (info.menuItemId) {
      case 'inspectPage':
      case 'inspectLink':
      case 'inspectElement':
      case 'inspectFrame':
        options._inspect.inspect(info, tab)
        break
    }
  })
})

const upgradeMigrateFn = (details: any) => {
  if (details.reason === 'install') {
    options.ready.then(() => {
      console.log('fresh install:', details)
    })
  }
  if (details.reason === 'update') {
    const manifest = chrome.runtime.getManifest()
    const currentVersion = manifest.version
    const previousVersion = details.previousVersion
    if (compareVersions.compare(currentVersion, previousVersion, '>')) {
      if (compareVersions.compare('3.3.0', currentVersion, '>')) {
        options.ready.then(() => {
          chrome.storage.sync.clear()
          chrome.storage.local.clear()
          idbKeyval.clear()
        })
      } else {
        switch (currentVersion) {
          case '3.3.10':
            options.ready.then(() => {
              // TODO check
              true
            })
            break
          case '3.3.11':
            options.ready.then(() => {
              // TODO clear all disabled syncOptions
              true
            })
            break
        }
      }
    }
  }
}

chrome.runtime.onInstalled.addListener((details: any) => {
  setTimeout(() => {
    upgradeMigrateFn(details)
  }, 2)
})

const dispName = (name: string) =>
  chrome.i18n.getMessage('profile_' + name) || name

const zeroBackground = (zeroStorage: any, opts: any) => {
  let iconCache: any = {}
  let drawContext: any = null
  let drawError: any = null
  const drawIcon = (resultColor: any, profileColor?: any) => {
    const cacheKey = `omega+${resultColor ?? ''}+${profileColor}`
    let icon = iconCache[cacheKey]
    if (icon) return icon
    try {
      if (drawContext == null) {
        const canvas = new OffscreenCanvas(300, 300)
        drawContext = canvas.getContext('2d', {
          willReadFrequently: true,
        })
      }

      icon = {} as any
      for (const size of [16, 19, 24, 32, 38]) {
        drawContext.scale(size, size)
        drawContext.clearRect(0, 0, 1, 1)
        if (resultColor != null) {
          drawOmega(drawContext, resultColor, profileColor)
        } else {
          drawOmega(drawContext, profileColor)
        }
        drawContext.setTransform(1, 0, 0, 1, 0, 0)
        icon[size] = drawContext.getImageData(0, 0, size, size)
        if (icon[size].data[3] == 255) {
          throw new Error(
            'Icon drawing blocked by privacy.resistFingerprinting.'
          )
        }
      }
    } catch (e: any) {
      if (drawError == null) {
        drawError = e
        Log.error(e)
        Log.error(
          'Profile-colored icon disabled. Falling back to static icon.'
        )
      }
      icon = null
    }

    return (iconCache[cacheKey] = icon)
  }

  const charCodeUnderscore = '_'.charCodeAt(0)
  const isHidden = (name: string) =>
    name.charCodeAt(0) == charCodeUnderscore &&
    name.charCodeAt(1) == charCodeUnderscore

  const actionForUrl = (url: string, opts: any = {}) => {
    return options.ready
      .then(() => {
        const request = OmegaPac.Conditions.requestFromUrl(url)
        return options.matchProfile(request)
      })
      .then(({ profile, results }: any) => {
        let current = options.currentProfile()
        let currentName = dispName(current.name)
        let realCurrentName: string | undefined
        if (current.profileType == 'VirtualProfile') {
          realCurrentName = current.defaultProfileName
          currentName += ` [${dispName(realCurrentName!)}]`
          current = options.profile(realCurrentName)
        }
        let details = ''
        let direct = false
        let attached = false
        let prefix = ''
        const condition2Str = (condition: any) =>
          condition.pattern || OmegaPac.Conditions.str(condition)
        for (const result of results) {
          if (Array.isArray(result)) {
            if (result[1] == null) {
              attached = false
              let name = result[0]
              if (name[0] == '+') {
                name = name.substr(1)
              }
              if (isHidden(name)) {
                attached = true
              } else if (name != realCurrentName) {
                details += chrome.i18n.getMessage(
                  'browserAction_defaultRuleDetails'
                )
                details += ` => ${dispName(name)}\n`
              }
            } else if (result[1].length == 0) {
              if (result[0] == 'DIRECT') {
                details += chrome.i18n.getMessage(
                  'browserAction_directResult'
                )
                details += '\n'
                direct = true
              } else {
                details += `${result[0]}\n`
              }
            } else if (typeof result[1] == 'string') {
              details += `${result[1]} => ${result[0]}\n`
            } else {
              const condition = condition2Str(
                result[1].condition ?? result[1]
              )
              details += `${condition} => `
              if (result[0] == 'DIRECT') {
                details += chrome.i18n.getMessage(
                  'browserAction_directResult'
                )
                details += '\n'
                direct = true
              } else {
                details += `${result[0]}\n`
              }
            }
          } else if (result.profileName) {
            if (result.isTempRule) {
              details += chrome.i18n.getMessage(
                'browserAction_tempRulePrefix'
              )
              prefix = chrome.i18n.getMessage(
                'browserAction_tempRulePrefix'
              )
            } else if (attached) {
              details += chrome.i18n.getMessage(
                'browserAction_attachedPrefix'
              )
              prefix = chrome.i18n.getMessage(
                'browserAction_attachedPrefix'
              )
              attached = false
            }
            const condition =
              result.source ?? condition2Str(result.condition)
            details += `${condition} => ${dispName(result.profileName)}\n`
          }
        }

        if (!details) {
          details = options.printProfile(current)
        }

        let resultColor = profile.color
        let profileColor = current.color

        let icon: any = null
        if (direct) {
          resultColor = options.profile('direct').color
          profileColor = profile.color
        } else if (
          profile.name == current.name &&
          options.isCurrentProfileStatic()
        ) {
          resultColor = profileColor = profile.color
          if (!opts.skipIcon) {
            icon = drawIcon(profile.color)
          }
        } else {
          resultColor = profile.color
          profileColor = current.color
        }

        if (!opts.skipIcon) {
          icon ??= drawIcon(resultColor, profileColor)
        }

        const shortTitle =
          'Omega: ' +
          currentName +
          (profile.name != currentName
            ? ' => ' + profile.name
            : '')
        let badgeText: string | undefined
        if (options._options['-showResultProfileOnActionBadgeText']) {
          badgeText = profile.name || ''
          if (profile.builtin) {
            badgeText = dispName(profile.name + '_badge_text')
          }
          badgeText = badgeText!.substring(0, 4)
        }

        return {
          title: chrome.i18n.getMessage(
            'browserAction_titleWithResult',
            [currentName, dispName(profile.name), details]
          ),
          currentName: currentName,
          name: dispName(profile.name),
          profile: profile,
          badgeText: badgeText,
          shortTitle: shortTitle,
          prefix: prefix,
          icon: icon,
          resultColor: resultColor,
          profileColor: profileColor,
        }
      })
      .catch(() => null)
  }

  const storage = new OmegaTargetCurrent.Storage('local')
  const state = new OmegaTargetCurrent.BrowserStorage(
    zeroStorage,
    'omega.local.'
  )

  let syncStorage: any
  let builtInSyncStorage: any
  let sync: any
  if (chrome?.storage?.sync || (typeof browser !== 'undefined' && browser?.storage?.sync)) {
    syncStorage = new OmegaTargetCurrent.SyncStorage('sync', state)
    builtInSyncStorage = new OmegaTargetCurrent.Storage('sync')
    sync = new OmegaTargetCurrent.OptionsSync(
      syncStorage,
      builtInSyncStorage,
      state
    )
    sync.transformValue =
      OmegaTargetCurrent.Options.transformValueForSync
  }

  const proxyImpl = OmegaTargetCurrent.proxy.getProxyImpl(Log)
  state.set({ proxyImplFeatures: proxyImpl.features })
  options = new OmegaTargetCurrent.Options(
    storage,
    state,
    Log,
    sync,
    proxyImpl
  )

  options._actionForUrl = actionForUrl

  options.initWithOptions(null, startupCheck)

  options.externalApi = new OmegaTargetCurrent.ExternalApi(options)
  options.externalApi.listen()

  if (
    chrome.runtime.id != OmegaTargetCurrent.SwitchySharp.extId &&
    false
  ) {
    options.switchySharp = new OmegaTargetCurrent.SwitchySharp()
    options.switchySharp.monitor()
  }
  if (sync && options && builtInSyncStorage) {
    builtInSyncStorage.watch(
      [BUILTINSYNCKEY],
      (changes: any, opts: any = {}) => {
        const builtInSyncConfig = changes[BUILTINSYNCKEY]
        if (builtInSyncConfig) {
          const { gistId, gistToken, lastGistCommit } =
            builtInSyncConfig
          state.set({ gistId, gistToken })
          if (sync.enabled) {
            console.log('check gist change', lastGistCommit)
            sync.init({ gistId, gistToken })
            state
              .get({
                lastGistCommit: '',
              })
              .then((syncConfig: any) => {
                if (syncConfig.lastGistCommit !== lastGistCommit) {
                  console.log(
                    'no match last gist commit, will check change',
                    syncConfig.lastGistCommit
                  )
                  sync.checkChange()
                }
              })
          } else {
            state
              .get({
                syncOptions: '',
                lastGistCommit: '',
              })
              .then((syncConfig: any) => {
                if (syncConfig.lastGistCommit === lastGistCommit)
                  return
                if (
                  syncConfig.syncOptions === 'pristine' ||
                  syncConfig.syncOptions === 'conflict'
                ) {
                  state
                    .set({
                      syncOptions: 'conflict',
                    })
                    .then(() => {
                      options.setOptionsSync(true, {
                        gistId,
                        gistToken,
                        useBuiltInSync: true,
                        force: true,
                      })
                    })
                }
              })
          }
        }
      }
    )
  }
  const tabs = new OmegaTargetCurrent.ChromeTabs(actionForUrl)
  tabs.watch()

  options._inspect = new OmegaTargetCurrent.Inspect(
    (url: string, tab: any) => {
      if (url == tab.url) {
        options.clearBadge()
        tabs.processTab(tab)
        state.remove('inspectUrl')
        return
      }

      state.set({ inspectUrl: url })

      actionForUrl(url).then((action: any) => {
        if (!action) return
        const parsedUrl = new URL(url)
        const tabUrl = new URL(tab.url)
        let urlDisp: string
        if (parsedUrl.hostname == tabUrl.hostname) {
          urlDisp = parsedUrl.pathname
        } else {
          urlDisp = parsedUrl.hostname
        }

        let title =
          chrome.i18n.getMessage(
            'browserAction_titleInspect',
            urlDisp
          ) + '\n'
        title += action.title
        chrome.action.setTitle({ title: title, tabId: tab.id })
        tabs.setTabBadge(tab, {
          text: '#',
          color: action.resultColor,
        })
      })
    }
  )

  options.setProxyNotControllable(null)
  let timeout: any = null

  proxyImpl.watchProxyChange((details: any) => {
    if (options.externalApi.disabled) return
    if (!details) return
    const notControllableBefore = options.proxyNotControllable()
    let internal = false
    let noRevert = false
    switch (details['levelOfControl']) {
      case 'controlled_by_other_extensions':
      case 'not_controllable': {
        const reason =
          details['levelOfControl'] == 'not_controllable'
            ? 'policy'
            : 'app'
        options.setProxyNotControllable(reason)
        noRevert = true
        break
      }
      default:
        options.setProxyNotControllable(null)
        break
    }

    if (details['levelOfControl'] == 'controlled_by_this_extension') {
      internal = true
      if (!notControllableBefore) return
    }
    Log.log('external proxy: ', details)

    if (timeout != null) clearTimeout(timeout)
    let parsed: any = null
    timeout = setTimeout(() => {
      if (parsed) {
        options.setExternalProfile(parsed, {
          noRevert: noRevert,
          internal: internal,
        })
      }
    }, 500)

    parsed = proxyImpl.parseExternalProfile(details, options._options)
    return
  })

  let external = false
  options.currentProfileChanged = (reason: string) => {
    iconCache = {}

    if (reason == 'external') {
      external = true
    } else if (reason != 'clearBadge') {
      external = false
    }

    const current = options.currentProfile()
    let currentName = ''
    let realCurrent = current
    if (current) {
      currentName = dispName(current.name)
      if (current.profileType == 'VirtualProfile') {
        const realCurrentName = current.defaultProfileName
        currentName += ` [${dispName(realCurrentName)}]`
        realCurrent = options.profile(realCurrentName)
      }
    }

    const details = options.printProfile(realCurrent)
    let title: string
    let shortTitle: string
    if (currentName) {
      title = chrome.i18n.getMessage(
        'browserAction_titleWithResult',
        [currentName, '', details]
      )
      shortTitle = 'Omega: ' + currentName
    } else {
      title = details
      shortTitle = 'Omega: ' + details
    }

    if (
      external &&
      realCurrent.profileType != 'SystemProfile'
    ) {
      const message = chrome.i18n.getMessage(
        'browserAction_titleExternalProxy'
      )
      title = message + '\n' + title
      shortTitle = 'Omega-Extern: ' + details
      options.setBadge()
    }

    let icon: any
    if (
      !realCurrent.name ||
      !OmegaPac.Profiles.isInclusive(realCurrent)
    ) {
      icon = drawIcon(realCurrent.color)
    } else {
      icon = drawIcon(
        options.profile('direct').color,
        realCurrent.color
      )
    }

    tabs.resetAll({
      icon: icon,
      title: title,
      shortTitle: shortTitle,
    })
  }

  const encodeError = (obj: any) => {
    if (obj instanceof Error) {
      return {
        _error: 'error',
        name: obj.name,
        message: obj.message,
        stack: obj.stack,
        original: obj,
      }
    } else {
      return obj
    }
  }

  const refreshActivePageIfEnabled = () => {
    if (
      zeroStorage['omega.local.refreshOnProfileChange'] == 'false'
    )
      return
    chrome.tabs.query(
      { active: true, lastFocusedWindow: true },
      (tabs: any[]) => {
        const url = tabs[0].pendingUrl || tabs[0].url
        if (!url) return
        if (url.substr(0, 6) == 'chrome') return
        if (url.substr(0, 6) == 'about:') return
        if (url.substr(0, 4) == 'moz-') return
        if (tabs[0].pendingUrl) {
          chrome.tabs.update(tabs[0].id, { url: url })
        } else {
          chrome.tabs.reload(tabs[0].id, { bypassCache: true })
        }
      }
    )
  }

  const resetAllOptions = () => {
    return options.ready.then(() => {
      options._watchStop?.()
      options._syncWatchStop?.()
      return Promise.all([
        chrome.storage.sync.clear(),
        chrome.storage.local.clear(),
      ])
    })
  }

  chrome.runtime.onMessage.addListener(
    (request: any, sender: any, respond: any) => {
      if (!request || !request.method) return
      options.ready.then(() => {
        let target: any
        let method: any
        if (request.method == 'resetAllOptions') {
          target = globalThis
          method = resetAllOptions
        } else if (request.method == 'getState') {
          target = state
          method = state.get
        } else if (request.method == 'setState') {
          target = state
          method = state.set
        } else {
          target = options
          method = target[request.method]
        }
        if (typeof method != 'function') {
          Log.error(`No such method ${request.method}!`)
          respond({
            error: {
              reason: 'noSuchMethod',
            },
          })
          return
        }

        const promise = Promise.resolve().then(() =>
          method.apply(target, request.args)
        )
        if (request.refreshActivePage) {
          promise.then(refreshActivePageIfEnabled)
        }
        if (request.noReply) return

        promise.then((result: any) => {
          if (request.method == 'updateProfile') {
            for (const [key, value] of Object.entries(result)) {
              result[key] = encodeError(value)
            }
          }
          respond({ result: result })
        })

        promise.catch((error: any) => {
          Log.error(request.method + ' ==>', error)
          respond({ error: encodeError(error) })
        })
      })

      if (!request.noReply) return true
    }
  )
}
;(globalThis as any).zeroBackground = zeroBackground
