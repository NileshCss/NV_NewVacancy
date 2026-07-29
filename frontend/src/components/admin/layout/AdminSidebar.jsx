import React from 'react'
import { useRouter } from '../../../context/RouterContext'
import {
  LayoutDashboard, Briefcase, Newspaper, Gift, Radio,
  FolderKanban, Award, BookOpen, Bookmark, FileText, HelpCircle, FileCheck,
  Users, MessageSquare, Bot, Cpu, ExternalLink
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

export default function AdminSidebar({ currentSection, onSelectSection }) {
  const { navigate } = useRouter()

  return (
    <aside className="hidden lg:flex sticky top-[57px] left-0 z-30 w-64 h-[calc(100vh-57px)] bg-[var(--bg-card)] border-r border-[var(--border)] flex-col select-none">
      {/* Scrollable Desktop Navigation Sections */}
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

                if (item.isAction) {
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate('home')}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border)] transition flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon size={16} className="text-orange-500" />
                        <span>{item.label}</span>
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">↵</span>
                    </button>
                  )
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectSection(item.id)}
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
    </aside>
  )
}
