declare const browser: any

const OmegaTarget = require('omega-target') as any
const OmegaPac = OmegaTarget.OmegaPac
import ProxyImpl = require('./proxy_impl')

class ListenerProxyImpl extends ProxyImpl {
  features = ['fullUrl', 'socks5Auth']
  _optionsReady: Promise<void>
  _optionsReadyCallback: (() => void) | null = null
  _options: any
  _profile: any

  static isSupported() {
    return !!(typeof browser !== 'undefined' && browser?.proxy?.onRequest)
  }

  constructor(log: any) {
    super(log)
    this._optionsReady = new Promise<void>((resolve) => {
      this._optionsReadyCallback = resolve
    })
    this._initRequestListeners()
  }

  _initRequestListeners() {
    browser.proxy.onRequest.addListener(this.onRequest.bind(this), {
      urls: ['<all_urls>'],
    })
    browser.proxy.onError.addListener(this.onError.bind(this))
  }

  watchProxyChange(callback: any) {
    return null
  }

  applyProfile(profile: any, state?: any, options?: any) {
    this._options = options
    this._profile = profile
    this._optionsReadyCallback?.()
    this._optionsReadyCallback = null
    return this.setProxyAuth(profile, options)
  }

  onRequest(requestDetails: any) {
    return Promise.resolve(
      this._optionsReady.then(() => {
        const request = OmegaPac.Conditions.requestFromUrl(
          requestDetails.url
        )
        let profile = this._profile
        let next: string = ''
        while (profile) {
          const result = OmegaPac.Profiles.match(profile, request)
          if (!result) {
            switch (profile.profileType) {
              case 'DirectProfile':
                return { type: 'direct' }
              case 'SystemProfile':
                return undefined
              default:
                throw new Error(
                  'Unsupported profile: ' + profile.profileType
                )
            }
          }
          if (Array.isArray(result)) {
            const proxy = result[2]
            const auth = result[3]
            if (proxy) return this.proxyInfo(proxy, auth)
            next = result[0]
          } else if (result.profileName) {
            next = OmegaPac.Profiles.nameAsKey(result.profileName)
          } else {
            break
          }
          profile = OmegaPac.Profiles.byKey(next, this._options)
        }

        throw new Error('Profile not found: ' + next)
      })
    )
  }

  onError(error: any) {
    this.log.error(error)
  }

  proxyInfo(proxy: any, auth: any) {
    const proxyInfo: any = {
      type: proxy.scheme,
      host: proxy.host,
      port: proxy.port,
    }
    if (proxyInfo.type == 'socks5') {
      proxyInfo.type = 'socks'
      if (auth) {
        proxyInfo.username = auth.username
        proxyInfo.password = auth.password
      }
    }
    if (proxyInfo.type == 'socks') {
      proxyInfo.proxyDNS = true
    }

    return [proxyInfo]
  }
}

export = ListenerProxyImpl
