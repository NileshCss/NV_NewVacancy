import React from 'react'
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
  }
]

export default function AdminSidebar({ currentSection, onSelectSection, isMobileOpen, onCloseMobile }) {
  const { navigate } = useRouter()

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:sticky top-0 lg:top-[57px] left-0 z-50 lg:z-30
        w-64 h-screen lg:h-[calc(100vh-57px)]
        bg-[var(--bg-card)] border-r border-[var(--border)]
        flex flex-col transition-transform duration-200 ease-in-out select-none
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile Header */}
        <div className="lg:hidden p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="font-bold text-sm text-[var(--text-primary)]">Admin Menu</div>
          <button onClick={onCloseMobile} className="p-1 rounded-lg hover:bg-[var(--bg-surface)] text-[var(--text-muted)]">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-5">
          {SIDEBAR_SECTIONS.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                {sec.title}
              </div>
              <div className="space-y-0.5 mt-1">
                {sec.items.map(item => {
                  const Icon = item.icon
                  const isActive = currentSection === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectSection(item.id)
                        onCloseMobile?.()
                      }}
                      className={`
                        w-full px-2.5 py-2 rounded-xl text-xs font-semibold
                        flex items-center gap-2.5 transition-all cursor-pointer
                        ${isActive
                          ? 'bg-orange-500/10 text-orange-500 font-bold border border-orange-500/20 shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-transparent'
                        }
                      `}
                    >
                      <Icon size={16} className={isActive ? 'text-orange-500' : 'text-[var(--text-muted)]'} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Utility Section at Bottom */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-surface)]/50">
          <button
            onClick={() => navigate('home')}
            className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] border border-[var(--border)] transition flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <ExternalLink size={15} /> Back to Site
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">↵</span>
          </button>
        </div>
      </aside>
    </>
  )
}
