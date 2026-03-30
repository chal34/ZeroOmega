declare const chrome: any
declare const browser: any

const OmegaTarget = require('omega-target') as any
const OmegaPac = OmegaTarget.OmegaPac
import { chromeApiPromisify } from '../chrome_api'
import ProxyImpl = require('./proxy_impl')

const notExistentWebsite =
  'preflight-auth.non-existent-website.zzzzzzzzeroomega.zero'

function getFirstAuthProfile(profile: any, options: any) {
  for (const rule of profile.rules) {
    const profileName = rule.profileName
    const _profile = OmegaPac.Profiles.byName(profileName, options)
    if (_profile?.auth) return _profile
  }
}

function addAuthPreflightRule(profile: any, options: any) {
  if (profile.profileType !== 'SwitchProfile') return
  if (!profile.rules || profile.rules.length === 0) return
  const authProfile = getFirstAuthProfile(profile, options)
  if (!authProfile) return
  profile.rules.unshift({
    condition: {
      conditionType: 'HostWildcardCondition',
      pattern: notExistentWebsite,
    },
    isPreflightRule: true,
    profileName: authProfile.name,
  })
  return authProfile
}

class SettingsProxyImpl extends ProxyImpl {
  features = ['fullUrlHttp', 'pacScript', 'watchProxyChange']
  _proxyChangeWatchers: any[] | null = null

  static isSupported() {
    return !!(
      typeof chrome !== 'undefined' && chrome?.proxy?.settings
    )
  }

  applyProfile(profile: any, meta?: any, options?: any) {
    meta ??= profile
    if (profile.profileType == 'SystemProfile') {
      return chromeApiPromisify(chrome.proxy.settings, 'clear')({}).then(
        () => {
          chrome.proxy.settings.get({}, this._proxyChangeListener)
          return
        }
      )
    }
    let authProfile: any = null
    let config: any = {}
    if (profile.profileType == 'DirectProfile') {
      config['mode'] = 'direct'
    } else if (profile.profileType == 'PacProfile') {
      config['mode'] = 'pac_script'

      config['pacScript'] =
        !profile.pacScript || OmegaPac.Profiles.isFileUrl(profile.pacUrl)
          ? { url: profile.pacUrl, mandatory: true }
          : {
              data: OmegaPac.PacGenerator.ascii(profile.pacScript),
              mandatory: true,
            }
    } else if (profile.profileType == 'FixedProfile') {
      config = this._fixedProfileConfig(profile)
    } else {
      config['mode'] = 'pac_script'
      authProfile = addAuthPreflightRule(profile, options)
      config['pacScript'] = {
        mandatory: true,
        data: this.getProfilePacScript(profile, meta, options),
      }
    }
    return this.setProxyAuth(profile, options)
      .then(() => {
        return chromeApiPromisify(chrome.proxy.settings, 'set')({
          value: config,
        })
      })
      .then(() => {
        if (authProfile) {
          fetch('https://' + notExistentWebsite).catch(
            () => authProfile
          )
        }
        chrome.proxy.settings.get({}, this._proxyChangeListener)
        return
      })
      .finally(() => {
        if (authProfile) {
          profile.rules.forEach((rule: any, index: number) => {
            if (rule.isPreflightRule) {
              profile.rules.splice(index, 1)
            }
          })
          return profile.rules
        }
      })
  }

  _fixedProfileConfig(profile: any) {
    const config: any = {}
    config['mode'] = 'fixed_servers'
    const rules: any = {}
    const protocols = ['proxyForHttp', 'proxyForHttps', 'proxyForFtp']
    let protocolProxySet = false
    for (const protocol of protocols) {
      if (profile[protocol] != null) {
        rules[protocol] = profile[protocol]
        protocolProxySet = true
      }
    }

    if (profile.fallbackProxy) {
      if (profile.fallbackProxy.scheme == 'http') {
        if (!protocolProxySet) {
          rules['singleProxy'] = profile.fallbackProxy
        } else {
          for (const protocol of protocols) {
            rules[protocol] ??= JSON.parse(
              JSON.stringify(profile.fallbackProxy)
            )
          }
        }
      } else {
        rules['fallbackProxy'] = profile.fallbackProxy
      }
    } else if (!protocolProxySet) {
      config['mode'] = 'direct'
    }

    if (config['mode'] != 'direct') {
      rules['bypassList'] = [] as string[]
      const bypassList = rules['bypassList']
      for (const condition of profile.bypassList) {
        bypassList.push(this._formatBypassItem(condition))
      }
      config['rules'] = rules
    }
    return config
  }

  _formatBypassItem(condition: any) {
    const str = OmegaPac.Conditions.str(condition)
    const i = str.indexOf(' ')
    return str.substr(i + 1)
  }

  _proxyChangeListener = (details: any) => {
    for (const watcher of this._proxyChangeWatchers ?? []) {
      watcher(details)
    }
  }

