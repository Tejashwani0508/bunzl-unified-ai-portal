import { BarChart3, ChevronLeft, ChevronRight, House, Settings, Shield } from 'lucide-react'
import { NavLink } from 'react-router-dom'

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  isAdmin: boolean
  onToggle: () => void
  onNavigate: () => void
}

export default function Sidebar({ collapsed, mobileOpen, isAdmin, onToggle, onNavigate }: SidebarProps) {
  const items = [
    { label: 'Home', path: '/home', icon: House },
    { label: 'Usage', path: '/usage', icon: BarChart3 },
    { label: 'Settings', path: '/settings', icon: Settings },
    ...(isAdmin ? [{ label: 'Admin', path: '/admin/users', icon: Shield }] : []),
  ]
  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-top">
        {!collapsed && <span className="nav-heading">MAIN MENU</span>}
        <button className="collapse-button" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      <nav aria-label="Main navigation">
        {items.map(({ label, path, icon: Icon }) => (
          <NavLink key={path} to={path} onClick={onNavigate} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={collapsed ? label : undefined}>
            <Icon size={19} aria-hidden="true" /><span className={collapsed ? 'sr-only' : undefined}>{label}</span>
          </NavLink>
        ))}
      </nav>
      {!collapsed && <div className="sidebar-footer"><span className="footer-dot" /> Demo environment</div>}
    </aside>
  )
}
