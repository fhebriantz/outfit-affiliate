import { createContext, useContext, useState, type ReactNode } from 'react'

// Toast ringan tanpa dependensi tambahan.
type Toast = { id: number; msg: string; kind: 'ok' | 'err' }

interface ToastState {
  toast: (msg: string, kind?: 'ok' | 'err') => void
}

const ToastContext = createContext<ToastState | undefined>(undefined)

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])

  const toast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = ++counter
    setItems((prev) => [...prev, { id, msg, kind }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2600)
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              'pointer-events-none rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ' +
              (t.kind === 'ok' ? 'bg-gray-900/90' : 'bg-red-600/95')
            }
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastState {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast harus dipakai di dalam ToastProvider')
  return ctx
}
