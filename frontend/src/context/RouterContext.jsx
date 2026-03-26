import { createContext, useContext, useState, useCallback } from 'react'

const RouterCtx = createContext(null)

export function RouterProvider({ children }) {
  const [page, setPage] = useState('home')
  const navigate = useCallback((p) => {
    setPage(p)
    window.scrollTo(0, 0)
  }, [])
  return (
    <RouterCtx.Provider value={{ page, navigate }}>
      {children}
    </RouterCtx.Provider>
  )
}

export const useRouter = () => useContext(RouterCtx)
