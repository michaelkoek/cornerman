import { NavLink } from 'react-router-dom'
import { IconLibrary, IconLog, IconProgress, IconSettings, IconToday } from './icons'

const TABS = [
  { to: '/', label: 'Today', icon: IconToday, end: true },
  { to: '/log', label: 'Log', icon: IconLog, end: false },
  { to: '/progress', label: 'Progress', icon: IconProgress, end: false },
  { to: '/exercises', label: 'Exercises', icon: IconLibrary, end: false },
  { to: '/settings', label: 'Settings', icon: IconSettings, end: false },
]

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="tabbar__tab">
          <span className="tabbar__icon">
            <Icon size={24} />
          </span>
          <span className="tabbar__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
