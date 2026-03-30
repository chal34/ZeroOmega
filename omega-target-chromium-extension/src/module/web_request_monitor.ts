declare const chrome: any

const Heap = require('heap')
const OmegaPac = (require('omega-target') as any).OmegaPac

const MAXREQUESTCACHE = 1000

class WebRequestMonitor {
  getSummaryId: any
  _requests: Record<string, any> = {}
  _recentRequests: any
  _callbacks: any[] = []
  _tabCallbacks: any[] = []
  tabInfo: Record<string, any> = {}
  watching = false
  timer: any = null
  tabsWatching = false

  eventCategory: Record<string, string> = {
    start: 'ongoing',
    ongoing: 'ongoing',
    timeout: 'error',
    error: 'error',
    timeoutAbort: 'error',
    done: 'done',
  }

  constructor(getSummaryId: any) {
    this.getSummaryId = getSummaryId
    this._requests = {}
    this._recentRequests = new Heap((a: any, b: any) => a._startTime - b._startTime)
    this._callbacks = []
    this._tabCallbacks = []
    this.tabInfo = {}
  }

  watch(callback: any) {
    this._callbacks.push(callback)
    if (this.watching) return
    if (!chrome.webRequest) {
      console.log('Request monitor disabled! No webRequest permission.')
      return
    }
    chrome.webRequest.onBeforeRequest.addListener(
      this._requestStart.bind(this),
      { urls: ['<all_urls>'] }
    )
    chrome.webRequest.onHeadersReceived.addListener(
      this._requestHeadersReceived.bind(this),
      { urls: ['<all_urls>'] }
    )
    chrome.webRequest.onBeforeRedirect.addListener(
      this._requestRedirected.bind(this),
      { urls: ['<all_urls>'] }
    )
    const extraInfoSpec: string[] = ['responseHeaders']
    if (!globalThis.localStorage) {
      extraInfoSpec.push('extraHeaders')
    }
    chrome.webRequest.onCompleted.addListener(
      this._requestDone.bind(this),
      { urls: ['<all_urls>'] },
      extraInfoSpec
    )
    chrome.webRequest.onErrorOccurred.addListener(
      this._requestError.bind(this),
      { urls: ['<all_urls>'] }
    )
    this.watching = true
  }

  _requestStart(req: any) {
    if (req.tabId < 0) return
    req._startTime = Date.now()
    this._requests[req.requestId] = req
    this._recentRequests.push(req)
    this.timer ??= setInterval(this._tick.bind(this), 1000)
    for (const callback of this._callbacks) {
      callback('start', req)
    }
  }

  _tick() {
    const now = Date.now()
    let req: any
    while ((req = this._recentRequests.peek())) {
      const reqInfo = this._requests[req.requestId]
      if (reqInfo && !reqInfo.noTimeout) {
        if (now - req._startTime < 5000) {
          break
        } else {
          reqInfo.timeoutCalled = true
          for (const callback of this._callbacks) {
            callback('timeout', reqInfo)
          }
        }
      }
      this._recentRequests.pop()
    }
  }

  _requestHeadersReceived(req: any) {
    const reqInfo = this._requests[req.requestId]
    if (!reqInfo) return
    reqInfo.noTimeout = true
    if (reqInfo.timeoutCalled) {
      for (const callback of this._callbacks) {
        callback('ongoing', req)
      }
    }
  }

  _requestRedirected(req: any) {
    const url = req.redirectUrl
    if (!url) return
    if (url.startsWith('data:') || url.startsWith('about:')) {
      this._requestDone(req)
    }
  }

  _requestError(req: any) {
    const reqInfo = this._requests[req.requestId]
    delete this._requests[req.requestId]

    if (req.tabId < 0) return
    if (req.error == 'net::ERR_INCOMPLETE_CHUNKED_ENCODING') return
    if (req.error.includes('BLOCKED')) return
    if (req.error.startsWith('net::ERR_FILE_')) return
    if (req.error.startsWith('NS_ERROR_ABORT')) return
    if (req.url.startsWith('file:')) return
    if (req.url.startsWith('chrome')) return
    if (req.url.startsWith('about:')) return
    if (req.url.startsWith('moz-')) return
    if (req.url.includes('://127.0.0.1')) return
    if (!reqInfo) return
    if (req.error == 'net::ERR_ABORTED') {
      if (reqInfo.timeoutCalled && !reqInfo.noTimeout) {
        for (const callback of this._callbacks) {
          callback('timeoutAbort', req)
        }
      }
      return
    }
    for (const callback of this._callbacks) {
      callback('error', req)
    }
  }

