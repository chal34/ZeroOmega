import ProxyImpl = require('./proxy_impl');
declare class FirefoxProxyImpl extends ProxyImpl {
    features: string[];
    _optionsReady: Promise<void>;
    _optionsReadyCallback: (() => void) | null;
    _options: any;
    _profile: any;
    static isSupported(): boolean;
    constructor(log: any);
    _initRequestListeners(): void;
    watchProxyChange(callback: any): null;
    applyProfile(profile: any, state?: any, options?: any): Promise<void>;
    onRequest(requestDetails: any): Promise<any[] | {
        type: string;
    } | undefined>;
    onError(error: any): void;
    proxyInfo(proxy: any, auth: any): any[];
}
export = FirefoxProxyImpl;
//# sourceMappingURL=proxy_impl_firefox.d.ts.map