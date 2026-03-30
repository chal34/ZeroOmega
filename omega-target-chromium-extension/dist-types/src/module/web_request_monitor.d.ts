declare class WebRequestMonitor {
    getSummaryId: any;
    _requests: Record<string, any>;
    _recentRequests: any;
    _callbacks: any[];
    _tabCallbacks: any[];
    tabInfo: Record<string, any>;
    watching: boolean;
    timer: any;
    tabsWatching: boolean;
    eventCategory: Record<string, string>;
    constructor(getSummaryId: any);
    watch(callback: any): void;
    _requestStart(req: any): void;
    _tick(): void;
    _requestHeadersReceived(req: any): void;
    _requestRedirected(req: any): void;
    _requestError(req: any): void;
    _requestDone(req: any): void;
    watchTabs(callback: any): void;
    _newTabInfo(): {
        requests: Record<string, any>;
        requestCount: number;
        requestStatus: Record<string, string>;
        ongoingCount: number;
        errorCount: number;
        doneCount: number;
        summary: Record<string, any>;
    };
    setTabRequestInfo(status: string, req: any): void;
}
export = WebRequestMonitor;
//# sourceMappingURL=web_request_monitor.d.ts.map