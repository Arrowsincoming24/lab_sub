import { useMemo, useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Gauge,
  Network,
  Play,
  RefreshCcw,
  Search,
  Server,
  ShieldAlert,
  Timer,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/* eslint-disable sonarjs/cognitive-complexity */

// Type definitions for load test results
interface LoadTestResults {
  timestamp: string
  users: number
  connected: number
  ordersSent: number
  ordersAcked: number
  orderRejects: number
  latencyIssues: number
  retries: number
  elapsedSec: number
  throughput: number
  connectionRate: number
  orderAckRate: number
  latency: {
    connect: { p50: number; p95: number; p99: number }
    logonAck: { p50: number; p95: number; p99: number }
    orderAck: { p50: number; p95: number; p99: number }
  }
  config: {
    host: string
    port: number
    symbol: string
    targetCompId: string
  }
  kpiTrend: {
    users: string
    connected: string
    throughput: string
    latency: string
  }
  latencyDist: Array<{ bucket: string; value: number }>
  failedRows: Array<{ user: string; error: string; severity: string; ordersSent: number; latencyIssues: number }>
}

interface RunStatus {
  running: boolean
  lastRunStartedAt: number
  lastRunFinishedAt: number
  lastRunError: string | null
}

const defaultResults: LoadTestResults = {
  timestamp: new Date().toISOString(),
  users: 1000,
  connected: 0,
  ordersSent: 0,
  ordersAcked: 0,
  orderRejects: 0,
  latencyIssues: 3000,
  retries: 2000,
  elapsedSec: 25.3,
  throughput: 0,
  connectionRate: 0,
  orderAckRate: 0,
  latency: {
    connect: { p50: 0, p95: 0, p99: 0 },
    logonAck: { p50: 0, p95: 0, p99: 0 },
    orderAck: { p50: 0, p95: 0, p99: 0 },
  },
  config: {
    host: '127.0.0.1',
    port: 9878,
    symbol: 'AAPL',
    targetCompId: 'EXCHANGE_SVR',
  },
  kpiTrend: {
    users: '+0%',
    connected: '-100%',
    throughput: '-100%',
    latency: '+3000',
  },
  latencyDist: [
    { bucket: '<100ms', value: 0 },
    { bucket: '100-300ms', value: 0 },
    { bucket: '300-500ms', value: 0 },
    { bucket: '>500ms', value: 100 },
  ],
  failedRows: [
    {
      user: 'USER_0001',
      error: 'Connection refused',
      severity: 'critical',
      ordersSent: 0,
      latencyIssues: 3,
    },
  ],
}

function App() {
  const [data, setData] = useState<LoadTestResults>(defaultResults)
  const [search, setSearch] = useState('')
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runProgress, setRunProgress] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [runSuccess, setRunSuccess] = useState(false)

  let runButtonLabel = 'Run New Test'
  if (isRunning) {
    runButtonLabel = runProgress ? 'Running...' : 'Starting...'
  }

  // Load results from JSON file
  const loadResults = async (): Promise<LoadTestResults | null> => {
    setIsLoading(true)
    try {
      const response = await fetch(`/loadtest-results.json?t=${Date.now()}`, { cache: 'no-store' })
      if (response.ok) {
        const json = await response.json()
        setData(json as LoadTestResults)
        setLastUpdate(new Date().toLocaleTimeString())
        return json as LoadTestResults
      }
    } catch (err) {
      console.error('Failed to load results:', err)
    } finally {
      setIsLoading(false)
    }
    return null
  }

  // Trigger Python load test with polling for results
  const runTest = async () => {
    const baselineData = data
    let runStartedAt = Date.now()
    setIsRunning(true)
    setRunError(null)
    setRunSuccess(false)
    setRunProgress('Starting test...')
    const abortController = new AbortController()
    const requestTimer = globalThis.setTimeout(() => abortController.abort(), 600000)
    
    try {
      // Send run request
      setRunProgress('Initializing 1000 users...')
      const response = await fetch('/api/run-test', { 
        method: 'POST',
        signal: abortController.signal,
      })
      
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: 'Run request failed' }))
        throw new Error(payload?.message || `Run request failed with status ${response.status}`)
      }

      const startPayload = await response.json().catch(() => ({} as { startedAt?: number }))
      if (typeof startPayload?.startedAt === 'number') {
        runStartedAt = startPayload.startedAt
      }

      // Poll run status, then refresh JSON when server reports completion.
      setRunProgress('Running load test (this may take 2-3 minutes)...')
      let resultFound = false
      let pollAttempts = 0
      const maxAttempts = 240 // 12 minutes with 3-second intervals
      
      while (pollAttempts < maxAttempts && !resultFound) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        pollAttempts++
        
        try {
          const statusResponse = await fetch(`/api/run-test/status?t=${Date.now()}`, { cache: 'no-store' })
          if (statusResponse.ok) {
            const status = await statusResponse.json() as RunStatus
            if (status.running) {
              setRunProgress(`Running load test (${pollAttempts * 3}s elapsed)...`)
              continue
            }

            // Completed this run; now refresh results JSON and accept updated payload.
            if (status.lastRunFinishedAt >= runStartedAt) {
              if (status.lastRunError) {
                throw new Error(status.lastRunError)
              }

              const refreshed = await loadResults()
              const isUpdated = !!refreshed && (
                refreshed.timestamp !== baselineData.timestamp ||
                refreshed.elapsedSec !== baselineData.elapsedSec ||
                refreshed.retries !== baselineData.retries ||
                refreshed.ordersSent !== baselineData.ordersSent
              )

              if (isUpdated) {
                resultFound = true
                setRunProgress(null)
                setRunSuccess(true)
                setTimeout(() => setRunSuccess(false), 5000)
              }
            }
          }
        } catch (err) {
          console.debug(`Poll attempt ${pollAttempts} failed, retrying...`, err)
        }
      }
      
      if (!resultFound) {
        throw new Error('Test completed but results file not found. Check server logs.')
      }
    } catch (err) {
      console.error('Failed to run test:', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to run test'
      setRunError(errorMsg)
      setRunProgress(null)
    } finally {
      globalThis.clearTimeout(requestTimer)
      setIsRunning(false)
    }
  }

  // Auto-load on mount and set up polling
  useEffect(() => {
    loadResults()
    const interval = setInterval(loadResults, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const summary = data
  const kpiTrend = data.kpiTrend
  const latencyDist = data.latencyDist
  const failedRows = data.failedRows

  // Calculate health score
  const healthScore = useMemo(() => {
    const connectionRatio = summary.connected / (summary.users || 1)
    const completionRatio = summary.ordersAcked / (summary.ordersSent || 1)
    const latencyHealthRatio = Math.max(0, 1 - summary.latencyIssues / (summary.users * 2))

    return Math.round(connectionRatio * 50 + completionRatio * 35 + latencyHealthRatio * 15)
  }, [summary])

  // Filter failed rows based on search and severity
  const filteredRows = useMemo(() => {
    return failedRows.filter((row) => {
      if (criticalOnly && row.severity !== 'critical') return false
      const q = search.trim().toLowerCase()
      if (!q) return true
      return row.user.toLowerCase().includes(q) || row.error.toLowerCase().includes(q)
    })
  }, [criticalOnly, search, failedRows])

  // Export to CSV
  const exportCSV = () => {
    const headers = ['User', 'Severity', 'Orders Sent', 'Latency Issues', 'Error']
    const rows = filteredRows.map(row => [
      row.user,
      row.severity,
      row.ordersSent,
      row.latencyIssues,
      `"${row.error.replaceAll('"', '""')}"`,
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = globalThis.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `failed-sessions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    globalThis.URL.revokeObjectURL(url)
  }

  // Export full JSON report
  const exportJSON = () => {
    const report = {
      timestamp: new Date().toISOString(),
      summary: data,
      filteredFailures: filteredRows,
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = globalThis.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `load-test-report-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    globalThis.URL.revokeObjectURL(url)
  }

  const connectionRate = summary.users ? (summary.connected / summary.users) * 100 : 0
  const orderCompletion = summary.users ? (summary.ordersSent / (summary.users * 2)) * 100 : 0

  const timeline = [
    { t: 'T+0s', text: '1000 sessions dispatched with async concurrency gate 250', tone: 'secondary' as const },
    { t: 'T+2s', text: 'Initial connection attempts started failing with refusal errors', tone: 'destructive' as const },
    { t: `T+${summary.elapsedSec.toFixed(1)}s`, text: 'Run finished with retries exhausted and no live FIX acceptor', tone: 'destructive' as const },
  ]

  // Determine system status
  const sloChecks = [
    connectionRate >= 95,
    summary.latency.orderAck.p95 <= 500,
    summary.latencyIssues <= 10 * summary.users / 1000,
  ]
  const passedSLOs = sloChecks.filter(Boolean).length
  let systemStatus: 'healthy' | 'degraded' | 'critical' = 'critical'
  if (passedSLOs === 3) {
    systemStatus = 'healthy'
  } else if (passedSLOs >= 2) {
    systemStatus = 'degraded'
  }

  let statusBadgeVariant: 'secondary' | 'outline' | 'destructive' = 'destructive'
  let statusDotClass = 'bg-red-500'
  let statusLabel = 'Critical'
  if (systemStatus === 'healthy') {
    statusBadgeVariant = 'secondary'
    statusDotClass = 'bg-green-500'
    statusLabel = 'Healthy'
  } else if (systemStatus === 'degraded') {
    statusBadgeVariant = 'outline'
    statusDotClass = 'bg-yellow-500'
    statusLabel = 'Degraded'
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl space-y-6 p-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">FIX Load Test Dashboard</h1>
              <Badge variant={summary.connected > 0 ? 'secondary' : 'destructive'} className="gap-1">
                {summary.connected > 0 ? 'Connected' : 'Connection Failed'}
              </Badge>
              <Badge
                variant={statusBadgeVariant}
                className={`gap-1 font-semibold`}
              >
                <div className={`h-2 w-2 rounded-full ${statusDotClass}`} />
                {statusLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">Async 1000-user opposing buy/sell simulation status ({lastUpdate ? `updated ${lastUpdate}` : 'loading...'})</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadResults} disabled={isLoading || isRunning}>
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={runTest} disabled={isRunning}>
              <Play className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
              {runButtonLabel}
            </Button>
          </div>
        </div>
        {runProgress && (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              {runProgress}
            </div>
          </div>
        )}
        {runSuccess && (
          <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Test completed successfully! Results updated below.
          </div>
        )}
        {runError && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            ⚠️ {runError}

          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="h-full">
          <CardHeader>
            <CardDescription className="flex items-center justify-between">
              Users
              <Badge variant="secondary">{kpiTrend.users}</Badge>
            </CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              {summary.users}
              <Users className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardDescription className="flex items-center justify-between">
              Connected
              <Badge variant="destructive">{kpiTrend.connected}</Badge>
            </CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              {summary.connected}
              <Activity className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardDescription className="flex items-center justify-between">
              Orders/sec
              <Badge variant="destructive">{kpiTrend.throughput}</Badge>
            </CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              {summary.throughput.toFixed(2)}
              <Gauge className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardDescription className="flex items-center justify-between">
              Latency Issues
              <Badge variant="destructive">{kpiTrend.latency}</Badge>
            </CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              {summary.latencyIssues}
              <Timer className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-1 h-full">
          <CardHeader>
            <CardTitle>Overall Health Score</CardTitle>
            <CardDescription>Composite run quality indicator</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl font-semibold">{healthScore}</div>
            <Progress value={healthScore} />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">P50</div>
                <div className="font-medium">{summary.latency.orderAck.p50}ms</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">P95</div>
                <div className="font-medium">{summary.latency.orderAck.p95}ms</div>
              </div>
              <div className="rounded-md border p-2">
                <div className="text-muted-foreground">P99</div>
                <div className="font-medium">{summary.latency.orderAck.p99}ms</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Run Health
            </CardTitle>
            <CardDescription>Based on the last 1000-user execution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Connection Success</span>
                  <span>{connectionRate.toFixed(1)}%</span>
                </div>
                <Progress value={connectionRate} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Completion</span>
                  <span>{orderCompletion.toFixed(1)}%</span>
                </div>
                <Progress value={orderCompletion} />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Badge variant={connectionRate >= 95 ? 'secondary' : 'destructive'} className="justify-center py-1.5">
                SLO: Connection ≥ 95%
              </Badge>
              <Badge variant={summary.latency.orderAck.p95 <= 500 ? 'secondary' : 'destructive'} className="justify-center py-1.5">
                SLO: P95 ≤ 500ms
              </Badge>
              <Badge variant={summary.latencyIssues <= 10 ? 'secondary' : 'destructive'} className="justify-center py-1.5">
                SLO: Latency Issues ≤ 10
              </Badge>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">Elapsed</div>
                <div className="mt-1 text-xl font-semibold">{summary.elapsedSec.toFixed(2)}s</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">Retries</div>
                <div className="mt-1 text-xl font-semibold">{summary.retries}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">Orders Sent</div>
                <div className="mt-1 text-xl font-semibold">{summary.ordersSent}</div>
              </div>
            </div>

            {summary.connected === 0 && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span>Target FIX endpoint refused all connections on configured host/port.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Runtime Context
            </CardTitle>
            <CardDescription>Current execution settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target</span>
              <span>{summary.config.host}:{summary.config.port}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TargetCompID</span>
              <span>{summary.config.targetCompId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Symbol</span>
              <span>{summary.config.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Concurrency Gate</span>
              <span>250</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session Retries</span>
              <span>2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Read Timeout</span>
              <span>2.0s</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Failure Timeline
            </CardTitle>
            <CardDescription>Execution milestones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {timeline.map((item) => (
              <div key={item.t} className="flex gap-3">
                <div className="text-xs font-mono font-semibold text-muted-foreground min-w-12">{item.t}</div>
                <div className="text-sm leading-relaxed">{item.text}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Latency Distribution</CardTitle>
            <CardDescription>Order ack timings (all users)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latencyDist.map((d) => {
              const maxValue = Math.max(...latencyDist.map(x => x.value), 1)
              const barWidth = (d.value / maxValue) * 100
              return (
                <div key={d.bucket} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{d.bucket}</span>
                    <span className="text-xs text-muted-foreground">{d.value} samples</span>
                  </div>
                  <div className="h-8 w-full rounded-md bg-secondary/50 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out flex items-center justify-end pr-2"
                      style={{ width: `${barWidth}%` }}
                    >
                      {barWidth > 15 && (
                        <span className="text-xs font-semibold text-primary-foreground">{Math.round(barWidth)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <Separator className="my-2" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Orders: {summary.ordersSent.toLocaleString()}</p>
              <p>• Acks Received: {summary.ordersAcked.toLocaleString()}</p>
              <p>• Completion Rate: {summary.ordersSent > 0 ? ((summary.ordersAcked / summary.ordersSent) * 100).toFixed(1) : 0}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle>Failed Sessions</CardTitle>
              <CardDescription>Search by user ID or error message ({filteredRows.length} results)</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={exportCSV} title="Export as CSV">
                CSV
              </Button>
              <Button size="sm" variant="outline" onClick={exportJSON} title="Export as JSON">
                JSON
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search user or error..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 pl-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <Button
                variant={criticalOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCriticalOnly(!criticalOnly)}
                className="whitespace-nowrap"
              >
                Critical Only
              </Button>
            </div>

            {filteredRows.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead className="max-w-xs">Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row, index) => (
                      <TableRow key={`${row.user}-${row.error}-${index}`} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-xs">{row.user}</TableCell>
                        <TableCell>
                          <Badge
                            variant={row.severity === 'medium' ? 'secondary' : 'destructive'}
                          >
                            {row.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.ordersSent}</TableCell>
                        <TableCell>{row.latencyIssues}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{row.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No failed sessions match your criteria.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

export default App
