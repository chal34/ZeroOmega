declare const browser: any

const OmegaTarget = require('omega-target') as any
import ProxyImpl = require('./proxy_impl')

class ScriptProxyImpl extends ProxyImpl {
  features = ['socks5Auth']
  _proxyScriptUrl = 'js/omega_webext_proxy_script.min.js'
  _proxyScriptDisabled = false
  _proxyScriptInitialized = false
  _proxyScriptState: any = {}
  _options: any

  static isSupported() {
    return !!(
      typeof browser !== 'undefined' &&
      (browser?.proxy?.register || browser?.proxy?.registerProxyScript)
    )
  }

  watchProxyChange(callback: any) {
    return null
  }

  applyProfile(profile: any, state?: any, options?: any) {
    this.log.error(
      'Your browser is outdated! Full-URL based matching, etc. unsupported! ' +
        'Please update your browser ASAP!'
    )
    state = state ?? {}
    this._options = options
    state.currentProfileName = profile.name
    if (profile.name == '') {
      state.tempProfile = profile
    }
    if (profile.profileType == 'SystemProfile') {
      if (browser.proxy.unregister) {
        browser.proxy.unregister()
      } else {
        browser.proxy.registerProxyScript(
          'js/omega_invalid_proxy_script.js'
        )
      }
      this._proxyScriptDisabled = true
    } else {
      this._proxyScriptState = state
      Promise.all([
        browser.runtime.getBrowserInfo(),
        this._initWebextProxyScript(),
      ]).then(([info]: any) => {
        if (
          info.vendor == 'Mozilla' &&
          info.buildID < '20170918220054'
        ) {
          this.log.error(
            'Your browser is outdated! SOCKS5 DNS/Auth unsupported! ' +
              `Please update your browser ASAP! (Current Build ${info.buildID})`
          )
          this._proxyScriptState.useLegacyStringReturn = true
        }
        this._proxyScriptStateChanged()
      })
    }
    return this.setProxyAuth(profile, options)
  }

  _initWebextProxyScript() {
    if (!this._proxyScriptInitialized) {
      browser.proxy.onProxyError.addListener((err: any) => {
        if (err?.message) {
          if (
            err.message.indexOf('Invalid Proxy Rule: DIRECT') >= 0
          ) {
            return
          }
          if (
            err.message.indexOf(
              'Return type must be a string'
            ) >= 0
          ) {
            this.log.error(
              'Your browser is outdated! SOCKS5 DNS/Auth unsupported! ' +
                'Please update your browser ASAP!'
            )
            this._proxyScriptState.useLegacyStringReturn = true
            this._proxyScriptStateChanged()
            return
          }
        }
        this.log.error(err)
      })
      browser.runtime.onMessage.addListener((message: any) => {
        if (message.event != 'proxyScriptLog') return
        if (message.level == 'error') {
          this.log.error(message)
        } else if (message.level == 'warn') {
          this.log.error(message)
        } else {
          this.log.log(message)
        }
      })
    }

    let promise: Promise<void>
    if (!this._proxyScriptInitialized || this._proxyScriptDisabled) {
      promise = new Promise<void>((resolve) => {
        const onMessage = (message: any) => {
          if (message.event != 'proxyScriptLoaded') return
          resolve()
          browser.runtime.onMessage.removeListener(onMessage)
          return
        }
        browser.runtime.onMessage.addListener(onMessage)
      })
      if (browser.proxy.register) {
        browser.proxy.register(this._proxyScriptUrl)
      } else {
        browser.proxy.registerProxyScript(this._proxyScriptUrl)
      }
      this._proxyScriptDisabled = false
    } else {
      promise = Promise.resolve()
    }
    this._proxyScriptInitialized = true
    return promise
  }

  _proxyScriptStateChanged() {
    browser.runtime.sendMessage(
      {
        event: 'proxyScriptStateChanged',
        state: this._proxyScriptState,
        options: this._options,
      },
      {
        toProxyScript: true,
      }
    )
  }
}

export = ScriptProxyImpl
