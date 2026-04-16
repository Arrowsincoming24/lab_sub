import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { IncomingMessage, ServerResponse } from 'node:http'

const execFileAsync = promisify(execFile)
const projectRoot = path.resolve(__dirname, '..')
let isRunInProgress = false
let lastRunStartedAt = 0
let lastRunFinishedAt = -1   // -1 means "never finished"; prevents stale-zero false-positive
let lastRunError: string | null = null

function getPythonExecutable() {
  const venvPath = path.resolve(__dirname, '../../.venv/Scripts/python.exe')
  return existsSync(venvPath) ? venvPath : 'python'
}

function apiPlugin() {
  return {
    name: 'api-routes',
    apply: 'serve',
    configureServer(server: any) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: any) => {
        const url = req.url || '/'
        const method = req.method || 'GET'

        if (method === 'GET' && url === '/api/run-test/status') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            running: isRunInProgress,
            lastRunStartedAt,
            lastRunFinishedAt,
            lastRunError,
          }))
          return
        }

        if (method === 'POST' && url === '/api/run-test') {
          if (isRunInProgress) {
            res.writeHead(409)
            res.end(JSON.stringify({ ok: false }))
            return
          }

          const scriptPath = path.resolve(projectRoot, 'tests/fix_async_load_test.py')
          const outputFile = path.resolve(__dirname, 'public/loadtest-results.json')
          const startTime = Date.now()

          isRunInProgress = true
          lastRunStartedAt = startTime
          lastRunError = null

          void execFileAsync(getPythonExecutable(), [
            scriptPath, '--host', '127.0.0.1', '--port', '9876',
            '--target-comp-id', 'EXCHANGE', '--sender-mode', 'user',
            '--users', '100', '--concurrency-limit', '250',
            '--connect-timeout', '8', '--read-timeout', '6',
            '--max-session-retries', '3', '--session-hold-seconds', '0.05',
            '--output-file', outputFile,
          ], { cwd: projectRoot, timeout: 600000, maxBuffer: 10 * 1024 * 1024 })
            .then(() => { lastRunFinishedAt = Date.now() })
            .catch((err: unknown) => {
              lastRunError = err instanceof Error ? err.message : String(err)
              lastRunFinishedAt = Date.now()
            })
            .finally(() => { isRunInProgress = false })

          res.writeHead(202, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, started: true, startedAt: startTime }))
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
