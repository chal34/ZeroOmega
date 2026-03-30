import ProxyImpl = require('./proxy_impl');
declare class ScriptProxyImpl extends ProxyImpl {
    features: string[];
    _proxyScriptUrl: string;
    _proxyScriptDisabled: boolean;
    _proxyScriptInitialized: boolean;
    _proxyScriptState: any;
    _options: any;
    static isSupported(): boolean;
    watchProxyChange(callback: any): null;
    applyProfile(profile: any, state?: any, options?: any): Promise<void>;
    _initWebextProxyScript(): Promise<void>;
    _proxyScriptStateChanged(): void;
}
export = ScriptProxyImpl;
//# sourceMappingURL=proxy_impl_script.d.ts.map