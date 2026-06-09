import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

const ICON = 'h-5 w-5 shrink-0'

function IconPosting() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="13" y2="18" />
    </svg>
  )
}
function IconProduk() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}
function IconSetting() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}
function IconLogout() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    setMenuOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ' +
    (isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100')

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    'flex items-center gap-3 px-4 py-3 text-sm transition ' +
    (isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-50')

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="relative mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-brand-700">
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span>Outfit Affiliate</span>
          </Link>

          {/* Nav atas: layar lebar */}
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/" end className={navClass}>
              <IconPosting /> Postingan
            </NavLink>
            <NavLink to="/produk" className={navClass}>
              <IconProduk /> Produk
            </NavLink>
            <NavLink to="/settings" className={navClass}>
              <IconSetting /> Pengaturan
            </NavLink>
            <button onClick={handleLogout} className="btn-ghost gap-1.5" title={user?.email ?? ''}>
              <IconLogout /> Keluar
            </button>
          </nav>

          {/* Burger: mobile */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-lg text-gray-600 hover:bg-gray-100 sm:hidden"
            aria-label="Menu"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>

          {/* Dropdown menu mobile */}
          {menuOpen && (
            <div
              className="absolute right-4 top-full z-40 mt-1 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg sm:hidden"
              role="menu"
            >
              <NavLink to="/" end className={itemClass} onClick={() => setMenuOpen(false)}>
                <IconPosting /> Postingan
              </NavLink>
              <NavLink to="/produk" className={itemClass} onClick={() => setMenuOpen(false)}>
                <IconProduk /> Produk
              </NavLink>
              <NavLink to="/settings" className={itemClass} onClick={() => setMenuOpen(false)}>
                <IconSetting /> Pengaturan
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <IconLogout /> Keluar
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Klik di luar menu untuk menutup */}
      {menuOpen && <div className="fixed inset-0 z-20 sm:hidden" onClick={() => setMenuOpen(false)} />}

      <main className="mx-auto max-w-3xl px-4 py-5 pb-16">{children}</main>
    </div>
  )
}
