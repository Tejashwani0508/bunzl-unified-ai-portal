import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api, demoMode, errorMessage } from '../services/api'

export default function DemoModule() {
  const { moduleName = '' } = useParams()
  const [params] = useSearchParams()
  const sessionId = params.get('sessionId') ?? ''
  const fixture = params.get('fixture') ?? ''
  const [token, setToken] = useState('')
  const [prompt, setPrompt] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    if (!demoMode || !sessionId || !['employee', 'limited', 'admin'].includes(fixture)) return
    let active = true
    api.login(fixture).then((result) => { if (active) setToken(result.token) }).catch((failure: unknown) => { if (active) setError(errorMessage(failure)) })
    return () => { active = false }
  }, [fixture, sessionId])

  useEffect(() => {
    if (!token || ended) return
    const timer = window.setInterval(() => {
      api.heartbeat(token, sessionId).catch((failure: unknown) => setError(`Session heartbeat failed: ${errorMessage(failure)}`))
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [token, sessionId, ended])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!prompt.trim()) { setError('Enter a request before submitting.'); return }
    setBusy(true); setError('')
    try { const result = await api.invoke(token, moduleName, sessionId, prompt.trim()); setMessage(result.content); setPrompt('') }
    catch (failure) { setError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  async function exit() {
    setBusy(true); setError('')
    try { await api.end(token, sessionId); setEnded(true) }
    catch (failure) { setError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  if (!demoMode) return <div className="login-screen"><div className="workspace-card"><h1>Demo unavailable</h1><p>Demo applications are only available in development mode.</p></div></div>
  if (!sessionId || !['employee', 'limited', 'admin'].includes(fixture)) return <div className="login-screen"><div className="workspace-card"><h1>Invalid session</h1><p>Open this application from the portal.</p></div></div>
  return <div className="demo-workspace"><div className="demo-banner">DEMO MODE · No real AI provider is contacted</div><div className="content-wrap">
    <span className="eyebrow">APPLICATION WORKSPACE</span><h1>{moduleName}</h1><p className="demo-description">Requests are simulated and metered by the mock API.</p>
    <form className="workspace-card demo-form" onSubmit={submit}><h2>Make a request</h2><label htmlFor="demo-request">Your request</label><textarea id="demo-request" rows={6} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Type your request here..." disabled={ended} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="open-button submit-button" disabled={!token || busy || ended}>Submit request</button>
      <button type="button" className="secondary-button demo-exit" disabled={!token || busy || ended} onClick={exit}>Exit session</button>
    </form>
    <div className="workspace-card response-card" aria-live="polite"><h2>{ended ? 'Session ended' : 'Simulated AI response'}</h2><p>{ended ? 'Return to the portal tab to view your session summary.' : message || 'Your response will appear here.'}</p>{ended && <a className="back-link" href="/home">Return to portal</a>}</div>
  </div></div>
}
