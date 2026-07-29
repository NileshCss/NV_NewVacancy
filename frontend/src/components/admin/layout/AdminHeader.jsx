import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useRouter } from '../../../context/RouterContext'
import ThemeToggle from '../../ThemeToggle'
import { Menu, LogOut, ExternalLink, Shield, User, ChevronDown } from 'lucide-react'

export default function AdminHeader({ sectionTitle, onToggleMobileSidebar }) {
  const { user, isAdmin, displayName, avatarLetter, signOut } = useAuth()
  const { navigate } = useRouter()
  const [userDropOpen, setUserDropOpen] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setUserDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    setUserDropOpen(false)
    try {
      await signOut()
      navigate('home')
    } catch {}
  }

  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-card)] border-b border-[var(--border)] px-4 sm:px-6 py-3 shadow-xs">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle + Logo + Page Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)] transition"
            aria-label="Toggle Navigation"
          >
            <Menu size={18} />
          </button>

          {/* Clean Admin Brand Logo (Fixes New_ / vacancy line wrap bug) */}
          <div
            onClick={() => navigate('admin')}
            className="flex items-center gap-2 cursor-pointer select-none shrink-0"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white font-extrabold text-xs shadow-sm">
              NV
            </div>
            <div className="flex items-baseline gap-1 font-bold text-sm text-[var(--text-primary)] tracking-tight">
              <span>NewVacancy</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-black uppercase bg-orange-500/10 text-orange-500 border border-orange-500/20">
                Admin
              </span>
            </div>
          </div>

          <div className="hidden sm:block h-4 w-px bg-[var(--border)] mx-1" />

          {/* Section Breadcrumb */}
          <div className="hidden sm:block text-xs font-semibold text-[var(--text-secondary)]">
            {sectionTitle || 'Dashboard'}
          </div>
        </div>

        {/* Right: Theme Toggle + User Menu */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* Account Menu */}
          <div ref={dropRef} className="relative">
            <button
              onClick={() => setUserDropOpen(!userDropOpen)}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[var(--bg-surface)] border border-transparent hover:border-[var(--border)] transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {avatarLetter}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-[var(--text-primary)] max-w-[120px] truncate leading-tight">
                  {displayName}
                </span>
                <span className="text-[10px] font-extrabold text-orange-500 uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <ChevronDown size={14} className="text-[var(--text-muted)] hidden md:block" />
            </button>

            {userDropOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl z-50 py-1 text-xs">
                <div className="px-3.5 py-2.5 border-b border-[var(--border)]">
                  <div className="font-bold text-[var(--text-primary)] truncate">{displayName}</div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{user?.email}</div>
                </div>
                <button
                  onClick={() => { setUserDropOpen(false); navigate('home') }}
                  className="w-full px-3.5 py-2 text-left hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold flex items-center gap-2 transition"
                >
                  <ExternalLink size={14} /> Back to Site
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  onClick={handleSignOut}
                  className="w-full px-3.5 py-2 text-left hover:bg-red-500/10 text-red-500 font-bold flex items-center gap-2 transition"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
