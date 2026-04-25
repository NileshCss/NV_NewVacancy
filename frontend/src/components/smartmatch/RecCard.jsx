import React from 'react'

export default function RecCard({ icon, issue, action, gain, severity = 'important' }) {
  const severityMap = {
    critical: 'bg-red-50 border-l-4 border-red-500',
    important: 'bg-yellow-50 border-l-4 border-yellow-500',
    tip: 'bg-blue-50 border-l-4 border-blue-500',
  }

  const severityColor = {
    critical: 'text-red-700',
    important: 'text-yellow-700',
    tip: 'text-blue-700',
  }

  const badgeColor = {
    critical: 'bg-red-100 text-red-800',
    important: 'bg-yellow-100 text-yellow-800',
    tip: 'bg-blue-100 text-blue-800',
  }

  return (
    <div className={`p-4 rounded-lg ${severityMap[severity] || severityMap.important}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <h4 className={`font-semibold ${severityColor[severity] || severityColor.important}`}>
            {issue}
          </h4>
          <p className="text-sm text-gray-700 mt-1">{action}</p>
          {gain && (
            <div className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${badgeColor[severity] || badgeColor.important}`}>
              {gain}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
