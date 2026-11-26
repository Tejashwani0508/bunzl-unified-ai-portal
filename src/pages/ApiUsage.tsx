import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../services/api'
import type { Module, Quota } from '../services/api'

interface Props { token: string; modules: Module[]; quota: Quota }

export default function ApiUsage({ token, modules, quota }: Props) {
  const [module, setModule] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const params = new URLSearchParams({ page: String(page), pageSize: '10' })
  if (module) params.set('module', module)
  if (from) params.set('from', `${from}T00:00:00.000Z`)
  if (to) params.set('to', `${to}T23:59:59.999Z`)
  const history = useQuery({ queryKey: ['history', token, params.toString()], queryFn: ({ signal }) => api.history(token, params, signal) })
  const breakdown = useQuery({ queryKey: ['breakdown', token], queryFn: ({ signal }) => api.breakdown(token, signal) })
  return (
    <>
      <section className="welcome"><span className="eyebrow">YOUR TOKEN ACTIVITY</span><h1>Usage</h1><p>Monitor your allocation and recent requests.</p></section>
      <section className="dashboard-section"><div className="metrics-grid">
        <div className="metric-card"><div className="metric-top">Monthly allocation</div><div className="metric-value">{quota.limit.toLocaleString()}</div></div>
        <div className="metric-card"><div className="metric-top">Tokens consumed</div><div className="metric-value">{quota.used.toLocaleString()}</div></div>
        <div className="metric-card"><div className="metric-top">Remaining quota</div><div className="metric-value">{quota.remaining.toLocaleString()}</div></div>
      </div></section>
      <section className="dashboard-section"><div className="section-heading"><div><h2>Usage by application</h2><p>Current monthly totals; the date filter below applies to request history.</p></div></div>
        {breakdown.isPending ? <p>Loading breakdown...</p> : breakdown.isError ? <div role="alert">{errorMessage(breakdown.error)} <button onClick={() => breakdown.refetch()}>Retry</button></div> : (
          <div className="table-card"><table><thead><tr><th>Application</th><th>Tokens consumed</th></tr></thead><tbody>
            {breakdown.data.filter((row) => modules.some((item) => item.moduleName === row.moduleName)).map((row) => <tr key={row.moduleName}><td>{modules.find((item) => item.moduleName === row.moduleName)?.displayName}</td><td>{row.totalTokens.toLocaleString()}</td></tr>)}
          </tbody></table></div>
        )}
      </section>
      <section className="dashboard-section"><div className="section-heading"><div><h2>Recent AI requests</h2><p>Filter your request history.</p></div></div>
        <div className="filters">
          <label>From <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} /></label>
          <label>To <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} /></label>
          <label>Application <select value={module} onChange={(event) => { setModule(event.target.value); setPage(1) }}><option value="">All applications</option>{modules.map((item) => <option key={item.moduleName} value={item.moduleName}>{item.displayName}</option>)}</select></label>
        </div>
        {history.isPending ? <p>Loading requests...</p> : history.isError ? <div role="alert">{errorMessage(history.error)} <button onClick={() => history.refetch()}>Retry</button></div> : history.data.items.length === 0 ? <div className="empty-panel">No requests found for these filters.</div> : (
          <div className="table-card"><table><thead><tr><th>Date</th><th>Application</th><th>Tokens</th><th>Status</th><th>Estimated cost</th></tr></thead><tbody>{history.data.items.map((row) => <tr key={row.requestId}><td>{new Date(row.timestamp).toLocaleString()}</td><td>{modules.find((item) => item.moduleName === row.moduleName)?.displayName ?? row.moduleName}</td><td>{row.totalTokens.toLocaleString()}</td><td>{row.status}</td><td>{row.estimatedCostUsd === null ? 'Not available' : `$${row.estimatedCostUsd.toFixed(2)}`}</td></tr>)}</tbody></table></div>
        )}
        {history.data && <div className="pagination"><button className="secondary-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="secondary-button" disabled={page * history.data.pageSize >= history.data.total} onClick={() => setPage(page + 1)}>Next</button></div>}
      </section>
    </>
  )
}
