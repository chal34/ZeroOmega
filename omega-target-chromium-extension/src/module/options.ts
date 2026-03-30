declare const chrome: any
declare const browser: any

const OmegaTarget = require('omega-target') as any
const OmegaPac = OmegaTarget.OmegaPac
import WebRequestMonitor = require('./web_request_monitor')
import ChromePort = require('./chrome_port')
import fetchUrl = require('./fetch_url')

const TEMPPROFILEKEY = 'tempProfileState'

class ChromeOptions extends OmegaTarget.Options {
  _inspect: any = null
  _actionForUrl: any = null

  fetchUrl: any = fetchUrl
  _networkInspectPorts: any[] = []

  constructor(...args: any[]) {
    super(...args)

    chrome.runtime.onConnect.addListener((port: any) => {
      if (port.name !== 'network-inspect') return
      if (!this._requestMonitor) {
        const originalEnabled = this._monitorWebRequests
        this.setMonitorWebRequests(true)
        this._monitorWebRequests = originalEnabled
      }
      port.postMessage({
        type: 'connected',
      })
      const onMessage = (msg: any) => {
        switch (msg.type) {
          case 'init': {
            const requestTabId = msg.tabId
            let _tabInfo = this._requestMonitor.tabInfo
            if (requestTabId) {
              _tabInfo = {} as any
              _tabInfo[requestTabId] =
                this._requestMonitor.tabInfo[requestTabId]
            }
            port.postMessage({
              type: 'init',
              data: _tabInfo,
            })
            break
          }
        }
      }
      port.onMessage.addListener(onMessage)
      this._networkInspectPorts.push(port)
      const disConnect = () => {
        port.onMessage.removeListener(onMessage)
        port.onDisconnect.removeListener(disConnect)
        let pos = 0
        while (pos >= 0) {
          pos = this._networkInspectPorts.indexOf(port)
          if (pos >= 0) {
            this._networkInspectPorts.splice(pos, 1)
          }
        }
      }
      port.onDisconnect.addListener(disConnect)
    })

    chrome.alarms.onAlarm.addListener((alarm: any) => {
      switch (alarm.name) {
        case 'omega.updateProfile':
          this.ready.then(() => {
            this.updateProfile()
          })
          break
      }
    })
    chrome.contextMenus?.onClicked.addListener((info: any, tab: any) => {
      this.ready.then(() => {
        switch (info.menuItemId) {
          case 'enableQuickSwitch': {
            const changes: any = {}
            changes['-enableQuickSwitch'] = info.checked
            const setOptions = this._setOptions(changes)
            if (info.checked && !this._quickSwitchCanEnable) {
              setOptions.then(() => {
                chrome.tabs.create(
                  { url: chrome.runtime.getURL('options.html#/ui') }
                )
              })
            }
            break
          }
        }
      })
    })

    chrome.action.onClicked.addListener((tab: any) => {
      if (browser?.proxy?.onRequest) {
        browser.permissions.request({ origins: ['<all_urls>'] })
      }
      this.ready.then(() => {
        this.clearBadge()
        if (!this._options['-enableQuickSwitch']) {
          chrome.tabs.create({ url: 'popup/index.html' })
          return
        }
        const profiles = this._options['-quickSwitchProfiles']
        let index = profiles.indexOf(this._currentProfileName)
        index = (index + 1) % profiles.length
        this.applyProfile(profiles[index]).then(() => {
          if (this._options['-refreshOnProfileChange']) {
            const url = tab.pendingUrl || tab.url
            if (!url) return
            if (url.substr(0, 6) == 'chrome') return
            if (url.substr(0, 6) == 'about:') return
            if (url.substr(0, 4) == 'moz-') return
            if (tab.pendingUrl) {
              chrome.tabs.update(tab.id, { url: url })
            } else {
              chrome.tabs.reload(tab.id)
            }
          }
        })
      })
    })
  }

  init(startupCheck: any) {
    super.init(startupCheck)
    this.ready.then(() => {
      chrome.storage.session
        .get(TEMPPROFILEKEY)
        .then((tempProfileState: any = {}) => {
          tempProfileState = tempProfileState[TEMPPROFILEKEY]
          if (tempProfileState) {
            this._tempProfile = tempProfileState._tempProfile
            this._tempProfile.rules.forEach((_rule: any) => {
              const key = OmegaPac.Profiles.nameAsKey(_rule.profileName)
              this._tempProfileRulesByProfile[key] =
                this._tempProfileRulesByProfile[key] || []
              this._tempProfileRulesByProfile[key].push(_rule)
              const condition = _rule.condition
              const domain = condition.pattern.substring(2)
              this._tempProfileRules[domain] = _rule
            })
            this._tempProfileActive = tempProfileState._tempProfileActive
            OmegaPac.Profiles.updateRevision(this._tempProfile)
            console.log('apply temp state profile', this._currentProfileName)
            this.applyProfile(this._currentProfileName)
          }
        })
    })
    return this.ready
  }

