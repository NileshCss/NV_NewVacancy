import React from 'react'
import { NEWS_DATA } from '../data/mockData'

export default function NewsTicker() {
  const items = NEWS_DATA.filter(n => n.is_featured)
  const doubled = [...items, ...items]
  return (
    <div className="ticker-bar">
      <div className="ticker-inner container">
        <div className="ticker-label">🔴 Live</div>
        <div className="ticker-track">
          <div className="ticker-content">
            {doubled.map((item, i) => (
              <span key={i} className="ticker-item">
                <span className="ticker-dot">●</span>
                {item.title}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
