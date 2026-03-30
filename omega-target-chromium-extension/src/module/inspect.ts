declare const chrome: any

class Inspect {
  _enabled = false
  onInspect: any

  propForMenuItem: Record<string, string> = {
    inspectFrame: 'frameUrl',
    inspectLink: 'linkUrl',
    inspectElement: 'srcUrl',
  }

  constructor(onInspect: any) {
    this.onInspect = onInspect
  }

  enable() {
    if (!chrome.contextMenus) return
    if (!chrome.i18n.getUILanguage) return
    if (this._enabled) return

    const webResource = ['http://*/*', 'https://*/*', 'ftp://*/*']

    chrome.contextMenus.create({
      id: 'inspectFrame',
      title: chrome.i18n.getMessage('contextMenu_inspectFrame'),
      contexts: ['frame'],
      documentUrlPatterns: webResource,
    })

    chrome.contextMenus.create({
      id: 'inspectLink',
      title: chrome.i18n.getMessage('contextMenu_inspectLink'),
      contexts: ['link'],
      targetUrlPatterns: webResource,
    })

    chrome.contextMenus.create({
      id: 'inspectElement',
      title: chrome.i18n.getMessage('contextMenu_inspectElement'),
      contexts: ['image', 'video', 'audio'],
      targetUrlPatterns: webResource,
    })

    this._enabled = true
  }

  disable() {
    if (!this._enabled) return
    for (const menuId of Object.keys(this.propForMenuItem)) {
      try {
        chrome.contextMenus.remove(menuId)
      } catch (_) {
        // ignore
      }
    }
    this._enabled = false
  }

  inspect(info: any, tab: any) {
    if (!info.menuItemId) return
    let url = info[this.propForMenuItem[info.menuItemId]]
    if (!url && info.menuItemId == 'inspectPage') {
      url = tab.url
    }
    if (!url) return

    this.onInspect(url, tab)
  }
}

export = Inspect
