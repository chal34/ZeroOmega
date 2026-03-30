const omegaTarget = require('omega-target')

const moduleExports: any = {
  Storage: require('./storage'),
  SyncStorage: require('./sync_storage'),
  Options: require('./options'),
  ChromeTabs: require('./tabs'),
  SwitchySharp: require('./switchysharp'),
  ExternalApi: require('./external_api'),
  WebRequestMonitor: require('./web_request_monitor'),
  Inspect: require('./inspect'),
  proxy: require('./proxy'),
}

for (const [name, value] of Object.entries(omegaTarget)) {
  if (!(name in moduleExports)) {
    moduleExports[name] = value
  }
}

export = moduleExports
