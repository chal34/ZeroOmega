const logStore = idbKeyval.createStore('log-store', 'log-store')
const syncStore = idbKeyval.createStore('sync-store', 'sync')

const waitTimeFn = (timeout = 1000) => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
}

;(window as any).OmegaDebug = {
  getProjectVersion: () => {
    return chrome.runtime.getManifest().version
  },
  getExtensionVersion: () => {
    return chrome.runtime.getManifest().version
  },
  downloadLog: () => {
    return idbKeyval.entries(logStore).then((entries: any[]) => {
      const zip = new JSZip()
      const zipFolder = zip.folder('ZeroOmega')
      entries.forEach((entry: any) => {
        if (entry[0] != 'lastError') {
          zipFolder.file(entry[1].date + '.log', entry[1].val)
        }
      })
      return zip.generateAsync({
        compression: 'DEFLATE',
        compressionOptions: {
          level: 9,
        },
        type: 'blob',
      })
    }).then((blob: any) => {
      const filename = `ZeroOmegaLog_${Date.now()}.zip`
      saveAs(blob, filename)
    })
  },
  resetOptions: () => {
    chrome.runtime.sendMessage(
      {
        method: 'resetAllOptions',
      },
      (response: any) => {
        localStorage.clear()
        Promise.all([
          idbKeyval.clear(logStore),
          idbKeyval.clear(syncStore),
          waitTimeFn(2000),
        ])
          .then(() => {
            return idbKeyval.clear()
          })
          .then(() => {
            chrome.runtime.reload()
          })
      }
    )
  },
  reportIssue: () => {
    idbKeyval.get('lastError', logStore).then((lastError: any) => {
      const url =
        'https://github.com/suziwen/ZeroOmega/issues/new?title=&body='
      let finalUrl = url
      try {
        const projectVersion = (window as any).OmegaDebug.getProjectVersion()
        const extensionVersion = (window as any).OmegaDebug.getExtensionVersion()
        const env = {
          extensionVersion: extensionVersion,
          projectVersion: extensionVersion,
          userAgent: navigator.userAgent,
        }
        let body = chrome.i18n.getMessage('popup_issueTemplate', [
          env.projectVersion,
          env.userAgent,
        ])
        body ||= `\n\n<!-- Please write your comment ABOVE this line. -->\nZeroOmega ${env.projectVersion}\n${env.userAgent}`
        finalUrl = url + encodeURIComponent(body)
        const err = lastError || ''
        if (err) {
          body += `\n\`\`\`\n${err}\n\`\`\``
          finalUrl = (url + encodeURIComponent(body)).substr(0, 2000)
        }
      } catch (_) {
        // ignore
      }
      chrome.tabs.create({ url: finalUrl })
    })
  },
}
