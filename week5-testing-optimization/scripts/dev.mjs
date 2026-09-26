#!/usr/bin/env node
/**
 * Development runner:  npm run dev
 * ---------------------------------
 * Starts the API (port 4000) and the Vite dev server (port 5173) together,
 * prefixes their output so it is obvious which process is talking, and shuts
 * both down when you press Ctrl+C.
 *
 * Implemented with child_process instead of a dependency such as `concurrently`
 * so a fresh clone only needs `npm install` (see scripts/setup.mjs).
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const shell = process.platform === 'win32'

const targets = [
  { name: 'api', colour: '\u001b[36m', dir: 'server', args: ['run', 'dev'] },
  { name: 'web', colour: '\u001b[35m', dir: 'client', args: ['run', 'dev'] },
]

const children = []
let shuttingDown = false

function prefix(name, colour, stream, chunk) {
  const reset = '\u001b[0m'
  for (const line of String(chunk).split(/\r?\n/)) {
    if (line.trim() === '') continue
    stream.write(`${colour}[${name}]${reset} ${line}\n`)
  }
}

for (const target of targets) {
  const child = spawn(npm, target.args, {
    cwd: path.join(root, target.dir),
    shell,
    env: process.env,
  })
  children.push(child)
  child.stdout.on('data', (chunk) => prefix(target.name, target.colour, process.stdout, chunk))
  child.stderr.on('data', (chunk) => prefix(target.name, target.colour, process.stderr, chunk))
  child.on('exit', (code) => {
    if (shuttingDown) return
    console.log(`\n[${target.name}] exited with code ${code} – stopping the other process`)
    shutdown(code ?? 0)
  })
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 400)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log(`
SpendWise – starting the integrated stack
  API + Swagger : http://localhost:4000/api/docs
  Web app       : http://localhost:5173
  Press Ctrl+C to stop both.
`)
