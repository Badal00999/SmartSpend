#!/usr/bin/env node
/**
 * One-command setup:  npm run setup
 * ---------------------------------
 * Installs the dependencies of all three packages (client, server, e2e).
 * Written as a plain Node script so the project needs no extra tooling
 * (no concurrently / make / turbo) to be reproducible on a fresh machine.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const packages = ['server', 'client', 'e2e'].filter((dir) => existsSync(path.join(root, dir, 'package.json')))

console.log(`\nSpendWise full-stack setup – installing: ${packages.join(', ')}\n`)

for (const dir of packages) {
  console.log(`\n▶ ${dir}`)
  const result = spawnSync(npm, [existsSync(path.join(root, dir, 'package-lock.json')) ? 'ci' : 'install'], { cwd: path.join(root, dir), stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    console.error(`\n✖ npm install failed in ${dir}`)
    process.exit(result.status ?? 1)
  }
}

console.log(`
✓ Dependencies installed.

Next steps
  1. npm run dev      → API on http://localhost:4000 and UI on http://localhost:5173
  2. Open http://localhost:5173/login and press "Try the demo account"
     (demo@spendwise.app / Demo1234 – seeded automatically)

Optional
  npm test            → API + client test suites
  npm run test:e2e    → browser end-to-end tests (needs "npx playwright install chromium" once)
  Built-client single-port mode → see README (set SERVE_CLIENT=true before npm start)
`)
