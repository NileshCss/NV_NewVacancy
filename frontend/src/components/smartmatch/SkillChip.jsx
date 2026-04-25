import React from 'react'

export default function SkillChip({ skill, type = 'neutral', clickable = false, onRemove = null }) {
  const typeMap = {
    match: 'bg-green-100 text-green-800 border-green-300',
    missing: 'bg-red-100 text-red-800 border-red-300',
    neutral: 'bg-gray-100 text-gray-800 border-gray-300',
    strength: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  }

  const iconMap = {
    match: '✓',
    missing: '✗',
    neutral: '•',
    strength: '⭐',
  }

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full
        border text-sm font-medium transition-all
        ${typeMap[type] || typeMap.neutral}
        ${clickable ? 'cursor-pointer hover:shadow-md' : ''}
      `}
    >
      <span>{iconMap[type]}</span>
      <span>{skill}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:opacity-70 transition"
        >
          ✕
        </button>
      )}
    </div>
  )
}
