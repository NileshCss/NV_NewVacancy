import React, { useEffect } from 'react'
import { useRouter } from '../../../context/RouterContext'
import {
  LayoutDashboard, Briefcase, Newspaper, Gift, Radio,
  FolderKanban, Award, BookOpen, Bookmark, FileText, HelpCircle, FileCheck,
  Users, MessageSquare, Bot, Cpu, ExternalLink, X
} from 'lucide-react'

const SIDEBAR_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    title: 'Content',
    items: [
      { id: 'jobs', label: 'Jobs', icon: Briefcase },
      { id: 'news', label: 'News', icon: Newspaper },
      { id: 'affiliates', label: 'Affiliates', icon: Gift },
      { id: 'live-updates', label: 'Live Updates', icon: Radio },
    ]
  },
  {
    title: 'Question Bank',
    items: [
      { id: 'exam_categories', label: 'Exam Categories', icon: FolderKanban },
      { id: 'exams', label: 'Exams', icon: Award },
      { id: 'subjects', label: 'Subjects', icon: BookOpen },
      { id: 'chapters', label: 'Chapters', icon: Bookmark },
      { id: 'topics', label: 'Topics', icon: FileText },
      { id: 'questions', label: 'Questions', icon: HelpCircle },
      { id: 'mock_tests', label: 'Mock Tests', icon: FileCheck },
    ]
  },
  {
    title: 'Users & Messaging',
    items: [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    ]
  },
  {
    title: 'AI Tools',
    items: [
      { id: 'ai', label: 'AI Assistant', icon: Bot },
      { id: 'scraper', label: 'AI Scraper', icon: Cpu },
    ]
  },
  {
    title: 'Utility',
    items: [
      { id: 'back_to_site', label: 'Back to Site', icon: ExternalLink, isAction: true },
    ]
  }
]

export default function MobileNavDrawer({ isOpen, onClose, currentSection, onSelectSection }) {
  const { navigate } = useRouter()

  // Pressing Escape closes drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleCloseTrigger = (e) => {
    e?.stopPropagation()
    onClose()
  }

  return (
    <aside
      className={`
        lg:hidden fixed top-0 left-0 z-[70]
        w-[85vw] max-w-xs h-screen
        bg-[var(--bg-card)] border-r border-[var(--border)]
        flex flex-col transition-transform duration-300 ease-in-out select-none shadow-2xl
        ${isOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'}
      `}
      aria-label="Mobile Navigation Menu"
      aria-hidden={!isOpen}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Clean Drawer Header */}
      <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 font-bold text-sm text-[var(--text-primary)]">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center text-xs font-extrabold shadow-xs">
            NV
          </div>
          <div className="flex items-baseline gap-1 font-bold text-sm text-[var(--text-primary)] tracking-tight">
            <span>NewVacancy</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-black uppercase bg-orange-500/10 text-orange-500 border border-orange-500/20">
              Admin
            </span>
          </div>
        </div>

        {/* High Contrast Reliable Close Button */}
        <button
          onClick={handleCloseTrigger}
          onTouchEnd={handleCloseTrigger}
          className="w-9 h-9 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-orange-500 hover:text-white transition flex items-center justify-center cursor-pointer shadow-xs"
          aria-label="Close Navigation Menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* Scrollable Navigation Items (44px min tap targets) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {SIDEBAR_SECTIONS.map((sec, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
              {sec.title}
            </div>
            <div className="space-y-1 mt-1">
              {sec.items.map(item => {
                const Icon = item.icon
                const isActive = currentSection === item.id

                if (item.isAction) {
                  return (
                    <button
                      key={item.id}
                      onClick={(e) => {
                        handleCloseTrigger(e)
                        navigate('home')
                      }}
                      onTouchEnd={(e) => {
                        handleCloseTrigger(e)
                        navigate('home')
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border)] transition flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-3">
                        <Icon size={18} className="text-orange-500" />
                        <span>{item.label}</span>
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">↵</span>
                    </button>
                  )
                }

                return (
                  <button
                    key={item.id}
                    onClick={(e) => {
                      onSelectSection(item.id)
                      handleCloseTrigger(e)
                    }}
                    onTouchEnd={(e) => {
                      onSelectSection(item.id)
                      handleCloseTrigger(e)
                    }}
                    className={`
                      w-full min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-semibold
                      flex items-center gap-3 transition-all cursor-pointer
                      ${isActive
                        ? 'bg-orange-500/10 text-orange-500 font-bold border border-orange-500/20 shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-transparent'
                      }
                    `}
                  >
                    <Icon size={18} className={isActive ? 'text-orange-500' : 'text-[var(--text-muted)]'} />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
