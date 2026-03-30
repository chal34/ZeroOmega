declare const OmegaTarget: any

const ContentTypeRejectedError = OmegaTarget.ContentTypeRejectedError

function xhrWrapper(...args: any[]) {
  return fetch(...(args as [any]))
    .then((response: Response) => {
      return response.text().then((body: string) => {
        return [response, body] as const
      })
    })
    .catch((err: any) => {
      if (!err.isOperational) throw err
      if (!err.statusCode) {
        throw new OmegaTarget.NetworkError(err)
      }
      if (err.statusCode == 404) {
        throw new OmegaTarget.HttpNotFoundError(err)
      }
      if (err.statusCode >= 500 && err.statusCode < 600) {
        throw new OmegaTarget.HttpServerError(err)
      }
      throw new OmegaTarget.HttpError(err)
    })
}

function fetchUrl(
  dest_url: string,
  opt_bypass_cache?: boolean,
  opt_type_hints?: string[]
) {
  const getResBody = ([response, body]: readonly [Response, string]) => {
    if (!opt_type_hints) return body
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
    for (const hint of opt_type_hints) {
      const handler = (hintHandlers as any)[hint] ?? defaultHintHandler
      const result = handler(response, body, { contentType, hint })
      if (result != null) return result
    }
    throw new ContentTypeRejectedError(
      'Unrecognized Content-Type: ' + contentType
    )
  }

  if (opt_bypass_cache && dest_url.indexOf('?') < 0) {
    const parsed = new URL(dest_url)
    parsed.searchParams.set('_', Date.now().toString())
    const dest_url_nocache = parsed.toString()
    return xhrWrapper(dest_url_nocache)
      .then(getResBody)
      .catch(() => {
        return xhrWrapper(dest_url).then(getResBody)
      })
  } else {
    return xhrWrapper(dest_url).then(getResBody)
  }
}

function defaultHintHandler(
  response: Response,
  body: string,
  { contentType, hint }: { contentType: string; hint: string }
) {
  if ('!' + contentType == hint) {
    throw new ContentTypeRejectedError(
      'Response Content-Type blacklisted: ' + contentType
    )
  }
  if (contentType == hint) {
    return body
  }
}

const hintHandlers: Record<string, any> = {
  '*': (response: Response, body: string) => {
    return body
  },

  '!text/html': (
    response: Response,
    body: string,
    { contentType, hint }: { contentType: string; hint: string }
  ) => {
    if (contentType == hint) {
      let looksLikeHtml = false
      if (body.indexOf('<!DOCTYPE') >= 0 || body.indexOf('<!doctype') >= 0) {
        looksLikeHtml = true
      } else if (body.indexOf('</html>') >= 0) {
        looksLikeHtml = true
      } else if (body.indexOf('</body>') >= 0) {
        looksLikeHtml = true
      }

      if (looksLikeHtml) {
        throw new ContentTypeRejectedError('Response must not be HTML.')
      }
    }
  },

  '!application/xhtml+xml': (...args: any[]) =>
    hintHandlers['!text/html'](...args),

  'application/x-ns-proxy-autoconfig': (
    response: Response,
    body: string,
    { contentType, hint }: { contentType: string; hint: string }
  ) => {
    if (contentType == hint) {
      return body
    }
    if (body.indexOf('FindProxyForURL') >= 0) {
      return body
    } else {
      return undefined
    }
  },
}

export = fetchUrl