  _requestDone(req: any) {
    for (const callback of this._callbacks) {
      callback('done', req)
    }
    delete this._requests[req.requestId]
  }

  watchTabs(callback: any) {
    this._tabCallbacks.push(callback)
    if (this.tabsWatching) return
    this.watch(this.setTabRequestInfo.bind(this))
    this.tabsWatching = true
    chrome.tabs.onCreated.addListener((tab: any) => {
      if (!tab.id) return
      this.tabInfo[tab.id] = this._newTabInfo()
    })
    chrome.tabs.onRemoved.addListener((tabId: any) => {
      delete this.tabInfo[tabId]
    })
    chrome.tabs.onReplaced?.addListener((added: any, removed: any) => {
      this.tabInfo[added] ??= this._newTabInfo()
      delete this.tabInfo[removed]
    })
    chrome.tabs.onUpdated.addListener(
      (tabId: any, changeInfo: any, tab: any) => {
        const info = (this.tabInfo[tab.id] ??= this._newTabInfo())
        if (!info) return
        for (const callback of this._tabCallbacks) {
          callback(tab.id, info, null, 'updated')
        }
      }
    )
    chrome.tabs.query({}, (tabs: any[]) => {
      for (const tab of tabs) {
        this.tabInfo[tab.id] ??= this._newTabInfo()
      }
    })
  }

  _newTabInfo() {
    return {
      requests: {} as Record<string, any>,
      requestCount: 0,
      requestStatus: {} as Record<string, string>,
      ongoingCount: 0,
      errorCount: 0,
      doneCount: 0,
      summary: {} as Record<string, any>,
    }
  }

  setTabRequestInfo(status: string, req: any) {
    const info = this.tabInfo[req.tabId]
    if (info) {
      if (status == 'start' && req.type == 'main_frame') {
        if (!req.url.startsWith('chrome://errorpage/')) {
          const newInfo = this._newTabInfo()
          for (const [key, value] of Object.entries(newInfo)) {
            info[key] = value
          }
        }
      }
      if (info.requestCount > MAXREQUESTCACHE) {
        const nowTimeStamp = Date.now()
        Object.keys(info.requests).forEach((requestId: string) => {
          if (requestId == req.requestId) return
          if (info.requestStatus[requestId] === 'done') {
            delete info.requests[requestId]
            delete info.requestStatus[requestId]
          }
          const _request = info.requests[requestId]
          if (_request?.timeStamp) {
            const duration = nowTimeStamp - _request.timeStamp
            if (duration > 10 * 60 * 1000) {
              delete info.requests[requestId]
              delete info.requestStatus[requestId]
            }
          }
        })
        info.requestCount = Object.keys(info.requests).length
        if (info.requestCount > MAXREQUESTCACHE) {
          this.tabInfo[req.tabId] = this._newTabInfo()
          return
        }
      }
      const reqInfo = info.requests[req.requestId] || {}
      const statusObj: any = {}
      statusObj[status] = req.timeStamp || Date.now()
      const statusInfo = Object.assign({}, reqInfo.statusInfo, statusObj)
      info.requests[req.requestId] = Object.assign(
        {},
        info.requests[req.requestId],
        req,
        {
          statusInfo: statusInfo,
        }
      )
      const oldStatus = info.requestStatus[req.requestId]
      if (oldStatus) {
        info[this.eventCategory[oldStatus] + 'Count']--
      } else {
        if (status == 'timeoutAbort') return
        info.requestCount++
      }
      info.requestStatus[req.requestId] = status
      info[this.eventCategory[status] + 'Count']++
      const id = this.getSummaryId?.(req)
      if (id != null) {
        if (this.eventCategory[status] == 'error') {
          if (this.eventCategory[oldStatus] != 'error') {
            let summaryItem = info.summary[id]
            if (summaryItem == null) {
              const hostname = new URL(req.url).hostname
              summaryItem = info.summary[id] = {
                baseDomain: OmegaPac.wildcardForDomain(hostname),
                errorCount: 0,
              }
            }
            summaryItem.errorCount++
          }
        } else if (this.eventCategory[oldStatus] == 'error') {
          const summaryItem = info.summary[id]
          if (summaryItem != null) summaryItem.errorCount--
        }
      }
      for (const callback of this._tabCallbacks) {
        callback(req.tabId, info, req, status)
      }
    }
  }
}

export = WebRequestMonitor
