/** Pure, testable fail-fast checks. Never include credential values in errors. */
export function validateProductionConfig({ nodeEnv, mongodbUri, jwtSecret, corsOrigins }) {
  if (nodeEnv !== 'production') return
  if (!mongodbUri || !/^mongodb(?:\+srv)?:\/\//.test(mongodbUri)) {
    throw new Error('Production requires a persistent MONGODB_URI (mongodb:// or mongodb+srv://).')
  }
  if (!jwtSecret || jwtSecret.length < 32 || /change-me|dev-only|test-secret|e2e-secret/i.test(jwtSecret)) {
    throw new Error('Production requires a private random JWT_SECRET of at least 32 characters; example secrets are not allowed.')
  }
  if (!corsOrigins?.length) throw new Error('Set CORS_ORIGIN or RENDER_EXTERNAL_URL for production.')
  for (const origin of corsOrigins) {
    let url
    try { url = new URL(origin) } catch { throw new Error('Production CORS origins must be explicit HTTPS origins.') }
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) {
      throw new Error('Production CORS origins must be explicit HTTPS origins without paths or credentials.')
    }
  }
}
