// Service worker has no `window` or `global`; polyfill for libraries that expect them
if (!(globalThis as any).window) {
  ;(globalThis as any).window = globalThis
  ;(globalThis as any).global = globalThis
}
;(window as any).UglifyJS_NoUnsafeEval = true

function initContextMenu() {
  if (!chrome.contextMenus) return
  chrome.contextMenus.removeAll()
  chrome.contextMenus.create({
    id: 'enableQuickSwitch',
    title: chrome.i18n.getMessage('contextMenu_enableQuickSwitch'),
    type: 'checkbox',
    checked: false,
    contexts: ['action'],
  })

  chrome.contextMenus.create({
    id: 'network',
    title: 'Network monitor',
    contexts: ['action'],
  })
  chrome.contextMenus.create({
    id: 'tempRulesManager',
    title: 'Temp Rules Manager',
    contexts: ['action'],
  })
  chrome.contextMenus.create({
    id: 'reportIssue',
    title: chrome.i18n.getMessage('popup_reportIssues'),
    contexts: ['action'],
  })
  chrome.contextMenus.create({
    id: 'reload',
    title: chrome.i18n.getMessage('popup_Reload'),
    contexts: ['action'],
  })
  if (!!(globalThis as any).localStorage) {
    chrome.contextMenus.create({
      id: 'options',
      title: chrome.i18n.getMessage('popup_showOptions'),
      contexts: ['action'],
    })
  }
}

initContextMenu()

chrome.contextMenus?.onClicked.addListener((info: any, tab: any) => {
  switch (info.menuItemId) {
    case 'network': {
      const url =
        chrome.runtime.getURL('popup/network/index.html?tabId=') +
        tab.id
      chrome.tabs.create({ url: url })
      break
    }
    case 'tempRulesManager': {
      const url = chrome.runtime.getURL(
        'popup/temp_rules/index.html'
      )
      chrome.tabs.query({ url: url }, (tabs: any[]) => {
        if (tabs.length > 0) {
          const props = { active: true }
          chrome.tabs.update(tabs[0].id, props)
        } else {
          chrome.tabs.create({ url: url })
        }
      })
      break
    }
    case 'options':
      browser.runtime.openOptionsPage()
      break
    case 'reload':
      chrome.runtime.reload()
      break
    case 'reportIssue':
      OmegaDebug.reportIssue()
      break
  }
})
