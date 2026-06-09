interface Props {
  synced: boolean
  size?: 'sm' | 'md'
}

export default function SyncBadge({ synced, size = 'sm' }: Props) {
  const base =
    size === 'sm'
      ? 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold'
      : 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold'
  return (
    <span
      className={
        base +
        ' ' +
        (synced ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')
      }
    >
      <span className={'h-1.5 w-1.5 rounded-full ' + (synced ? 'bg-green-500' : 'bg-amber-500')} />
      {synced ? 'Sinkron' : 'Belum lengkap'}
    </span>
  )
}
