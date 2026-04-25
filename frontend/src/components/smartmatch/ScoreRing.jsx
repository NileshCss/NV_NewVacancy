import React, { useState, useEffect } from 'react'

export default function ScoreRing({ score = 0, grade = 'A', size = 140, animated = true }) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)

  useEffect(() => {
    if (!animated) return

    const duration = 1200
    const steps = 60
    const increment = score / steps
    let current = 0

    const interval = setInterval(() => {
      current += increment
      if (current >= score) {
        setDisplayScore(score)
        clearInterval(interval)
      } else {
        setDisplayScore(Math.round(current))
      }
    }, duration / steps)

    return () => clearInterval(interval)
  }, [score, animated])

  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (displayScore / 100) * circumference

  // Color by score
  const getColor = () => {
    if (displayScore >= 85) return '#10b981' // green
    if (displayScore >= 75) return '#f59e0b' // amber
    if (displayScore >= 65) return '#3b82f6' // blue
    if (displayScore >= 55) return '#8b5cf6' // purple
    if (displayScore >= 45) return '#ef4444' // red
    return '#6b7280' // gray
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-lg"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="4"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: animated ? 'none' : 'stroke-dashoffset 1.2s ease-out',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
          }}
        />
      </svg>

      {/* Score text */}
      <div className="absolute flex flex-col items-center">
        <div className="text-3xl font-bold" style={{ color: getColor() }}>
          {displayScore}
        </div>
        <div className="text-sm font-semibold text-gray-600">
          {grade}
        </div>
      </div>
    </div>
  )
}