  addTempRule(domain: any, profileName: any, toggle: any) {
    return super.addTempRule(domain, profileName, toggle).then(() => {
      const _zeroState: any = {}
      _zeroState[TEMPPROFILEKEY] = {
        _tempProfile: this._tempProfile,
        _tempProfileActive: this._tempProfileActive,
      }
      chrome.storage.session.set(_zeroState)
    })
  }

  updateProfile(...args: any[]) {
    return super.updateProfile(...args).then((results: any) => {
      let error = false
      for (const [, result] of Object.entries(results)) {
        if (result instanceof Error) {
          error = true
          break
        }
      }
      if (error) {
        // TODO(catus): Find a better way to notify the user.
      }
      return results
    })
  }

  _proxyNotControllable: any = null
  proxyNotControllable() {
    return this._proxyNotControllable
  }
  setProxyNotControllable(reason: any, badge?: any) {
    this._proxyNotControllable = reason
    if (reason) {
      this._state.set({ proxyNotControllable: reason })
      this.setBadge(badge)
    } else {
      this._state.remove(['proxyNotControllable'])
      this.clearBadge()
    }
  }

  _badgeTitle: any = null
  setBadge(options?: any) {
    if (!options) {
      options = this._proxyNotControllable
        ? { text: '=', color: '#da4f49' }
        : { text: '?', color: '#49afcd' }
    }
    chrome.action.setBadgeText({ text: options.text })
    chrome.action.setBadgeBackgroundColor({ color: options.color })
    if (options.title) {
      this._badgeTitle = options.title
      chrome.action.setTitle({ title: options.title })
    } else {
      this._badgeTitle = null
    }
  }

  clearBadge() {
    if (this.externalApi.disabled) return
    if (this._badgeTitle) {
      this.currentProfileChanged('clearBadge')
    }
    if (this._proxyNotControllable) {
      this.setBadge()
    } else {
      chrome.action.setBadgeText?.({ text: '' })
    }
    return
  }

  _quickSwitchCanEnable = false
  setQuickSwitch(quickSwitch: any, canEnable: any) {
    this._quickSwitchCanEnable = canEnable
    if (quickSwitch) {
      chrome.action.setPopup({ popup: '' })
    } else {
      chrome.action.setPopup({ popup: (globalThis as any).POPUPHTMLURL })
    }

    chrome.contextMenus?.update('enableQuickSwitch', {
      checked: !!quickSwitch,
    })
    return Promise.resolve()
  }

  setInspect(settings: any) {
    if (this._inspect) {
      if (settings.showMenu) {
        this._inspect.enable()
      } else {
        this._inspect.disable()
      }
    }
    return Promise.resolve()
  }

  _requestMonitor: any = null
  _monitorWebRequests = false
  _tabRequestInfoPorts: any = null
  setMonitorWebRequests(enabled: any) {
    this._monitorWebRequests = enabled
    if (enabled && this._requestMonitor == null) {
      this._tabRequestInfoPorts = {}
      const wildcardForReq = (req: any) => OmegaPac.wildcardForUrl(req.url)
      this._requestMonitor = new WebRequestMonitor(wildcardForReq)
      this._requestMonitor.watchTabs(
        (tabId: any, info: any, req: any, status: any) => {
          if (!/^(chrome|moz)-extension:\/\//i.test(req?.url)) {
            const updateMessage = () => {
              this._networkInspectPorts.forEach((port: any) => {
                port.postMessage({
                  type: 'update',
                  data: {
                    tabId,
                    info,
                    req,
                    status,
                  },
                })
              })
            }
            if (status === 'start') {
              this._actionForUrl(req.url, { skipIcon: true }).then(
                (action: any) => {
                  const request = info.requests[req.requestId]
                  if (request) {
                    request.actionProfile = action
                    updateMessage()
                  }
                }
              )
            }
            updateMessage()
          }
          if (!this._monitorWebRequests) return
          if (info.errorCount > 0) {
            info.badgeSet = true
            const badge = {
              text: info.errorCount.toString(),
              color: '#f0ad4e',
            }
            chrome.action
              .setBadgeText({ text: badge.text, tabId: tabId })
              .catch((e: any) => {
                console.log('error:', e)
              })
            chrome.action
              .setBadgeBackgroundColor({
                color: badge.color,
                tabId: tabId,
              })
              .catch((e: any) => {
                console.log('error:', e)
              })
          } else if (info.badgeSet) {
            info.badgeSet = false
            chrome.action
              .setBadgeText({ text: '', tabId: tabId })
              .catch((e: any) => {
                console.log('error:', e)
              })
          }
          this._tabRequestInfoPorts[tabId]?.postMessage({
            errorCount: info.errorCount,
            summary: info.summary,
          })
        }
      )

      chrome.runtime.onConnect.addListener((rawPort: any) => {
        if (rawPort.name != 'tabRequestInfo') return
        if (!this._monitorWebRequests) return
        let tabId: any = null
        const port = new ChromePort(rawPort)
        port.onMessage.addListener((msg: any) => {
          tabId = msg.tabId
          this._tabRequestInfoPorts[tabId] = port
          const info = this._requestMonitor.tabInfo[tabId]
          if (info) {
            port.postMessage({
              errorCount: info.errorCount,
              summary: info.summary,
            })
          }
        })
        port.onDisconnect.addListener(() => {
          if (tabId != null) delete this._tabRequestInfoPorts[tabId]
        })
      })
    }
  }

