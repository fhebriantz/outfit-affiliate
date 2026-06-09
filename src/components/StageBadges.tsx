import type { PostingStage } from '../lib/format'

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ' +
        (ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')
      }
    >
      <span>{ok ? '✓' : '○'}</span>
      {label}
    </span>
  )
}

/** Dua chip tahap konten: screenshot referensi & hasil generate. */
export default function StageBadges({ stage, imageCount }: { stage: PostingStage; imageCount: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip ok={stage.hasScreenshot} label={stage.hasScreenshot ? `Screenshot (${imageCount})` : 'Belum screenshot'} />
      <Chip ok={stage.hasGenerate} label={stage.hasGenerate ? 'Hasil generate' : 'Belum generate'} />
      <Chip ok={stage.hasAffiliate} label={stage.hasAffiliate ? 'Link affiliate' : 'Belum affiliate'} />
    </div>
  )
}
