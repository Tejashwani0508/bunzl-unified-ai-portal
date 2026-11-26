import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: number
  icon: LucideIcon
  detail: string
  progress?: number
}

export default function MetricCard({ label, value, icon: Icon, detail, progress }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <div className="metric-icon"><Icon size={19} aria-hidden="true" /></div>
      </div>
      <div className="metric-value">{value.toLocaleString('en-US')}</div>
      {progress !== undefined && (
        <div className="progress-track" role="progressbar" aria-label="Token consumption" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(progress.toFixed(1))}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="metric-detail">{detail}</div>
    </article>
  )
}
