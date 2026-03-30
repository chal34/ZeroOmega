declare const OmegaTarget: any;
declare class ChromeOptions extends OmegaTarget.Options {
    _inspect: any;
    _actionForUrl: any;
    fetchUrl: any;
    _networkInspectPorts: any[];
    constructor(...args: any[]);
    init(startupCheck: any): any;
    addTempRule(domain: any, profileName: any, toggle: any): any;
    updateProfile(...args: any[]): any;
    _proxyNotControllable: any;
    proxyNotControllable(): any;
    setProxyNotControllable(reason: any, badge?: any): void;
    _badgeTitle: any;
    setBadge(options?: any): void;
    clearBadge(): void;
    _quickSwitchCanEnable: boolean;
    setQuickSwitch(quickSwitch: any, canEnable: any): Promise<void>;
    setInspect(settings: any): Promise<void>;
    _requestMonitor: any;
    _monitorWebRequests: boolean;
    _tabRequestInfoPorts: any;
    setMonitorWebRequests(enabled: any): void;
    schedule(name: string, periodInMinutes: number): Promise<void>;
    printFixedProfile(profile: any): string | undefined;
    printProfile(profile: any): any;
    upgrade(options: any, changes?: any): any;
    onFirstRun(reason: any): void;
    getPageInfo({ tabId, url }: {
        tabId: any;
        url: string;
    }): Promise<{
        errorCount: any;
    } | {
        url: string;
        domain: any;
        subdomain: any;
        tempRuleProfileName: any;
        errorCount: any;
    } | null>;
}
export = ChromeOptions;
//# sourceMappingURL=options.d.ts.map