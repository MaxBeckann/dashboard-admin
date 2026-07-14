import { cn } from '@/lib/utils'

/** Card de indicador no estilo "premium" (rótulo em maiúsculas, número grande,
 * barra de progresso opcional e rodapé com valor à direita). */
export function Stat({
  label,
  value,
  sub,
  tone,
  progress,
  footerRight,
}: {
  label: string
  value: string
  sub?: string
  tone?: string
  progress?: number // 0-100 → mostra a barra
  footerRight?: string
}) {
  return (
    <div className='rounded-2xl border bg-muted/50 p-5'>
      <p className='text-[11px] font-semibold tracking-wider text-muted-foreground uppercase'>
        {label}
      </p>
      <p className={cn('mt-1.5 text-3xl font-bold tracking-tight', tone)}>
        {value}
      </p>
      {progress !== undefined && (
        <div className='mt-3 h-1.5 overflow-hidden rounded-full bg-muted'>
          <div
            className='h-full rounded-full bg-primary'
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {(sub || footerRight) && (
        <div className='mt-2 flex items-center gap-2'>
          {sub && <span className='text-xs text-muted-foreground'>{sub}</span>}
          {footerRight && (
            <span className='ms-auto text-xs font-semibold'>{footerRight}</span>
          )}
        </div>
      )}
    </div>
  )
}

export function Breakdown({
  title,
  rows,
}: {
  title: string
  rows: [string, number][]
}) {
  const max = rows.length ? rows[0][1] : 1
  return (
    <div className='rounded-2xl border bg-muted/50 p-5'>
      <p className='mb-3 text-sm font-semibold'>{title}</p>
      {rows.length === 0 ? (
        <p className='text-xs text-muted-foreground'>—</p>
      ) : (
        <div className='space-y-2.5'>
          {rows.map(([k, c]) => (
            <div key={k} className='flex items-center gap-2'>
              <span className='w-40 shrink-0 truncate text-xs' title={k}>
                {k}
              </span>
              <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'>
                <div
                  className='h-full rounded-full bg-primary/60'
                  style={{ width: `${(c / max) * 100}%` }}
                />
              </div>
              <span className='w-6 text-end text-xs font-semibold'>{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
