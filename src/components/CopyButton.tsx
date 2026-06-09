import { useState } from 'react'
import { useToast } from '../context/ToastContext'

interface Props {
  text: string
  label?: string
  className?: string
  disabled?: boolean
}

/** Tombol salin teks ke clipboard, dengan fallback untuk browser lama / non-HTTPS. */
export default function CopyButton({ text, label = 'Copy', className, disabled }: Props) {
  const { toast } = useToast()
  const [done, setDone] = useState(false)

  async function copy() {
    if (!text) {
      toast('Belum ada teks untuk disalin', 'err')
      return
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setDone(true)
      toast('Disalin ke clipboard')
      setTimeout(() => setDone(false), 1500)
    } catch {
      toast('Gagal menyalin', 'err')
    }
  }

  return (
    <button type="button" onClick={copy} disabled={disabled} className={className ?? 'btn-secondary'}>
      {done ? '✓ Tersalin' : label}
    </button>
  )
}