  watchProxyChange(callback: any) {
    if (this._proxyChangeWatchers == null) {
      this._proxyChangeWatchers = []
      if (chrome?.proxy?.settings?.onChange) {
        chrome.proxy.settings.onChange.addListener(
          this._proxyChangeListener.bind(this)
        )
      }
    }
    this._proxyChangeWatchers.push(callback)
    return
  }

  parseExternalProfile(details: any, options: any) {
    if (details.name) {
      return details
    }
    switch (details.value.mode) {
      case 'system':
        return OmegaPac.Profiles.byName('system')
      case 'direct':
        return OmegaPac.Profiles.byName('direct')
      case 'auto_detect':
        return OmegaPac.Profiles.create({
          profileType: 'PacProfile',
          name: '',
          pacUrl: 'http://wpad/wpad.dat',
        })
      case 'pac_script': {
        const url = details.value.pacScript.url
        if (url) {
          let profile: any = null
          OmegaPac.Profiles.each(options, (key: string, p: any) => {
            if (p.profileType == 'PacProfile' && p.pacUrl == url) {
              profile = p
            }
          })
          return (
            profile ??
            OmegaPac.Profiles.create({
              profileType: 'PacProfile',
              name: '',
              pacUrl: url,
            })
          )
        } else {
          let profile: any = null
          const script = details.value.pacScript.data
          OmegaPac.Profiles.each(options, (key: string, p: any) => {
            if (
              p.profileType == 'PacProfile' &&
              p.pacScript == script
            ) {
              profile = p
            }
          })
          if (profile) return profile
          const trimmedScript = script.trim()
          const magic = '/*OmegaProfile*'
          if (trimmedScript.substr(0, magic.length) == magic) {
            const end = trimmedScript.indexOf('*/')
            if (end > 0) {
              const tokens = trimmedScript
                .substring(magic.length, end)
                .split('*')
              let [profileName, revision] = tokens
              try {
                profileName = JSON.parse(profileName)
              } catch (_) {
                profileName = null
              }
              if (profileName && revision) {
                profile = OmegaPac.Profiles.byName(
                  profileName,
                  options
                )
                if (
                  OmegaPac.Revision.compare(
                    profile.revision,
                    revision
                  ) == 0
                ) {
                  return profile
                }
              }
            }
          }
          return OmegaPac.Profiles.create({
            profileType: 'PacProfile',
            name: '',
            pacScript: script,
          })
        }
      }
      case 'fixed_servers': {
        const props = [
          'proxyForHttp',
          'proxyForHttps',
          'proxyForFtp',
          'fallbackProxy',
          'singleProxy',
        ]
        const proxies: any = {}
        for (const prop of props) {
          const result = OmegaPac.Profiles.pacResult(
            details.value.rules[prop]
          )
          if (
            prop == 'singleProxy' &&
            details.value.rules[prop] != null
          ) {
            proxies['fallbackProxy'] = result
          } else {
            proxies[prop] = result
          }
        }
        const bypassSet: any = {}
        let bypassCount = 0
        if (details.value.rules.bypassList) {
          for (const pattern of details.value.rules.bypassList) {
            bypassSet[pattern] = true
            bypassCount++
          }
        }
        if (bypassSet['<local>']) {
          for (const host of OmegaPac.Conditions.localHosts) {
            if (bypassSet[host]) {
              delete bypassSet[host]
              bypassCount--
            }
          }
        }
        let profile: any = null
        OmegaPac.Profiles.each(options, (key: string, p: any) => {
          if (p.profileType != 'FixedProfile') return
          if (p.bypassList.length != bypassCount) return
          for (const condition of p.bypassList) {
            if (!bypassSet[condition.pattern]) return
          }
          const rules = this._fixedProfileConfig(p).rules
          if (rules['singleProxy']) {
            rules['fallbackProxy'] = rules['singleProxy']
            delete rules['singleProxy']
          }
          if (!rules) return
          for (const prop of props) {
            if (rules[prop] || proxies[prop]) {
              if (
                OmegaPac.Profiles.pacResult(rules[prop]) !=
                proxies[prop]
              ) {
                return
              }
            }
          }
          profile = p
        })
        if (profile) {
          return profile
        } else {
          profile = OmegaPac.Profiles.create({
            profileType: 'FixedProfile',
            name: '',
          })
          for (const prop of props) {
            if (details.value.rules[prop]) {
              if (prop == 'singleProxy') {
                profile['fallbackProxy'] = details.value.rules[prop]
              } else {
                profile[prop] = details.value.rules[prop]
              }
            }
          }
          profile.bypassList = Object.keys(bypassSet).map(
            (pattern) => ({
              conditionType: 'BypassCondition',
              pattern: pattern,
            })
          )
          return profile
        }
      }
    }
  }
}

export = SettingsProxyImpl
