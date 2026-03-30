declare const chrome: any
declare const idbKeyval: any

const OmegaTarget = require('omega-target') as any

let onChangedListenerInstalled = false
let isPulling = false
let isPushing = false

let state: any = null
let optionsSync: any = null

const mainLetters = ['Z', 'e', 'r', 'o', 'O', 'm', 'e', 'g', 'a']
const optionFilename = mainLetters.concat(['.json']).join('')
let gistId = ''
let gistToken = ''
const gistHost = 'https://api.github.com'

function processCheckCommit() {
  return getLastCommit(gistId)
    .then((remoteCommit: any) => {
      return state
        .set({
          lastGistSync: Date.now(),
        })
        .then(() => {
          return state
            .get({ lastGistCommit: '-2' })
            .then(({ lastGistCommit }: any) => {
              return lastGistCommit !== remoteCommit
            })
        })
    })
    .catch(() => {
      return true
    })
}

function processPull(syncStore: any) {
  return new Promise((resolve: any, reject: any) => {
    getGist(gistId)
      .then((gist: any) => {
        if (isPushing) {
          resolve({ changes: {} })
        } else {
          let changes: any = {}
          getAll(syncStore).then((data: any) => {
            let options: any
            try {
              const optionsStr = gist.files[optionFilename]?.content
              options = JSON.parse(optionsStr)
              for (const [key, val] of Object.entries<any>(data)) {
                changes[key] = {
                  oldValue: val,
                }
              }
              for (const [key, val] of Object.entries<any>(options)) {
                let target = changes[key]
                if (!target) {
                  changes[key] = {}
                  target = changes[key]
                }
                target.newValue = val
              }
              for (const [key, val] of Object.entries<any>(changes)) {
                if (
                  JSON.stringify(val.oldValue) === JSON.stringify(val.newValue)
                ) {
                  delete changes[key]
                }
              }
            } catch (e) {
              changes = {}
            }
            state?.set({
              lastGistCommit: gist.history[0]?.version,
              lastGistState: 'success',
              lastGistSync: Date.now(),
            })
            resolve({
              changes: changes,
              remoteOptions: options,
            })
          })
        }
      })
      .catch((e: any) => {
        state?.set({
          lastGistSync: Date.now(),
          lastGistState: 'fail: ' + e,
        })
        resolve({ changes: {} })
      })
  })
}

function getAll(syncStore: any) {
  return idbKeyval.entries(syncStore).then((entries: any[]) => {
    const data: any = {}
    entries.forEach((entry: any) => {
      data[entry[0]] = entry[1]
    })
    return data
  })
}

function _processPush(): any {
  if ((processPush as any).sequence.length > 0) {
    const syncStore =
      (processPush as any).sequence[(processPush as any).sequence.length - 1]
    ;(processPush as any).sequence.length = 0
    return getAll(syncStore)
      .then((data: any) => {
        return updateGist(gistId, data)
      })
      .then(() => {
        _processPush()
      })
  } else {
    isPushing = false
  }
}

function processPush(syncStore: any) {
  ;(processPush as any).sequence.push(syncStore)
  if (isPushing) return
  isPushing = true
  setTimeout(_processPush, 600)
}
;(processPush as any).sequence = []

