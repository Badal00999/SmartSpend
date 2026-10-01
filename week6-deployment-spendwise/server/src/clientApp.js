/**
 * Static client hosting (Week 4 – full-stack single-port mode)
 * -----------------------------------------------------------
 * In development the React client runs on Vite (port 5173) and proxies /api to
 * this server. For production – and for the "run the whole project with one
 * command" instruction in the report – the Express server also serves the built
 * client from `client/dist`:
 *
 *   GET /            → index.html
 *   GET /dashboard   → index.html   (client-side routing / SPA fallback)
 *   GET /assets/x.js → the hashed bundle
 *   GET /api/...     → always handled by the API routes that were mounted first
 */
import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'

export function mountClient(app, distDir = env.CLIENT_DIST) {
  const indexFile = path.join(distDir, 'index.html')

  if (!existsSync(indexFile)) {
    logger.warn(
      `SERVE_CLIENT is on but no build found at ${distDir}. Run "npm run build" first (or unset SERVE_CLIENT).`,
    )
    return false
  }

  app.use(
    express.static(distDir, {
      index: false,
      maxAge: '1y', // assets are content-hashed by Vite
      setHeaders(res, filePath) {
        // Never cache the HTML shell – it references the hashed bundles
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
      },
    }),
  )

  // SPA fallback: any non-API GET that is not a file returns the app shell
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (req.path.startsWith('/api')) return next()
    if (req.path.includes('.')) return next() // let the 404 handler answer missing assets
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile('index.html', { root: distDir }) // Anchor the trusted root; hidden parent dirs are not requested dotfiles.
  })

  logger.info(`Serving the built client from ${distDir}`)
  return true
}

export default mountClient
