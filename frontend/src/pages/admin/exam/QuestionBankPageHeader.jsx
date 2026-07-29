import React from 'react'
import { Layers, HelpCircle, CheckCircle2, FileText } from 'lucide-react'

export default function QuestionBankPageHeader({ totalQuestions, verifiedCount, topicCount }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 sm:p-5 rounded-2xl shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
            <Layers className="text-orange-500" size={22} />
            <span>Question Bank Management</span>
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 max-w-2xl">
            Organized syllabus hierarchy with instant topic search, question verification, duplicate detection, and AI extraction workflows.
          </p>
        </div>

        {/* Stat Badges Summary */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {totalQuestions !== undefined && (
            <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-secondary)] font-semibold flex items-center gap-1.5">
              <HelpCircle size={14} className="text-orange-500" />
              <span>Questions: <strong className="text-[var(--text-primary)]">{totalQuestions}</strong></span>
            </div>
          )}

          {verifiedCount !== undefined && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>Verified: <strong>{verifiedCount}</strong></span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
