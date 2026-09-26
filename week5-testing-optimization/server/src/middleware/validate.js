/**
 * validate(schema, source) – Express middleware factory.
 * Parses req[source] with a Zod schema; on success replaces it with the
 * parsed (coerced, defaulted, trimmed) value; on failure responds 422 with a
 * list of { field, message } so the client can show errors per field.
 */
import { ApiError } from '../utils/ApiError.js'

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {})
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || source,
        message: i.message,
      }))
      return next(ApiError.validation(details))
    }
    // Express 5 defines req.query as a getter – store parsed values separately
    if (source === 'query') req.validatedQuery = result.data
    else req[source] = result.data
    next()
  }
}
