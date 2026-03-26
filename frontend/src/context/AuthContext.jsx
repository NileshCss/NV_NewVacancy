import { createContext, useContext, useState } from 'react'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [savedJobs, setSavedJobs] = useState([])

  const login = (email, name, role = 'user') =>
    setUser({ email, name, role, id: 'u_' + Date.now() })

  const logout = () => { setUser(null); setSavedJobs([]) }

  const toggleSave = (jobId) =>
    setSavedJobs(s =>
      s.includes(jobId) ? s.filter(x => x !== jobId) : [...s, jobId]
    )

  const isAdmin = user?.role === 'admin'

  return (
    <AuthCtx.Provider value={{ user, savedJobs, login, logout, toggleSave, isAdmin }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
