export class NetworkError extends Error {
  cause: unknown
  constructor(err?: unknown) {
    super()
    this.cause = err
    this.name = 'NetworkError'
  }
}

export class HttpError extends NetworkError {
  statusCode: number | undefined
  constructor(err?: unknown) {
    super(err)
    this.name = 'HttpError'
    this.statusCode = (this.cause as { statusCode?: number })?.statusCode
  }
}

export class HttpNotFoundError extends HttpError {
  constructor(err?: unknown) {
    super(err)
    this.name = 'HttpNotFoundError'
  }
}

export class HttpServerError extends HttpError {
  constructor(err?: unknown) {
    super(err)
    this.name = 'HttpServerError'
  }
}

export class ContentTypeRejectedError extends Error {
  constructor() {
    super()
    this.name = 'ContentTypeRejectedError'
  }
}
