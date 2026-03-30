import FirefoxProxyImpl = require('./proxy_impl_firefox');
import SettingsProxyImpl = require('./proxy_impl_settings');
import ScriptProxyImpl = require('./proxy_impl_script');
export declare const proxyImpls: (typeof FirefoxProxyImpl | typeof SettingsProxyImpl | typeof ScriptProxyImpl)[];
export declare function getProxyImpl(log: any): FirefoxProxyImpl | SettingsProxyImpl | ScriptProxyImpl;
//# sourceMappingURL=index.d.ts.map