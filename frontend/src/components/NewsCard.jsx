import React from 'react'
import { timeAgo } from '../utils/helpers'

export default function NewsCard({ article }) {
  const emojis = { tech: '💻', govt: '🏛️', education: '🎓', general: '📰' }
  return (
    <a href={article.source_url} target="_blank" rel="noreferrer" className="news-card" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className={`news-cat-tag ${article.category || 'general'}`}>
        <span>{emojis[article.category] || '📰'}</span>
        {(article.category || 'General').charAt(0).toUpperCase() + (article.category || 'general').slice(1)}
      </div>
      <div className="news-body">
        <div className="news-title" style={{ color: 'var(--text-primary)' }}>{article.title}</div>
        {article.summary && <div className="news-summary" style={{ color: 'var(--text-secondary)' }}>{article.summary}</div>}
        <div className="news-footer">
          <span className="news-time" style={{ color: 'var(--text-muted)' }}><span>🕐</span>{timeAgo(article.published_at)}</span>
          <span className="news-source" style={{ color: 'var(--brand)' }}>{article.source_name} <span>↗</span></span>
        </div>
      </div>
    </a>
  )
}
