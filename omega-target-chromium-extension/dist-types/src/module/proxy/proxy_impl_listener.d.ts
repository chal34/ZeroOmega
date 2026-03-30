import ProxyImpl = require('./proxy_impl');
declare class ListenerProxyImpl extends ProxyImpl {
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
export = ListenerProxyImpl;
//# sourceMappingURL=proxy_impl_listener.d.ts.map