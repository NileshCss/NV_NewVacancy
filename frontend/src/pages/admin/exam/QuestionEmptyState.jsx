import React from 'react'
import { FileText, Layers, List, Plus, Sparkles, ShieldAlert, Upload } from 'lucide-react'

export default function QuestionEmptyState({ onBrowseClick, onViewAllClick }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 sm:p-10 text-center h-full flex flex-col items-center justify-center space-y-6 shadow-xs min-h-[500px]">
      {/* Icon Badge */}
      <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] text-orange-500 shadow-xs">
        <FileText size={40} />
      </div>

      {/* Main Copy */}
      <div className="max-w-md space-y-2">
        <h3 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight">No topic selected</h3>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
          Choose a subject, chapter, or topic from the syllabus hierarchy tree on the left to inspect, verify, or add questions.
        </p>
      </div>

      {/* Contextual Feature Capabilities Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg text-left text-xs">
        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)]/80 border border-[var(--border)] space-y-1">
          <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Plus size={14} className="text-orange-500" />
            <span>Add Questions</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-normal">
            Create single MCQs with options, explanations, and difficulty ratings.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)]/80 border border-[var(--border)] space-y-1">
          <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Upload size={14} className="text-emerald-500" />
            <span>Bulk CSV Import</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-normal">
            Import hundreds of questions instantly via structured CSV files.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)]/80 border border-[var(--border)] space-y-1">
          <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Sparkles size={14} className="text-purple-500" />
            <span>AI Extraction</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-normal">
            Auto-generate MCQs from raw syllabus documents or text notes.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--bg-surface)]/80 border border-[var(--border)] space-y-1">
          <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-amber-500" />
            <span>Duplicate Audit</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] leading-normal">
            Detect near-duplicate questions and clean up topic banks with one click.
          </p>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {onBrowseClick && (
          <button
            onClick={onBrowseClick}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Layers size={16} />
            <span>Browse Syllabus Hierarchy</span>
          </button>
        )}

        {onViewAllClick && (
          <button
            onClick={onViewAllClick}
            className="px-5 py-2.5 bg-[var(--bg-surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] font-semibold text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <List size={16} />
            <span>View All Questions</span>
          </button>
        )}
      </div>
    </div>
  )
}
