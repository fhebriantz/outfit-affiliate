import { Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PostingEditorPage from './pages/PostingEditorPage'
import ProductsPage from './pages/ProductsPage'
import SettingsPage from './pages/SettingsPage'
import { isSupabaseConfigured } from './lib/supabase'

function SetupNeeded() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="card">
        <h1 className="text-lg font-bold text-brand-700">Supabase belum dikonfigurasi</h1>
        <p className="mt-2 text-sm text-gray-600">
          Salin file <code className="rounded bg-gray-100 px-1">.env.example</code> jadi{' '}
          <code className="rounded bg-gray-100 px-1">.env</code>, lalu isi{' '}
          <code className="rounded bg-gray-100 px-1">VITE_SUPABASE_URL</code> dan{' '}
          <code className="rounded bg-gray-100 px-1">VITE_SUPABASE_ANON_KEY</code> dari dashboard
          Supabase kamu. Lihat <code className="rounded bg-gray-100 px-1">README.md</code> untuk
          langkah lengkapnya.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNeeded />

  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/posting/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <PostingEditorPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/produk"
          element={
            <ProtectedRoute>
              <Layout>
                <ProductsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
