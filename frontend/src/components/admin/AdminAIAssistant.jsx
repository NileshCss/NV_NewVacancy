import React, { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { useToast } from '../../context/ToastContext'

const INPUT_STYLE = {
  background: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  fontFamily: 'inherit',
}

const BUTTON_STYLE = {
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: '500',
}

const Spinner = () => (
  <span style={{
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin .7s linear infinite',
    display: 'inline-block',
  }} />
)

export default function AdminAIAssistant() {
  const toast = useToast()

  // State
  const [prompt, setPrompt] = useState('')
  const [action, setAction] = useState('answer') // answer, content, analyze
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const { data } = await supabase
        .from('ai_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      setHistory(data || [])
    } catch (err) {
      console.error('Failed to load AI history:', err.message)
    }
  }

  const callAI = async (e) => {
    e.preventDefault()

    if (!prompt.trim()) {
      toast('Please enter a prompt', 'error')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          prompt: prompt.trim(),
          action,
        },
      })

      if (error) {
        throw new Error(error.message || 'AI function error')
      }

      if (data.success) {
        setResponse(data.response)
        setPrompt('')
        toast('AI response received! ✅', 'success')
        
        // Reload history to include the new interaction
        setTimeout(loadHistory, 1000)
      } else {
        throw new Error(data.error || 'No response from AI')
      }
    } catch (err) {
      toast(err.message || 'Failed to get AI response', 'error')
      console.error('AI error:', err)
    } finally {
      setLoading(false)
    }
  }

  const quickPrompts = {
    answer: [
      'What are the best practices for job board design?',
      'How can we improve user engagement?',
      'What features should we add next?',
    ],
    content: [
      'Generate a blog post about the future of remote work',
      'Write a news article about AI in recruiting',
      'Create educational content about career planning',
    ],
    analyze: [
      'Analyze our job board data and provide insights',
      'What are the trends in our user data?',
      'Which job categories are most popular?',
    ],
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 'bold' }}>
          ✨ AI Assistant
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
          Generate content, answer questions, and analyze data using AI
        </p>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left: Input & Response */}
        <div>
          {/* Action Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              AI Mode
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {['answer', 'content', 'analyze'].map((a) => (
                <button
                  key={a}
                  onClick={() => setAction(a)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: action === a ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: action === a ? 'transparent' : 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: action === a ? '600' : '500',
                    fontSize: '14px',
                  }}
                >
                  {a === 'answer' && '❓ Answer'}
                  {a === 'content' && '✍️ Generate'}
                  {a === 'analyze' && '📊 Analyze'}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input */}
          <form onSubmit={callAI} style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
              Your Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              style={{
                ...INPUT_STYLE,
                height: '100px',
                marginBottom: '12px',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
              placeholder="Ask anything or describe what you need..."
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                ...BUTTON_STYLE,
                width: '100%',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <Spinner /> : '🚀 Send to AI'}
            </button>
          </form>

          {/* Quick Prompts */}
          {!response && !loading && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
                Quick Prompts
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {quickPrompts[action].map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPrompt(p)
                    }}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      textAlign: 'left',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'var(--accent)'}
                    onMouseLeave={(e) => e.target.style.background = 'var(--bg-secondary)'}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Response Display */}
          {response && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>🤖 AI Response</h4>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(response)
                    toast('Copied to clipboard! ✅', 'success')
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  📋 Copy
                </button>
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  lineHeight: '1.6',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {response}
              </div>
              <button
                onClick={() => setResponse('')}
                style={{
                  marginTop: '12px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                🔄 New Prompt
              </button>
            </div>
          )}
        </div>

        {/* Right: Statistics & History */}
        <div>
          {/* Stats Cards */}
          <div style={{ 
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            border: '1px solid var(--border)',
          }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600' }}>📈 AI Usage</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ 
                background: 'var(--bg-primary)',
                padding: '12px',
                borderRadius: '6px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent)' }}>
                  {history.length}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Interactions
                </div>
              </div>
              <div style={{
                background: 'var(--bg-primary)',
                padding: '12px',
                borderRadius: '6px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--accent)' }}>
                  {history.reduce((sum, h) => sum + (h.tokens_used || 0), 0)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Total Tokens
                </div>
              </div>
            </div>
          </div>

          {/* Activity History Toggle */}
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '16px',
            border: '1px solid var(--border)',
          }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: '500',
                marginBottom: '12px',
              }}
            >
              {showHistory ? '▼' : '▶'} Activity History ({history.length})
            </button>

            {showHistory && (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {history.length === 0 ? (
                  <div style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                  }}>
                    No AI activity yet
                  </div>
                ) : (
                  history.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        background: 'var(--bg-input)',
                        borderRadius: '6px',
                        marginBottom: '8px',
                        fontSize: '12px',
                        borderLeft: '3px solid var(--accent)',
                      }}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {item.action.toUpperCase()}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        {item.prompt.substring(0, 60)}...
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {item.tokens_used} tokens • {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        fontSize: '13px',
        color: 'var(--text-secondary)',
      }}>
        <strong>💡 Tips:</strong>
        <ul style={{ margin: '8px 0 0 16px', paddingLeft: '12px' }}>
          <li><strong>Answer:</strong> Ask questions and get instant responses</li>
          <li><strong>Generate:</strong> Create news articles, blogs, and educational content</li>
          <li><strong>Analyze:</strong> Get insights about your job board data</li>
        </ul>
      </div>
    </div>
  )
}
