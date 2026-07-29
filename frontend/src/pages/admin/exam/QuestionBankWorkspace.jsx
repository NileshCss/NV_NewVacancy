import React, { useState, useEffect } from 'react'
import HierarchyPanel from './HierarchyPanel'
import QuestionContentPanel from './QuestionContentPanel'
import { Layers, X } from 'lucide-react'

export default function QuestionBankWorkspace({
  selectedTopic,
  onSelectTopic,
  onAddQuestion,
  onEditQuestion,
  onBulkImport,
  onAiExtract
}) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)

  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileDrawerOpen])

  return (
    <div className="space-y-4 min-w-0">
      {/* Mobile Drawer Floating Toggle Button */}
      <div className="md:hidden flex items-center justify-between bg-[var(--bg-card)] border border-[var(--border)] p-3 rounded-2xl shadow-xs">
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="w-full px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Layers size={16} className="text-orange-500" />
          <span className="truncate">{selectedTopic ? `Topic: ${selectedTopic.name}` : 'Select Topic / Syllabus Hierarchy'}</span>
        </button>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start min-h-[680px]">
        {/* Left Hierarchy Panel (Desktop 4 cols, Hidden on Mobile) */}
        <div className="hidden md:block md:col-span-4 lg:col-span-3 h-[680px] sticky top-[73px]">
          <HierarchyPanel
            selectedTopic={selectedTopic}
            onSelectTopic={(t) => {
              onSelectTopic(t)
              setIsMobileDrawerOpen(false)
            }}
          />
        </div>

        {/* Right Content Panel (Desktop 8-9 cols, Mobile 12 cols) */}
        <div className="md:col-span-8 lg:col-span-9 min-w-0">
          <QuestionContentPanel
            selectedTopic={selectedTopic}
            onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
            onAddQuestion={onAddQuestion}
            onEditQuestion={onEditQuestion}
            onBulkImport={onBulkImport}
            onAiExtract={onAiExtract}
          />
        </div>
      </div>

      {/* Mobile Drawer Overlay Sheet */}
      {isMobileDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end"
          onClick={() => setIsMobileDrawerOpen(false)}
        >
          <div
            className="bg-[var(--bg-card)] w-4/5 max-w-sm h-full flex flex-col shadow-2xl border-l border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-bold text-xs text-[var(--text-primary)]">
                <Layers size={15} className="text-orange-500" />
                <span>Syllabus Hierarchy</span>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="p-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                aria-label="Close Hierarchy Panel"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <HierarchyPanel
                selectedTopic={selectedTopic}
                onSelectTopic={(t) => {
                  onSelectTopic(t)
                  setIsMobileDrawerOpen(false)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
