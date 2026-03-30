import ProxyImpl = require('./proxy_impl');
declare class SettingsProxyImpl extends ProxyImpl {
    features: string[];
    _proxyChangeWatchers: any[] | null;
    static isSupported(): boolean;
    applyProfile(profile: any, meta?: any, options?: any): Promise<void>;
    _fixedProfileConfig(profile: any): any;
    _formatBypassItem(condition: any): any;
    _proxyChangeListener: (details: any) => void;
    watchProxyChange(callback: any): void;
    parseExternalProfile(details: any, options: any): any;
}
export = SettingsProxyImpl;
//# sourceMappingURL=proxy_impl_settings.d.ts.map