  schedule(name: string, periodInMinutes: number) {
    name = 'omega.' + name
    if (periodInMinutes < 0) {
      chrome.alarms.clear(name)
    } else {
      chrome.alarms.create(name, {
        periodInMinutes: periodInMinutes,
      })
    }
    return Promise.resolve()
  }

  printFixedProfile(profile: any) {
    if (profile.profileType != 'FixedProfile') return
    let result = ''
    for (const scheme of OmegaPac.Profiles.schemes) {
      if (profile[scheme.prop]) {
        const pacResult = OmegaPac.Profiles.pacResult(profile[scheme.prop])
        if (scheme.scheme) {
          result += `${scheme.scheme}: ${pacResult}\n`
        } else {
          result += `${pacResult}\n`
        }
      }
    }
    result ||= chrome.i18n.getMessage(
      'browserAction_profileDetails_DirectProfile'
    )
    return result
  }

  printProfile(profile: any) {
    let type = profile.profileType
    if (type.indexOf('RuleListProfile') >= 0) {
      type = 'RuleListProfile'
    }

    if (type == 'FixedProfile') {
      return this.printFixedProfile(profile)
    } else if (type == 'PacProfile' && profile.pacUrl) {
      return profile.pacUrl
    } else {
      return (
        chrome.i18n.getMessage('browserAction_profileDetails_' + type) || null
      )
    }
  }

  upgrade(options: any, changes?: any) {
    return super.upgrade(options).catch((err: any) => {
      if (options?.['schemaVersion']) return Promise.reject(err)
      return Promise.reject(new OmegaTarget.Options.NoOptionsError())
    })
  }

  onFirstRun(reason: any) {
    console.log('first run ....')
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') })
  }

  getPageInfo({ tabId, url }: { tabId: any; url: string }) {
    const errorCount = this._requestMonitor?.tabInfo[tabId]?.errorCount
    const result = errorCount ? { errorCount: errorCount } : null
    const getBadge = new Promise((resolve: any) => {
      if (!chrome.action.getBadgeText) {
        resolve('')
        return
      }
      chrome.action.getBadgeText({ tabId: tabId }, (result: any) => {
        resolve(result)
      })
    })

    const getInspectUrl = this._state.get({ inspectUrl: '' })
    return Promise.all([getBadge, getInspectUrl]).then(
      ([badge, { inspectUrl }]: any) => {
        if (badge == '#' && inspectUrl) {
          url = inspectUrl
        } else {
          this.clearBadge()
        }
        if (!url) return result
        if (url.substr(0, 6) == 'chrome') {
          const errorPagePrefix = 'chrome://errorpage/'
          if (url.substr(0, errorPagePrefix.length) == errorPagePrefix) {
            url =
              new URLSearchParams(
                url.substr(url.indexOf('?') + 1)
              ).get('lasturl') || ''
            if (!url) return result
          } else {
            return result
          }
        }
        if (url.substr(0, 6) == 'about:') return result
        if (url.substr(0, 4) == 'moz-') return result
        const domain = OmegaPac.getBaseDomain(new URL(url).hostname)
        const subdomain = OmegaPac.getSubdomain(url)

        return {
          url: url,
          domain: domain,
          subdomain: subdomain,
          tempRuleProfileName: this.queryTempRule(domain),
          errorCount: errorCount,
        }
      }
    )
  }
}

export = ChromeOptions
