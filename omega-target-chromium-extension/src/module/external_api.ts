declare const chrome: any

const OmegaTarget = require('omega-target') as any
const OmegaPac = OmegaTarget.OmegaPac
import ChromePort = require('./chrome_port')

class ExternalApi {
  options: any
  knownExts: Record<string, number> = {
    padekgcemlokbadohgkifijomclgjgif: 32,
  }
  disabled = false
  _previousProfileName: string | null = null

  constructor(options: any) {
    this.options = options
  }

  listen() {
    if (!chrome.runtime.onConnectExternal) return
    chrome.runtime.onConnectExternal.addListener((rawPort: any) => {
      const port = new ChromePort(rawPort)
      port.onMessage.addListener((msg: any) => this.onMessage(msg, port))
      port.onDisconnect.addListener(this.reenable.bind(this))
    })
  }

  reenable() {
    if (!this.disabled) return

    this.options.setProxyNotControllable(null)
    chrome.action.setPopup?.({ popup: (globalThis as any).POPUPHTMLURL })
    this.options.reloadQuickSwitch()
    this.disabled = false
    this.options.clearBadge()
    this.options.applyProfile(this._previousProfileName)
  }

  checkPerm(port: any, level: number) {
    const perm = this.knownExts[port.sender.id] || 0
    if (perm < level) {
      port.postMessage({ action: 'error', error: 'permission' })
      return false
    } else {
      return true
    }
  }

  onMessage(msg: any, port: any) {
    this.options.log.log(`${port.sender.id} -> ${msg.action}`, msg)
    switch (msg.action) {
      case 'disable':
        if (!this.checkPerm(port, 16)) return
        if (this.disabled) return
        this.disabled = true
        this._previousProfileName =
          this.options.currentProfile()?.name || 'system'
        this.options.applyProfile('system').then(() => {
          let reason = 'disabled'
          if (this.knownExts[port.sender.id] >= 32) {
            reason = 'upgrade'
          }
          this.options.setProxyNotControllable(reason, {
            text: 'X',
            color: '#5ab432',
          })
        })
        chrome.action.setPopup?.({ popup: 'popup-iframe.html' })
        port.postMessage({ action: 'state', state: 'disabled' })
        break
      case 'enable':
        this.reenable()
        port.postMessage({ action: 'state', state: 'enabled' })
        break
      case 'getOptions':
        if (!this.checkPerm(port, 8)) return
        port.postMessage({
          action: 'options',
          options: this.options.getAll(),
        })
        break
      default:
        port.postMessage({
          action: 'error',
          error: 'noSuchAction',
          action_name: msg.action,
        })
    }
  }
}

export = ExternalApi
