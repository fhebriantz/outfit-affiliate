import { Link, NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    'px-3 py-1.5 rounded-lg text-sm font-medium transition ' +
    (isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100')

  // Item navbar bawah (mobile): kolom sama lebar, tidak bisa digeser.
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    'flex-1 py-2.5 text-center text-xs font-medium transition ' +
    (isActive ? 'text-brand-700' : 'text-gray-500')

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-brand-700">
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span>Outfit Affiliate</span>
          </Link>
          {/* Nav atas: hanya layar lebar */}
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/" end className={navClass}>
              Postingan
            </NavLink>
            <NavLink to="/produk" className={navClass}>
              Produk
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              Pengaturan
            </NavLink>
            <button onClick={handleLogout} className="btn-ghost" title={user?.email ?? ''}>
              Keluar
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 pb-24">{children}</main>

      {/* Navbar bawah: hanya mobile, kolom sama lebar (anti geser) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white sm:hidden">
        <div className="mx-auto flex max-w-3xl">
          <NavLink to="/" end className={tabClass}>
            Postingan
          </NavLink>
          <NavLink to="/produk" className={tabClass}>
            Produk
          </NavLink>
          <NavLink to="/settings" className={tabClass}>
            Pengaturan
          </NavLink>
          <button onClick={handleLogout} className="flex-1 py-2.5 text-center text-xs font-medium text-gray-500">
            Keluar
          </button>
        </div>
      </nav>
    </div>
  )
}