function getLastCommit(gId: string) {
  return fetch(gistHost + '/gists/' + gId + '/commits?per_page=1', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + gistToken,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
    .then((res: Response) => res.json())
    .then((data: any) => {
      if (data.message) {
        throw data.message
      }
      return data[0]?.version
    })
}

function getGist(gId: string) {
  return fetch(gistHost + '/gists/' + gId, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + gistToken,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
    .then((res: Response) => res.json())
    .then((data: any) => {
      if (data.message) {
        throw data.message
      }
      return data
    })
}

function updateGist(gId: string, options: any) {
  const postBody: any = {
    description: mainLetters.concat([' Sync']).join(''),
    files: {} as any,
  }
  postBody.files[optionFilename] = {
    content: JSON.stringify(options, null, 4),
  }
  return fetch(gistHost + '/gists/' + gId, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + gistToken,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    method: 'PATCH',
    body: JSON.stringify(postBody),
  })
    .then((res: Response) => {
      return res.json()
    })
    .then((data: any) => {
      if (data.status === '404') {
        throw new Error('The token with Gist permission is required.')
      }
      if (data.message) {
        throw data.message
      }
      const lastGistCommit = data.history[0]?.version
      state
        ?.set({
          lastGistCommit: lastGistCommit,
          lastGistState: 'success',
          lastGistSync: Date.now(),
        })
        .then(() => {
          optionsSync?.updateBuiltInSyncConfigIf({
            lastGistCommit,
          })
        })
      return data
    })
    .catch((e: any) => {
      state?.set({
        lastGistState: 'fail: ' + e,
        lastGistSync: Date.now(),
      })
      console.error('update gist fail::', e)
    })
}

class ChromeSyncStorage extends OmegaTarget.Storage {
  areaName: string
  syncStore: any
  storage: any

  static parseStorageErrors(err: any): Promise<never> {
    return Promise.reject(err)
  }

  static watchers: Record<string, Record<string, any>> = {}

  static onChangedListener(changes: any, areaName: string, opts: any = {}) {
    let map: any = null
    for (const [, watcher] of Object.entries<any>(
      ChromeSyncStorage.watchers[areaName] || {}
    )) {
      let match = watcher.keys == null
      if (!match) {
        for (const key of Object.keys(changes)) {
          if (watcher.keys[key]) {
            match = true
            break
          }
        }
      }
      if (match) {
        if (map == null) {
          map = {}
          for (const [key, change] of Object.entries<any>(changes)) {
            map[key] = change.newValue
          }
        }
        watcher.callback(map, opts)
      }
    }
  }

  constructor(areaName: string, _state: any) {
    super()
    this.areaName = areaName
    state = _state
    const syncStore = idbKeyval.createStore('sync-store', 'sync')
    this.syncStore = syncStore

    const get = (key: any) => {
      return new Promise((resolve: any) => {
        getAll(syncStore).then((data: any) => {
          let result: any = {}
          if (Array.isArray(key)) {
            key.forEach((_key: string) => {
              result[_key] = data[_key]
            })
          } else if (key === null) {
            result = data
          } else {
            result[key] = data[key]
          }
          resolve(result)
        })
      })
    }

    const set = (record: any) => {
      return new Promise((resolve: any, reject: any) => {
        try {
          if (
            !record ||
            typeof record !== 'object' ||
            Array.isArray(record)
          ) {
            throw new SyntaxError(
              'Only Object with key value pairs are acceptable'
            )
          }
          const entries: any[] = []
          for (const [key, value] of Object.entries(record)) {
            entries.push([key, value])
          }
          idbKeyval.setMany(entries, syncStore).then(() => {
            processPush(syncStore)
            resolve(record)
          })
        } catch (e) {
          reject(e)
        }
      })
    }

    const _remove = (key: any) => {
      if (Array.isArray(key)) {
        return Promise.resolve(idbKeyval.delMany(key, syncStore))
      } else {
        return Promise.resolve(idbKeyval.del(key, syncStore))
      }
    }

    const remove = (key: any) => {
      return Promise.resolve(
        _remove(key).then(() => {
          processPush(syncStore)
          return
        })
      )
    }

    const clear = () => {
      return Promise.resolve(
        idbKeyval.clear(syncStore).then(() => {
          processPush(syncStore)
          return
        })
      )
    }

    this.storage = {
      get: get,
      set: set,
      remove: remove,
      clear: clear,
    }
  }

  get(keys?: any) {
    keys ??= null
    return Promise.resolve(this.storage.get(keys)).catch(
      ChromeSyncStorage.parseStorageErrors
    )
  }

  set(items: any) {
    if (Object.keys(items).length == 0) {
      return Promise.resolve({})
    }
    return Promise.resolve(this.storage.set(items)).catch(
      ChromeSyncStorage.parseStorageErrors
    )
  }

  remove(keys?: any) {
    if (keys == null) {
      return Promise.resolve(this.storage.clear())
    }
    if (Array.isArray(keys) && keys.length == 0) {
      return Promise.resolve({})
    }
    return Promise.resolve(this.storage.remove(keys)).catch(
      ChromeSyncStorage.parseStorageErrors
    )
  }

  destroy() {
    idbKeyval.clear(this.syncStore)
  }

  flush({ data }: { data: any }) {
    const entries: any[] = []
    let result = null
    if (data && data.schemaVersion) {
      for (const [key, value] of Object.entries(data)) {
        entries.push([key, value])
      }
      result = idbKeyval
        .clear(this.syncStore)
        .then(() => idbKeyval.setMany(entries, this.syncStore))
    }
    return Promise.resolve(result)
  }

  init(args: any) {
    optionsSync = args.optionsSync
    state = args.state
    gistId = args.gistId || ''
    if (gistId.indexOf('/') >= 0) {
      gistId = gistId.replace(/\/+$/, '')
      const parts = gistId.split('/')
      gistId = parts[parts.length - 1]
    }
    gistToken = args.gistToken
    return new Promise((resolve: any, reject: any) => {
      getLastCommit(gistId)
        .then((lastGistCommit: any) => {
          if (args.withRemoteData) {
            getGist(gistId).then((gist: any) => {
              try {
                const optionsStr = gist.files[optionFilename].content
                const options = JSON.parse(optionsStr)
                resolve({ options, lastGistCommit })
              } catch (e) {
                resolve({})
              }
            })
          } else {
            resolve({})
          }
        })
        .catch((e: any) => {
          reject(e)
        })
    })
  }

  checkChange(opts: any = {}) {
    isPulling = true
    processCheckCommit().then((isChanged: any) => {
      if (isChanged || opts.force) {
        processPull(this.syncStore).then(
          ({ changes, remoteOptions }: any) => {
            this.flush({ data: remoteOptions }).then(() => {
              isPulling = false
              ChromeSyncStorage.onChangedListener(
                changes,
                this.areaName,
                opts
              )
            })
          }
        )
      } else {
        console.log('no changed')
        isPulling = false
      }
    })
  }

  watch(keys: any, callback: any) {
    chrome.alarms.create('omega.syncCheck', {
      periodInMinutes: 5,
    })
    ChromeSyncStorage.watchers[this.areaName] ??= {}
    const area = ChromeSyncStorage.watchers[this.areaName]
    let enableSync = true
    let id = Date.now().toString()
    while (area[id]) {
      id = Date.now().toString()
    }

    if (Array.isArray(keys)) {
      const keyMap: Record<string, boolean> = {}
      for (const key of keys) {
        keyMap[key] = true
      }
      keys = keyMap
    }
    area[id] = { keys: keys, callback: callback }
    if (!onChangedListenerInstalled) {
      this.checkChange()
      chrome.alarms.onAlarm.addListener((alarm: any) => {
        if (!enableSync) return
        if (isPulling) return
        switch (alarm.name) {
          case 'omega.syncCheck':
            this.checkChange()
            break
        }
      })
      onChangedListenerInstalled = true
    }
    return () => {
      enableSync = false
      delete area[id]
    }
  }
}

export = ChromeSyncStorage
