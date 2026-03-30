export declare class NetworkError extends Error {
    cause: unknown;
    constructor(err?: unknown);
}
export declare class HttpError extends NetworkError {
    statusCode: number | undefined;
    constructor(err?: unknown);
}
export declare class HttpNotFoundError extends HttpError {
    constructor(err?: unknown);
}
export declare class HttpServerError extends HttpError {
    constructor(err?: unknown);
}
export declare class ContentTypeRejectedError extends Error {
    constructor();
}
//# sourceMappingURL=errors.d.ts.map