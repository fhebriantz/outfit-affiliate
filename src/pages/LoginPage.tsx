import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ALLOW_SIGNUP = import.meta.env.VITE_ALLOW_SIGNUP !== 'false'

export default function LoginPage() {
  const { session, signIn, signUp, loading } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    const fn = mode === 'login' ? signIn : signUp
    const { error } = await fn(email.trim(), password)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    if (mode === 'signup') {
      setInfo('Akun dibuat. Kalau konfirmasi email aktif, cek email dulu. Kalau tidak, langsung masuk.')
      setMode('login')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/icon.svg" alt="" className="mx-auto mb-3 h-14 w-14 rounded-2xl" />
          <h1 className="text-xl font-bold text-gray-900">Outfit Affiliate Manager</h1>
          <p className="text-sm text-gray-500">Kelola postingan, link & caption affiliate-mu.</p>
        </div>

        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {info && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{info}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Daftar'}
          </button>

          {ALLOW_SIGNUP && (
            <p className="text-center text-sm text-gray-500">
              {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
              <button
                type="button"
                className="font-semibold text-sec-700 hover:underline"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login')
                  setError(null)
                  setInfo(null)
                }}
              >
                {mode === 'login' ? 'Daftar' : 'Masuk'}
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
