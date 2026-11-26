import { LogOut, Menu, UserRound } from 'lucide-react'
import type { DemoEmployee } from '../config/demoEmployees'
import type { Quota } from '../services/api'

interface HeaderProps {
  employee: DemoEmployee
  quota?: Quota
  onMenu: () => void
  onSignOut: () => void
}

export default function Header({ employee, quota, onMenu, onSignOut }: HeaderProps) {
  return (
    <header className="header">
      <button className="mobile-menu" onClick={onMenu} aria-label="Toggle navigation"><Menu size={22} /></button>
      <div className="brand">
        <img className="brand-image" src="/assets/bunzl-logo.png" alt="Bunzl" />
        <span className="brand-divider" aria-hidden="true" />
        <div><span className="portal-title">Unified AI Portal</span><span className="brand-subtitle">One portal. Multiple AI tools.</span></div>
      </div>
      <div className="header-user">
        {quota && <span className="header-quota">{quota.remaining.toLocaleString('en-US')} tokens left</span>}
        <div className="user-avatar"><UserRound size={19} aria-hidden="true" /></div>
        <div className="user-details"><div className="user-name">{employee.name} · {employee.designation}</div><div className="session"><span />Demo session</div></div>
        <button className="sign-out" onClick={onSignOut} title="Logout" aria-label="Logout"><LogOut size={18} /></button>
      </div>
    </header>
  )
}
