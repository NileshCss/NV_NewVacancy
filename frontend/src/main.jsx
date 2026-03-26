import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { RouterProvider } from './context/RouterContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <AuthProvider>
      <ThemeProvider>
        <RouterProvider>
          <App />
        </RouterProvider>
      </ThemeProvider>
    </AuthProvider>
  </ToastProvider>
)
