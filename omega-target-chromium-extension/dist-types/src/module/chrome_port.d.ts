declare class TrackedEvent {
    event: any;
    callbacks: any[] | null;
    constructor(event: any);
    addListener(callback: any): this;
    removeListener(callback: any): this;
    removeAllListeners(): this;
    dispose(): void;
}
declare class ChromePort {
    name: any;
    sender: any;
    disconnect: any;
    postMessage: any;
    onMessage: TrackedEvent;
    onDisconnect: TrackedEvent;
    private port;
    constructor(port: any);
    dispose(): void;
}
export = ChromePort;
//# sourceMappingURL=chrome_port.d.ts.map