import React, { useState, useEffect } from 'react'
import { fetchExamCategories, fetchExams } from '../../services/api'
import { useRouter } from '../../context/RouterContext'
import { Loader2, Search, BookOpen, ChevronRight } from 'lucide-react'

export default function ExamDirectory() {
  const { navigate } = useRouter()
  const [categories, setCategories] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([fetchExamCategories(), fetchExams()])
      .then(([cats, exs]) => {
        setCategories(cats)
        setExams(exs.filter(e => e.status === 'published'))
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredExams = exams.filter(ex => 
    ex.name.toLowerCase().includes(search.toLowerCase()) || 
    ex.exam_categories?.name?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-[var(--text-primary)] mb-4">Exam Prep Directory</h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
          Browse our comprehensive syllabus, mock tests, and study materials for top government exams.
        </p>
        
        <div className="mt-8 max-w-xl mx-auto relative">
          <input 
            type="text" 
            placeholder="Search exams (e.g. UPSC, SSC CGL)..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-full py-3.5 pl-12 pr-6 text-base text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all duration-200 shadow-sm"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={20} />
        </div>
      </div>

      <div className="space-y-12">
        {categories.map(cat => {
          const catExams = filteredExams.filter(ex => ex.category_id === cat.id)
          if (catExams.length === 0) return null

          return (
            <div key={cat.id} className="bg-[var(--bg-card)] rounded-2xl p-6 md:p-8 border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                {cat.icon && <span className="text-3xl">{cat.icon}</span>}
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">{cat.name}</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catExams.map(ex => (
                  <div
                    key={ex.id} 
                    onClick={() => navigate(`exams/${ex.slug}`)}
                    className="group block p-6 rounded-xl border border-[var(--border)] hover:border-blue-500 bg-[var(--bg-surface)] hover:shadow-md transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg text-blue-600 dark:text-blue-400">
                        <BookOpen size={24} />
                      </div>
                      <ChevronRight className="text-[var(--text-muted)] group-hover:text-blue-500 transition-colors" />
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {ex.name}
                    </h3>
                    {ex.description && (
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                        {ex.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {filteredExams.length === 0 && (
          <div className="text-center text-[var(--text-muted)] py-12">
            No exams found matching your search.
          </div>
        )}
      </div>
    </div>
  )
}
