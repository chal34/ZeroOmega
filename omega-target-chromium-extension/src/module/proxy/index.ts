import FirefoxProxyImpl = require('./proxy_impl_firefox')
import ListenerProxyImpl = require('./proxy_impl_listener')
import SettingsProxyImpl = require('./proxy_impl_settings')
import ScriptProxyImpl = require('./proxy_impl_script')

export const proxyImpls = [
  FirefoxProxyImpl,
  ListenerProxyImpl,
  ScriptProxyImpl,
  SettingsProxyImpl,
]

export function getProxyImpl(log: any) {
  for (const Impl of proxyImpls) {
    if (Impl.isSupported()) {
      return new Impl(log)
    }
  }
  throw new Error('Your browser does not support proxy settings!')
}
