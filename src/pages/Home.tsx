import { Activity, ArrowUpRight, Coins, ExternalLink, Sparkles, Wallet } from 'lucide-react'
import MetricCard from '../components/MetricCard'
import type { Module, Quota } from '../services/api'

interface HomeProps {
  modules: Module[]
  quota: Quota
  breakdown: { moduleName: string; totalTokens: number }[]
  onOpen: (module: Module) => void
  onRetry: () => void
  launching: string | null
}

export default function Home({ modules, quota, breakdown, onOpen, onRetry, launching }: HomeProps) {
  const percent = quota.limit > 0 ? Math.min(100, quota.used / quota.limit * 100) : 0
  const severity = quota.limit > 0 && quota.used / quota.limit > .9 ? 'critical' : quota.limit > 0 && quota.used / quota.limit > .75 ? 'warning' : ''
  return (
    <>
      <section className="welcome">
        <span className="eyebrow">YOUR AI WORKSPACE</span>
        <h1>Welcome to Bunzl Unified AI Portal</h1>
        <p>Access your approved AI tools, track your usage, and manage your quota in one place.</p>
      </section>
      <section className="dashboard-section" aria-labelledby="usage-heading">
        <div className="section-heading"><div><h2 id="usage-heading">Your monthly quota</h2><p>Resets {new Date(quota.resetDate).toLocaleDateString()} · Updated {new Date(quota.asOf).toLocaleString()}</p></div><span className="period-label">MONTHLY OVERVIEW</span></div>
        {severity && <p className={`quota-warning ${severity}`}>{severity === 'critical' ? 'Your token usage is above 90%.' : 'Your token usage is above 75%.'}</p>}
        <div className="metrics-grid">
          <MetricCard label="Monthly allocation" value={quota.limit} icon={Wallet} detail="Tokens allocated this month" />
          <MetricCard label="Tokens consumed" value={quota.used} icon={Activity} detail={quota.limit > 0 ? `${percent.toFixed(1)}% of monthly allocation used` : 'No allocation available'} progress={percent} />
          <MetricCard label="Remaining quota" value={quota.remaining} icon={Coins} detail={`${quota.reserved.toLocaleString('en-US')} tokens reserved`} />
        </div>
      </section>
      <section className="dashboard-section applications-section" aria-labelledby="apps-heading">
        <div className="section-heading"><div><h2 id="apps-heading">Your AI applications</h2><p>Applications assigned to you and ready to use.</p></div><span className="app-count"><ArrowUpRight size={15} /> {modules.length} available</span></div>
        {modules.length === 0 ? <div className="empty-panel">No applications are assigned to you. Contact your administrator. <button className="secondary-button" onClick={onRetry}>Retry</button></div> : (
          <div className="apps-grid">
            {modules.map((module) => (
              <article className="app-card" key={module.moduleName}>
                <div className="app-icon">{module.iconUrl ? <img src={module.iconUrl} alt="" referrerPolicy="no-referrer" /> : <Sparkles size={24} aria-hidden="true" />}</div>
                <h3>{module.displayName}</h3>
                <p>{module.description}</p>
                <span className="app-usage">{breakdown.find((row) => row.moduleName === module.moduleName)?.totalTokens.toLocaleString('en-US') ?? '—'} tokens used</span>
                <button className="open-button" disabled={launching !== null} onClick={() => onOpen(module)}> {launching === module.moduleName ? 'Opening...' : `Open ${module.displayName}`} <ExternalLink size={15} /></button>
                <span className="new-tab-note">Opens in a new tab</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
