import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Wrap the entire bootstrap in try-catch so any import/init error is visible
async function bootstrap() {
  const root = ReactDOM.createRoot(document.getElementById('root'))

  try {
    // Dynamic imports so any broken module shows a clear error
    const { default: App } = await import('./App')
    const { ToastProvider } = await import('./context/ToastContext')
    const { AuthProvider } = await import('./context/AuthContext')
    const { ThemeProvider } = await import('./context/ThemeContext')
    const { RouterProvider } = await import('./context/RouterContext')
    const { default: ErrorBoundary } = await import('./components/ErrorBoundary')
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          staleTime: 5 * 60 * 1000,
          retry: 1,
        },
      },
    })

    root.render(
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <ThemeProvider>
                <RouterProvider>
                  <App />
                </RouterProvider>
              </ThemeProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    )

    console.log('[NV] App mounted successfully')
  } catch (err) {
    console.error('[NV] FATAL BOOTSTRAP ERROR:', err)
    // Show the error on screen so user can see it
    root.render(
      React.createElement('div', {
        style: {
          padding: '3rem',
          textAlign: 'center',
          color: '#ef4444',
          fontFamily: 'monospace',
          background: '#0f172a',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }
      },
        React.createElement('h2', { style: { marginBottom: '1rem', color: '#fca5a5' } }, '⚠️ App Failed to Start'),
        React.createElement('pre', {
          style: {
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '600px',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: '0.85rem',
            color: '#fca5a5',
          }
        }, String(err?.stack || err?.message || err)),
        React.createElement('button', {
          onClick: () => window.location.reload(),
          style: {
            marginTop: '1.5rem',
            padding: '0.7rem 1.5rem',
            background: '#f97316',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            cursor: 'pointer',
          }
        }, '🔄 Reload Page')
      )
    )
  }
}

bootstrap()
