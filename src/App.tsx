import { useEffect, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import ApiUsage from './pages/ApiUsage'
import ApiSettings from './pages/ApiSettings'
import ApiAdmin from './pages/ApiAdmin'
import DemoModule from './pages/DemoModule'
import { api, ApiError, demoMode, errorMessage } from './services/api'
import type { Module, Session, User } from './services/api'

interface Auth { token: string; user: User }
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2, refetchOnWindowFocus: true } },
})

function Login({ onLogin }: { onLogin: (auth: Auth) => void }) {
  const [fixture, setFixture] = useState('employee')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  async function login() {
    setBusy(true); setError('')
    try { onLogin(await api.login(fixture)); navigate('/home') }
    catch (failure) { setError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  return <div className="login-screen"><div className="login-card">
    <img className="login-logo" src="/assets/bunzl-logo.png" alt="Bunzl" />
    <span className="eyebrow">UNIFIED AI PORTAL</span><h1>Welcome to Bunzl AI</h1>
    {demoMode ? <>
      <p>Sign in with a demo profile to explore your assigned AI applications.</p>
      <div className="demo-banner login-banner">DEMO MODE · No real authentication</div>
      <label htmlFor="fixture">Demo profile</label>
      <select id="fixture" value={fixture} onChange={(event) => setFixture(event.target.value)}><option value="employee">Employee</option><option value="limited">Employee with limited access</option><option value="admin">Administrator</option></select>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="open-button login-button" onClick={login} disabled={busy}>{busy ? 'Signing in...' : 'Continue to portal'}</button>
    </> : <p role="alert">Production sign-in is not configured. Entra and the approved backend integration must be implemented before deployment.</p>}
  </div></div>
}

function SessionDialog({ session, onClose, onUsage }: { session: Session; onClose: () => void; onUsage: () => void }) {
  const firstButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    firstButton.current?.focus()
    return () => { if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  function keyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
    if (event.key === 'Tab') {
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      if (!buttons?.length) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }
  const duration = session.endedAt ? Math.max(0, Math.round((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60000)) : null
  const pending = session.status === 'pending' || session.status === 'ending' || session.tokensUsed === undefined || session.remainingQuota === undefined
  return <div className="modal-backdrop"><div className="session-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="session-title" onKeyDown={keyboard}>
    <span className="eyebrow">SESSION UPDATE</span><h2 id="session-title">Session {session.status}</h2>
    <p>Your {session.moduleName} session has {session.status}.</p>
    <dl className="profile-list"><div><dt>Duration</dt><dd>{duration === null ? 'Pending' : `${duration} min`}</dd></div><div><dt>Tokens consumed</dt><dd>{pending ? 'Pending' : session.tokensUsed?.toLocaleString()}</dd></div><div><dt>Remaining quota</dt><dd>{pending ? 'Pending' : session.remainingQuota?.toLocaleString()}</dd></div></dl>
    {pending && <p>Usage is still being reconciled. Check again shortly.</p>}
    <div className="modal-actions"><button ref={firstButton} className="open-button" onClick={onClose}>Return to Home</button><button className="secondary-button" onClick={onUsage}>View Usage</button></div>
  </div></div>
}

function Portal({ auth, onSignOut }: { auth: Auth; onSignOut: () => void }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [launching, setLaunching] = useState<string | null>(null)
  const [launchError, setLaunchError] = useState('')
  const [fallbackUrl, setFallbackUrl] = useState('')
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const navigate = useNavigate()
  const client = useQueryClient()
  const modules = useQuery({ queryKey: ['modules', auth.token], queryFn: ({ signal }) => api.modules(auth.token, signal) })
  const quota = useQuery({ queryKey: ['quota', auth.token], queryFn: ({ signal }) => api.quota(auth.token, signal), refetchInterval: 30_000, refetchIntervalInBackground: false })
  const breakdown = useQuery({ queryKey: ['breakdown', auth.token], queryFn: ({ signal }) => api.breakdown(auth.token, signal), refetchInterval: 30_000, refetchIntervalInBackground: false })
  const sessions = useQuery({ queryKey: ['sessions', auth.token], queryFn: ({ signal }) => api.sessions(auth.token, signal), refetchInterval: 10_000, refetchIntervalInBackground: false })
  const sessionExpired = [modules.error, quota.error, breakdown.error, sessions.error].some((error) => error instanceof ApiError && error.status === 401)
  const session = sessions.data?.find((item) => !seen.has(`${item.sessionId}:${item.status}`))
  const sessionId = session ? `${session.sessionId}:${session.status}` : undefined
  useEffect(() => {
    if (!sessionId) return
    void client.invalidateQueries({ queryKey: ['quota', auth.token] })
    void client.invalidateQueries({ queryKey: ['breakdown', auth.token] })
    void client.invalidateQueries({ queryKey: ['history', auth.token] })
  }, [sessionId, client, auth.token])
  useEffect(() => {
    function refresh() {
      void client.invalidateQueries({ queryKey: ['quota', auth.token] })
      void client.invalidateQueries({ queryKey: ['modules', auth.token] })
      void client.invalidateQueries({ queryKey: ['sessions', auth.token] })
      void client.invalidateQueries({ queryKey: ['breakdown', auth.token] })
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [client, auth.token])
  useEffect(() => {
    if (!mobileOpen) return
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])
  function dismiss(path: string) {
    if (session) setSeen((previous) => new Set(previous).add(`${session.sessionId}:${session.status}`))
    navigate(path)
  }
  async function openModule(module: Module) {
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    setLaunching(module.moduleName); setLaunchError(''); setFallbackUrl('')
    try {
      const result = await api.start(auth.token, module.moduleName)
      if (!result.launchUrl) throw new Error('The server did not provide a launch URL.')
      const url = new URL(result.launchUrl)
      if (!demoMode || url.origin !== window.location.origin || url.pathname !== `/demo/${module.moduleName}`) throw new Error('The server returned an unapproved application URL.')
      if (tab) tab.location.href = url.href
      else { setFallbackUrl(url.href); setLaunchError('Your browser blocked the new tab. Use the link below to open the application.') }
    } catch (failure) {
      tab?.close()
      setLaunchError(errorMessage(failure))
      if (failure instanceof ApiError && failure.status === 403) void client.invalidateQueries({ queryKey: ['modules', auth.token] })
    } finally { setLaunching(null) }
  }
  const loading = modules.isPending || quota.isPending || breakdown.isPending
  const failure = (!modules.data && modules.error) || (!quota.data && quota.error) || (!breakdown.data && breakdown.error)
  return <div className={`portal ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <Header user={auth.user} quota={quota.data} onMenu={() => setMobileOpen(!mobileOpen)} onSignOut={onSignOut} />
    {mobileOpen && <button className="drawer-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} isAdmin={auth.user.roles.includes('admin')} onToggle={() => setCollapsed(!collapsed)} onNavigate={() => setMobileOpen(false)} />
    <main className="main-content"><div className="demo-banner">DEMO MODE · Simulated identity, applications and usage</div><div className="content-wrap">
      {sessionExpired && <div className="storage-warning" role="alert">Your session has expired. <button onClick={onSignOut}>Sign in again</button></div>}
      {launchError && <div className="storage-warning" role="alert">{launchError} {fallbackUrl && <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">Open application</a>}</div>}
      {sessions.isError && <div className="storage-warning" role="alert">Session updates could not be refreshed: {errorMessage(sessions.error)} <button onClick={() => sessions.refetch()}>Retry</button></div>}
      {loading ? <p role="status">Loading your portal...</p> : failure ? <div className="empty-panel" role="alert"><p>Unable to load your portal: {errorMessage(failure)}</p><button className="secondary-button" onClick={() => { void modules.refetch(); void quota.refetch(); void breakdown.refetch() }}>Retry</button>{failure instanceof ApiError && failure.status === 401 && <button className="secondary-button" onClick={onSignOut}>Sign in again</button>}</div> : modules.data && quota.data && breakdown.data ? <>
        {(modules.isRefetchError || quota.isRefetchError || breakdown.isRefetchError) && <div className="storage-warning" role="alert">Some data may be out of date. Refresh or retry when the service is available.</div>}
        <Routes>
          <Route path="/home" element={<Home modules={modules.data.filter((item) => item.isEnabled)} quota={quota.data} breakdown={breakdown.data} onOpen={openModule} onRetry={() => { void modules.refetch() }} launching={launching} />} />
          <Route path="/usage" element={<ApiUsage token={auth.token} modules={modules.data} quota={quota.data} />} />
          <Route path="/settings" element={<ApiSettings token={auth.token} user={auth.user} />} />
          <Route path="/admin/users" element={auth.user.roles.includes('admin') ? <ApiAdmin token={auth.token} modules={modules.data} currentUserId={auth.user.id} /> : <Navigate to="/access-denied" replace />} />
          <Route path="/admin/reports" element={auth.user.roles.includes('admin') ? <ApiAdmin token={auth.token} modules={modules.data} currentUserId={auth.user.id} reports /> : <Navigate to="/access-denied" replace />} />
          <Route path="/access-denied" element={<div className="empty-panel"><h1>Access denied</h1><p>You do not have permission to view this page.</p></div>} />
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<div className="empty-panel"><h1>Page not found</h1><p>This page does not exist.</p></div>} />
        </Routes>
      </> : null}
    </div></main>
    {session && <SessionDialog session={session} onClose={() => dismiss('/home')} onUsage={() => dismiss('/usage')} />}
  </div>
}

function AppRoutes() {
  const [auth, setAuth] = useState<Auth | null>(null)
  const client = useQueryClient()
  function signOut() { client.clear(); setAuth(null) }
  return <Routes>
    <Route path="/demo/:moduleName" element={<DemoModule />} />
    <Route path="/login" element={auth ? <Navigate to="/home" replace /> : <Login onLogin={setAuth} />} />
    <Route path="*" element={auth ? <Portal auth={auth} onSignOut={signOut} /> : <Navigate to="/login" replace />} />
  </Routes>
}

export default function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><AppRoutes /></BrowserRouter></QueryClientProvider>
}
