import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">Memuat…</div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
