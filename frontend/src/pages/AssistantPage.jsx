import { useState, useRef, useEffect } from 'react'
import { useRouter } from '../context/RouterContext'

export default function AssistantPage() {
  const { navigate } = useRouter()
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am the NewVacancy AI Assistant. Looking for a specific job? Just tell me what you want (e.g., "Find Java jobs in Bangalore for freshers" or "Any govt jobs paying over 5 LPA?").' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = { role: 'user', text: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages.slice(-4).map(m => ({ role: m.role, content: m.text }))
      const res = await fetch('http://localhost:5000/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg.text, history })
      })
      const data = await res.json()
      
      if (data.success) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          text: data.reply,
          jobs: data.jobs
        }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I encountered an error answering that.' }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Network error. Please try again later.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-wrap anim-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <div className="page-header" style={{ padding: '1.5rem 0', flexShrink: 0 }}>
        <div className="container">
          <h1 style={{ fontSize: '1.8rem' }}>🤖 AI Job Assistant</h1>
          <p>Search for jobs using natural language.</p>
        </div>
      </div>

      <div className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: '1rem', paddingTop: '1rem' }}>
        <div style={{ flex: 1, background: 'rgba(22,32,50,0.6)', border: '1px solid var(--white-8)', borderRadius: '16px 16px 0 0', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                padding: '1rem 1.25rem',
                borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                background: msg.role === 'user' ? 'var(--brand)' : 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '0.95rem',
                lineHeight: 1.6
              }}>
                {msg.text}
              </div>

              {/* Render Recommended Jobs if any */}
              {msg.jobs?.length > 0 && (
                <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', padding: '1rem 0', maxWidth: '100%', width: '100%' }}>
                  {msg.jobs.map(job => (
                    <div key={job.id} style={{ minWidth: '260px', background: 'var(--navy-8)', border: '1px solid var(--brand)', borderRadius: '12px', padding: '1rem', cursor: 'pointer' }} onClick={() => navigate(`jobs/${job.slug}`)}>
                      <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.3rem' }}>{job.title}</h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--grey-4)', marginBottom: '0.5rem' }}>{job.organization}</div>
                      <div style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 600 }}>{job.salary_range}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          
          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ padding: '1rem 1.25rem', borderRadius: '20px 20px 20px 4px', background: 'rgba(255,255,255,0.05)' }}>
                <div className="pulse" style={{ display: 'flex', gap: '0.3rem' }}>
                  <div style={{ width: 8, height: 8, background: 'var(--brand)', borderRadius: '50%' }} />
                  <div style={{ width: 8, height: 8, background: 'var(--brand)', borderRadius: '50%', animationDelay: '0.2s' }} />
                  <div style={{ width: 8, height: 8, background: 'var(--brand)', borderRadius: '50%', animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={sendMessage} style={{ display: 'flex', gap: '0.5rem', background: 'rgba(22,32,50,0.8)', padding: '1rem', border: '1px solid var(--white-8)', borderTop: 'none', borderRadius: '0 0 16px 16px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your job search query..."
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '1rem' }}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={!input.trim() || loading} style={{ padding: '0.6rem 1.5rem' }}>
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
