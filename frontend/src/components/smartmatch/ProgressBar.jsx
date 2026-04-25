import React, { useState, useEffect } from 'react'

export default function ProgressBar({ value = 0, max = 100, label = '', weight = '', animated = true, color = 'blue' }) {
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value)

  useEffect(() => {
    if (!animated) return

    const duration = 1000
    const steps = 50
    const increment = value / steps
    let current = 0

    const interval = setInterval(() => {
      current += increment
      if (current >= value) {
        setDisplayValue(value)
        clearInterval(interval)
      } else {
        setDisplayValue(Math.round(current))
      }
    }, duration / steps)

    return () => clearInterval(interval)
  }, [value, animated])

  const percentage = Math.min(100, (displayValue / max) * 100)

  const colorMap = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
    purple: 'from-purple-500 to-purple-600',
    red: 'from-red-500 to-red-600',
    gray: 'from-gray-500 to-gray-600',
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">{displayValue}</span>
          {weight && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{weight}</span>}
        </div>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colorMap[color] || colorMap.blue} rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
