declare const chrome: any

class ChromeTabs {
  _defaultAction: any = null
  _badgeTab: any = null
  actionForUrl: any
  _dirtyTabs: Record<string, any> = {}

  constructor(actionForUrl: any) {
    this.actionForUrl = actionForUrl
    this._dirtyTabs = {}
  }

  ignoreError() {
    void chrome.runtime.lastError
  }

  watch() {
    chrome.tabs.onUpdated.addListener(this.onUpdated.bind(this))
    chrome.tabs.onActivated.addListener((info: any) => {
      chrome.tabs.get(info.tabId, (tab: any) => {
        if (chrome.runtime.lastError) return
        if (this._dirtyTabs.hasOwnProperty(info.tabId)) {
          this.onUpdated(tab.id, {}, tab)
        }
      })
    })
  }

  resetAll(action: any) {
    this._defaultAction = action
    chrome.tabs.query({}, (tabs: any[]) => {
      this._dirtyTabs = {}
      tabs.forEach((tab: any) => {
        this._dirtyTabs[tab.id] = tab.id
        if (tab.active) this.onUpdated(tab.id, {}, tab)
      })
    })
    const title = this._canSetPopup() ? action.title : action.shortTitle
    chrome.action.setTitle({ title: title })
    this.setIcon(action.icon)
  }

  onUpdated(tabId: any, changeInfo: any, tab: any) {
    if (this._dirtyTabs.hasOwnProperty(tab.id)) {
      delete this._dirtyTabs[tab.id]
    } else if (changeInfo.url == null && changeInfo.status == 'complete') {
      return
    }
    this.processTab(tab, changeInfo)
  }

  processTab(tab: any, changeInfo?: any) {
    if (this._badgeTab) {
      for (const id of Object.keys(this._badgeTab)) {
        try {
          chrome.action.setBadgeText?.({ text: '', tabId: id })
        } catch (_) {
          // ignore
        }
        this._badgeTab = null
      }
    }

    if (tab.url == null || tab.url.indexOf('chrome') == 0) {
      if (this._defaultAction) {
        chrome.action.setTitle({
          title: this._defaultAction.title,
          tabId: tab.id,
        })
        this.clearIcon(tab.id)
      }
      return
    }
    this.actionForUrl(tab.url)
      .then((action: any) => {
        if (!action) {
          this.clearIcon(tab.id)
          chrome.action.setBadgeText?.({ text: '', tabId: tab.id })
          return
        }
        this.setIcon(action.icon, tab.id)
        const title = this._canSetPopup() ? action.title : action.shortTitle
        if (action.badgeText) {
          chrome.action.setBadgeText?.({
            text: action.badgeText,
            tabId: tab.id,
          })
        }
        return chrome.action.setTitle({ title: title, tabId: tab.id })
      })
      .catch((e: any) => {
        console.log('error:', e)
      })
  }

  setTabBadge(tab: any, badge: any) {
    this._badgeTab ??= {}
    this._badgeTab[tab.id] = true
    chrome.action.setBadgeText?.({ text: badge.text, tabId: tab.id })
    chrome.action.setBadgeBackgroundColor?.({
      color: badge.color,
      tabId: tab.id,
    })
  }

  setIcon(icon: any, tabId?: any) {
    if (icon == null) return
    const params: any = {
      imageData: icon,
    }
    if (tabId != null) params.tabId = tabId
    this._chromeSetIcon(params)
  }

  _canSetPopup() {
    return chrome.action.setPopup
  }

  _chromeSetIcon(params: any) {
    try {
      chrome.action.setIcon?.(params, this.ignoreError)
    } catch (_) {
      params.imageData = { 19: params.imageData[19], 38: params.imageData[38] }
      chrome.action.setIcon?.(params, this.ignoreError)
    }
  }

  clearIcon(tabId: any) {
    if (!this._defaultAction?.icon) return
    this._chromeSetIcon({
      imageData: this._defaultAction.icon,
      tabId: tabId,
    })
  }
}

export = ChromeTabs
