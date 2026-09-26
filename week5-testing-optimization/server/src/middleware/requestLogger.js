import morgan from 'morgan'

// SSE authentication uses a query token. Log only the route, never query values
// or Referer (which can also contain credentials). Request IDs preserve tracing.
export function requestLogger(options = {}) {
  return morgan((tokens, req, res) => [
    tokens.method(req, res),
    (req.originalUrl || req.url || '/').split('?')[0],
    tokens.status(req, res),
    `${tokens['response-time'](req, res)} ms`,
    `requestId=${res.locals?.requestId || '-'}`,
  ].join(' '), options)
}
