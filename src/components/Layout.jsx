import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutGrid, UserPlus, Users, History, LogOut, ShieldCheck, Menu, X, MapPin } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/check-in', label: 'Check In', icon: UserPlus },
  { to: '/active', label: 'On Campus', icon: Users },
  { to: '/map', label: 'Visitor Map', icon: MapPin },
  { to: '/history', label: 'Visitor Log', icon: History },
]

export default function Layout({ children }) {
  const { username, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = () => {
    signOut()
    navigate('/login')
  }

  const NavItems = ({ onNavigate }) => (
    <nav className="flex-1 px-3 space-y-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 text-sm border-l-2 transition-colors ${
              isActive
                ? 'border-brass-400 bg-white/[0.04] text-brass-50'
                : 'border-transparent text-white/50 hover:text-white/80 hover:bg-white/[0.02]'
            }`
          }
        >
          <Icon size={17} strokeWidth={1.75} />
          {label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-white/10 bg-[#0D1521]">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-2 text-brass-400">
            <ShieldCheck size={20} strokeWidth={1.75} />
            <span className="font-display text-lg tracking-tight">MCET Gate</span>
          </div>
          <p className="mt-1 text-[11px] text-white/35 tracking-wide">Visitor Tracking System</p>
        </div>
        <NavItems />
        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-xs text-white/40">Signed in as</p>
          <p className="text-sm text-brass-50 truncate">{username || 'Staff'}</p>
          <p className="text-[11px] uppercase tracking-wide text-brass-500/80">{role}</p>
          <button onClick={handleSignOut} className="mt-3 flex items-center gap-2 text-xs text-white/50 hover:text-signal-red transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3 bg-[#0D1521] border-b border-white/10">
        <div className="flex items-center gap-2 text-brass-400">
          <ShieldCheck size={18} />
          <span className="font-display text-base">MCET Gate</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-white/70 p-1">
          <Menu size={22} />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-[#0D1521] border-r border-white/10 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <span className="font-display text-brass-400">MCET Gate</span>
              <button onClick={() => setMobileOpen(false)} className="text-white/60">
                <X size={20} />
              </button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-white/10 px-5 py-4">
              <p className="text-sm text-brass-50 truncate">{username || 'Staff'}</p>
              <button onClick={handleSignOut} className="mt-2 flex items-center gap-2 text-xs text-white/50">
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="flex-1 min-w-0 pt-16 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10">{children}</div>
      </main>
    </div>
  )
}
