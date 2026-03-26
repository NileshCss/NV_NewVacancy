import React from 'react'
import { timeAgo } from '../utils/helpers'

export default function NewsCard({ article }) {
  const emojis = { tech: '💻', govt: '🏛️', education: '🎓', general: '📰' }
  return (
    <a href={article.source_url} target="_blank" rel="noreferrer" className="news-card">
      <div className={`news-cat-tag ${article.category}`}>
        <span>{emojis[article.category] || '📰'}</span>
        {article.category.charAt(0).toUpperCase() + article.category.slice(1)}
      </div>
      <div className="news-body">
        <div className="news-title">{article.title}</div>
        {article.summary && <div className="news-summary">{article.summary}</div>}
        <div className="news-footer">
          <span className="news-time"><span>🕐</span>{timeAgo(article.published_at)}</span>
          <span className="news-source">{article.source_name} <span>↗</span></span>
        </div>
      </div>
    </a>
  )
}
