declare const chrome: any

const OmegaTarget = require('omega-target') as any
const OmegaPac = OmegaTarget.OmegaPac

class ProxyAuth {
  _requests: Record<string, any> = {}
  _proxies: Record<string, any[]> = {}
  _fallbacks: any[] = []
  log: any
  listening = false

  constructor(log: any) {
    this._requests = {}
    this.log = log
  }

  listen() {
    if (this.listening) return
    if (!chrome.webRequest) {
      this.log.error('Proxy auth disabled! No webRequest permission.')
      return
    }
    if (!chrome.webRequest.onAuthRequired) {
      this.log.error(
        'Proxy auth disabled! onAuthRequired not available.'
      )
      return
    }
    chrome.webRequest.onAuthRequired.addListener(
      this.authHandler.bind(this),
      { urls: ['<all_urls>'] },
      ['blocking']
    )
    chrome.webRequest.onCompleted.addListener(
      this._requestDone.bind(this),
      { urls: ['<all_urls>'] }
    )
    chrome.webRequest.onErrorOccurred.addListener(
      this._requestDone.bind(this),
      { urls: ['<all_urls>'] }
    )
    this.listening = true
  }

  _keyForProxy(proxy: any) {
    return `${proxy.host.toLowerCase()}:${proxy.port}`
  }

  setProxies(profiles: any[]) {
    this._proxies = {}
    this._fallbacks = []
    for (const profile of profiles) {
      if (!profile.auth) continue
      for (const scheme of OmegaPac.Profiles.schemes) {
        if (!profile[scheme.prop]) continue
        const auth = profile.auth?.[scheme.prop]
        if (!auth) continue
        const proxy = profile[scheme.prop]
        const key = this._keyForProxy(proxy)
        let list = this._proxies[key]
        if (list == null) {
          this._proxies[key] = list = []
        }
        list.push({
          config: proxy,
          auth: auth,
          name: profile.name + '.' + scheme.prop,
        })
      }

      const fallback = profile.auth?.['all']
      if (fallback != null) {
        this._fallbacks.push({
          auth: fallback,
          name: profile.name + '.all',
        })
      }
    }
  }

  authHandler(details: any) {
    if (!details.isProxy) return {}
    let req = this._requests[details.requestId]
    if (req == null) {
      this._requests[details.requestId] = req = { authTries: 0 }
    }

    const key = this._keyForProxy({
      host: details.challenger.host,
      port: details.challenger.port,
    })

    const list = this._proxies[key]
    const listLen = list != null ? list.length : 0
    let proxy
    if (req.authTries < listLen) {
      proxy = list![req.authTries]
    } else {
      proxy = this._fallbacks[req.authTries - listLen]
    }
    this.log.log('ProxyAuth', key, req.authTries, proxy?.name)

    if (proxy == null) return {}
    req.authTries++
    return { authCredentials: proxy.auth }
  }

  _requestDone(details: any) {
    delete this._requests[details.requestId]
  }
}

export = ProxyAuth
