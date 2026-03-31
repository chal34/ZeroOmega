import { describe, it, expect } from 'vitest'
import {
  NetworkError,
  HttpError,
  HttpNotFoundError,
  HttpServerError,
  ContentTypeRejectedError,
} from '../src/errors'

describe('NetworkError', () => {
  it('should have correct name', () => {
    const err = new NetworkError()
    expect(err.name).toBe('NetworkError')
    expect(err).toBeInstanceOf(Error)
  })

  it('should store the cause', () => {
    const cause = new Error('connection refused')
    const err = new NetworkError(cause)
    expect(err.cause).toBe(cause)
  })

  it('should handle undefined cause', () => {
    const err = new NetworkError()
    expect(err.cause).toBeUndefined()
  })
})

describe('HttpError', () => {
  it('should have correct name and extend NetworkError', () => {
    const err = new HttpError()
    expect(err.name).toBe('HttpError')
    expect(err).toBeInstanceOf(NetworkError)
    expect(err).toBeInstanceOf(Error)
  })

  it('should extract statusCode from cause', () => {
    const cause = { statusCode: 403 }
    const err = new HttpError(cause)
    expect(err.statusCode).toBe(403)
    expect(err.cause).toBe(cause)
  })

  it('should handle cause without statusCode', () => {
    const err = new HttpError(new Error('oops'))
    expect(err.statusCode).toBeUndefined()
  })
})

describe('HttpNotFoundError', () => {
  it('should have correct name and extend HttpError', () => {
    const err = new HttpNotFoundError()
    expect(err.name).toBe('HttpNotFoundError')
    expect(err).toBeInstanceOf(HttpError)
    expect(err).toBeInstanceOf(NetworkError)
  })

  it('should extract statusCode from cause', () => {
    const err = new HttpNotFoundError({ statusCode: 404 })
    expect(err.statusCode).toBe(404)
  })
})

describe('HttpServerError', () => {
  it('should have correct name and extend HttpError', () => {
    const err = new HttpServerError()
    expect(err.name).toBe('HttpServerError')
    expect(err).toBeInstanceOf(HttpError)
    expect(err).toBeInstanceOf(NetworkError)
  })

  it('should extract statusCode from cause', () => {
    const err = new HttpServerError({ statusCode: 500 })
    expect(err.statusCode).toBe(500)
  })
})

describe('ContentTypeRejectedError', () => {
  it('should have correct name', () => {
    const err = new ContentTypeRejectedError()
    expect(err.name).toBe('ContentTypeRejectedError')
    expect(err).toBeInstanceOf(Error)
  })
})
