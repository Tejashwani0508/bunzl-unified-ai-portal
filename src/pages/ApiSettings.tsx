import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../services/api'
import type { Settings, User } from '../services/api'

function PreferencesForm({ initial, token }: { initial: Settings; token: string }) {
  const [settings, setSettings] = useState(initial)
  const queryClient = useQueryClient()
  const save = useMutation({ mutationFn: () => api.saveSettings(token, settings), onSuccess: (value) => queryClient.setQueryData(['settings', token], value) })
  return <section className="workspace-card settings-card">
    <h2>Notification preferences</h2><p>Preferences are saved in the demo service. No real notifications are sent.</p>
    <label className="preference"><span><strong>Quota alerts</strong><small>Updates about your token balance</small></span><input type="checkbox" checked={settings.quotaAlerts} onChange={(event) => setSettings({ ...settings, quotaAlerts: event.target.checked })} /></label>
    <label className="preference"><span><strong>Usage digest</strong><small>Usage summary updates</small></span><input type="checkbox" checked={settings.usageDigest} onChange={(event) => setSettings({ ...settings, usageDigest: event.target.checked })} /></label>
    <button className="open-button submit-button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving...' : 'Save preferences'}</button>
    {save.isSuccess && <p className="success-message" role="status">Preferences saved.</p>}
    {save.isError && <p className="form-error" role="alert">{errorMessage(save.error)}</p>}
  </section>
}

export default function ApiSettings({ token, user }: { token: string; user: User }) {
  const settings = useQuery({ queryKey: ['settings', token], queryFn: ({ signal }) => api.settings(token, signal) })
  return <>
    <section className="welcome"><span className="eyebrow">YOUR ACCOUNT</span><h1>Settings</h1><p>View your profile and manage your preferences.</p></section>
    <div className="settings-grid dashboard-section">
      <section className="workspace-card settings-card"><h2>Employee profile</h2><p>Read-only profile information</p><dl className="profile-list"><div><dt>Name</dt><dd>{user.displayName}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Role</dt><dd>{user.roles.join(', ')}</dd></div></dl></section>
      {settings.isPending ? <p>Loading settings...</p> : settings.isError ? <div role="alert">{errorMessage(settings.error)} <button onClick={() => settings.refetch()}>Retry</button></div> : <PreferencesForm initial={settings.data} token={token} />}
    </div>
  </>
}
