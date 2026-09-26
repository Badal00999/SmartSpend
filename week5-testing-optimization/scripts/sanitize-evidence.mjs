// Run before sharing logs. Application logging also omits all query strings.
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../docs/evidence/', import.meta.url))
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) { await walk(file); continue }
    if (!/\.(log|json|txt)$/.test(entry.name)) continue
    const text = await readFile(file, 'utf8')
    const clean = text.replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/([?&]token=)[^\s&"']+/gi, '$1[REDACTED]')
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
      .replace(/(Bearer\s+)[A-Za-z0-9_.-]+/gi, '$1[REDACTED]')
    if (clean !== text) await writeFile(file, clean)
  }
}
await walk(root)
console.log('Evidence logs sanitized. Review manually before publishing; automated redaction is not a guarantee.')
