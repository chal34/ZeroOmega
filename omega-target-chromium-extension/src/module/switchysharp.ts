declare const chrome: any

const OmegaTarget = require('omega-target') as any
const OmegaPac = OmegaTarget.OmegaPac
import ChromePort = require('./chrome_port')

class SwitchySharp {
  static extId = 'dpplabbmogkhghncfbfdeeokoefdjegm'
  port: any = null

  _getOptions: any = null
  _getOptionsResolver: any = null
  _monitorTimerId: any = null

  monitor(action?: string) {
    if (location.href.substr(0, 4) == 'moz-') return
    if (this.port == null && !this._monitorTimerId) {
      this._monitorTimerId = setInterval(this._connect.bind(this), 5000)
      if (action != 'reconnect') {
        this._connect()
      }
    }
  }

  getOptions() {
    if (!this._getOptions) {
      this._getOptions = new Promise((resolve: any) => {
        this._getOptionsResolver = resolve
        this.monitor()
      })
    }
    return this._getOptions
  }

  _onMessage(msg: any) {
    if (this._monitorTimerId) {
      clearInterval(this._monitorTimerId)
      this._monitorTimerId = null
    }
    switch (msg?.action) {
      case 'state':
        OmegaTarget.Log.log(msg)
        if (this._getOptionsResolver) {
          this.port.postMessage({ action: 'getOptions' })
        }
        break
      case 'options':
        this._getOptionsResolver?.(msg.options)
        this._getOptionsResolver = null
        break
    }
  }

  _onDisconnect(msg: any) {
    this.port = null
    this._getOptions = null
    this._getOptionsResolver = null
    this.monitor('reconnect')
  }

  _connect() {
    if (!this.port) {
      this.port = new ChromePort(
        chrome.runtime.connect(SwitchySharp.extId)
      )
      this.port.onDisconnect.addListener(this._onDisconnect.bind(this))
      this.port?.onMessage.addListener(this._onMessage.bind(this))
    }
    try {
      this.port.postMessage({ action: 'disable' })
    } catch (_) {
      this.port = null
    }
    return this.port != null
  }
}

export = SwitchySharp
