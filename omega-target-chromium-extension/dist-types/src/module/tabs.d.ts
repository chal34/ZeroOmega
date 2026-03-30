declare class ChromeTabs {
    _defaultAction: any;
    _badgeTab: any;
    actionForUrl: any;
    _dirtyTabs: Record<string, any>;
    constructor(actionForUrl: any);
    ignoreError(): void;
    watch(): void;
    resetAll(action: any): void;
    onUpdated(tabId: any, changeInfo: any, tab: any): void;
    processTab(tab: any, changeInfo?: any): void;
    setTabBadge(tab: any, badge: any): void;
    setIcon(icon: any, tabId?: any): void;
    _canSetPopup(): any;
    _chromeSetIcon(params: any): void;
    clearIcon(tabId: any): void;
}
export = ChromeTabs;
//# sourceMappingURL=tabs.d.ts.map