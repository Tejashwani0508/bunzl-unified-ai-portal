import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { api, errorMessage } from '../services/api'
import type { Module } from '../services/api'

interface Props { token: string; modules: Module[]; currentUserId: string; reports?: boolean }

function AdminUsers({ token, modules, currentUserId }: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedModule, setSelectedModule] = useState('')
  const [limit, setLimit] = useState('')
  const [pendingPermission, setPendingPermission] = useState<{ userId: string; moduleName: string; enabled: boolean } | null>(null)
  const client = useQueryClient()
  const users = useQuery({ queryKey: ['admin-users', token, search, page], queryFn: ({ signal }) => api.adminUsers(token, search, page, signal) })
  const permission = useMutation({ mutationFn: (change: { userId: string; moduleName: string; enabled: boolean }) => api.adminPermission(token, change.userId, change.moduleName, change.enabled), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['admin-users', token] }), client.invalidateQueries({ queryKey: ['modules'] })]) } })
  const quota = useMutation({ mutationFn: () => api.adminQuota(token, selectedUser, selectedModule, Number(limit)), onSuccess: () => { void client.invalidateQueries({ queryKey: ['modules'] }) } })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (selectedUser && selectedModule && limit !== '' && Number.isSafeInteger(Number(limit)) && Number(limit) >= 0) quota.mutate()
  }
  return <>
    <section className="dashboard-section"><div className="section-heading"><div><h2>Users and module permissions</h2><p>Changes are enforced by the demo API. You cannot change your own permissions here.</p></div></div>
      <label className="admin-search">Search users <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Name or email" /></label>
      {users.isPending ? <p>Loading users...</p> : users.isError ? <div role="alert">{errorMessage(users.error)} <button onClick={() => users.refetch()}>Retry</button></div> : users.data.items.length === 0 ? <div className="empty-panel">No users found.</div> : (
        <div className="table-card"><table><thead><tr><th>User</th><th>Assigned modules</th></tr></thead><tbody>{users.data.items.map((user) => <tr key={user.id}>
          <td><strong>{user.displayName}</strong><br />{user.email}</td>
          <td><div className="permission-list">{modules.map((module) => <label key={module.moduleName}><input type="checkbox" checked={pendingPermission?.userId === user.id && pendingPermission.moduleName === module.moduleName ? pendingPermission.enabled : user.permissions.includes(module.moduleName)} disabled={permission.isPending || user.id === currentUserId} onChange={(event) => {
            const change = { userId: user.id, moduleName: module.moduleName, enabled: event.target.checked }
            setPendingPermission(change)
            permission.mutate(change, { onSettled: () => setPendingPermission(null) })
          }} /> {module.displayName}</label>)}</div></td>
        </tr>)}</tbody></table></div>
      )}
      {permission.isError && <p className="form-error" role="alert">{errorMessage(permission.error)}</p>}
      {users.data && <div className="pagination"><button className="secondary-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="secondary-button" disabled={page * users.data.pageSize >= users.data.total} onClick={() => setPage(page + 1)}>Next</button></div>}
    </section>
    <section className="workspace-card dashboard-section"><h2>Set a module quota</h2><p>Module quotas are separate from the user-level allocation.</p>
      <form className="filters admin-quota-form" onSubmit={submit}>
        <label>User<select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)} required><option value="">Select user</option>{users.data?.items.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select></label>
        <label>Application<select value={selectedModule} onChange={(event) => setSelectedModule(event.target.value)} required><option value="">Select application</option>{modules.map((module) => <option key={module.moduleName} value={module.moduleName}>{module.displayName}</option>)}</select></label>
        <label>Monthly token limit<input type="number" min="0" step="1" value={limit} onChange={(event) => setLimit(event.target.value)} required /></label>
        <button className="open-button" disabled={quota.isPending} type="submit">{quota.isPending ? 'Saving...' : 'Save quota'}</button>
      </form>
      {quota.isSuccess && <p className="success-message" role="status">Module quota saved.</p>}
      {quota.isError && <p className="form-error" role="alert">{errorMessage(quota.error)}</p>}
    </section>
  </>
}

function AdminReports({ token, modules }: Props) {
  const [module, setModule] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const params = new URLSearchParams()
  if (module) params.set('module', module)
  if (from) params.set('from', `${from}T00:00:00.000Z`)
  if (to) params.set('to', `${to}T23:59:59.999Z`)
  const reports = useQuery({ queryKey: ['admin-reports', token, params.toString()], queryFn: ({ signal }) => api.adminReports(token, params, signal) })
  return <section className="dashboard-section"><div className="section-heading"><div><h2>Request reports</h2><p>Recorded demo requests across users. Initial demo allocation is not included.</p></div></div>
    <div className="filters"><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><label>Application<select value={module} onChange={(event) => setModule(event.target.value)}><option value="">All applications</option>{modules.map((item) => <option key={item.moduleName} value={item.moduleName}>{item.displayName}</option>)}</select></label></div>
    {reports.isPending ? <p>Loading reports...</p> : reports.isError ? <div role="alert">{errorMessage(reports.error)} <button onClick={() => reports.refetch()}>Retry</button></div> : reports.data.length === 0 ? <div className="empty-panel">No requests found for these filters.</div> : <div className="table-card"><table><thead><tr><th>Date</th><th>Application</th><th>Tokens</th><th>Status</th></tr></thead><tbody>{reports.data.map((row) => <tr key={row.requestId}><td>{new Date(row.timestamp).toLocaleString()}</td><td>{modules.find((item) => item.moduleName === row.moduleName)?.displayName ?? row.moduleName}</td><td>{row.totalTokens.toLocaleString()}</td><td>{row.status}</td></tr>)}</tbody></table></div>}
  </section>
}

export default function ApiAdmin({ token, modules, currentUserId, reports = false }: Props) {
  return <><section className="welcome"><span className="eyebrow">ADMINISTRATION</span><h1>{reports ? 'Admin reports' : 'Admin users'}</h1><p>Manage demo access and monitor recorded activity.</p></section>
    <nav className="admin-tabs" aria-label="Administration"><NavLink to="/admin/users">Users</NavLink><NavLink to="/admin/reports">Reports</NavLink></nav>
    {reports ? <AdminReports token={token} modules={modules} currentUserId={currentUserId} /> : <AdminUsers token={token} modules={modules} currentUserId={currentUserId} />}
  </>
}
