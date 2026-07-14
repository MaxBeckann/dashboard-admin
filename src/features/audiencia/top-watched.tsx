import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Search,
  Users,
} from 'lucide-react'
import {
  getTopWatchers,
  type SeriesEpisode,
  type TopWatchedItem,
  type WatcherEntry,
} from '@/lib/admin-api'
import { getDisplayNameInitials } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

/** Campo de busca (estilo "Buscar pessoas…") pro topo das listas. */
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className='relative'>
      <Search className='absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className='h-9 ps-8'
        autoFocus={false}
      />
    </div>
  )
}

// ── Selo por posição: #1 verde → #10 vermelho escuro (termômetro) ──────────
const RANK_COLORS = [
  '#22c55e', // 1 verde
  '#84cc16', // 2 lima
  '#eab308', // 3 amarelo
  '#f59e0b', // 4 âmbar
  '#f97316', // 5 laranja
  '#ef4444', // 6 vermelho
  '#dc2626', // 7
  '#b91c1c', // 8
  '#991b1b', // 9
  '#7f1d1d', // 10 vermelho escuro
]
export function rankColor(rank: number): string {
  return RANK_COLORS[Math.min(Math.max(rank, 1), 10) - 1]
}

/** Card do Top "Mais assistidos" — pilha de avatares + clique abre o drill-down. */
export function TopWatchedCard({
  item,
  rank,
}: {
  item: TopWatchedItem
  rank: number
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type='button' className='space-y-1 text-start focus:outline-none'>
          <div className='relative aspect-[2/3] overflow-hidden rounded-md bg-muted transition hover:ring-2 hover:ring-primary'>
            {item.poster ? (
              <img
                src={item.poster}
                alt={item.title}
                className='size-full object-cover'
                loading='lazy'
              />
            ) : (
              <div className='flex size-full items-center justify-center text-[10px] text-muted-foreground'>
                sem capa
              </div>
            )}
            <span
              className='absolute start-1 top-1 rounded px-1.5 text-[10px] font-bold text-white shadow-sm'
              style={{
                backgroundColor: rankColor(rank),
                textShadow: '0 1px 2px rgba(0,0,0,.7)',
              }}
            >
              #{rank}
            </span>
            {item.type === 'series' && (
              <span className='absolute end-1 top-1 rounded bg-black/70 px-1 text-[9px] font-medium text-white'>
                Série
              </span>
            )}
            <div className='absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1 pb-1 pt-4'>
              <AvatarStack watchers={item.watchers} total={item.count} />
            </div>
          </div>
          <p className='truncate text-[11px]' title={item.title}>
            {item.title}
          </p>
        </button>
      </DialogTrigger>
      <DialogContent className='max-w-md bg-card'>
        <WatchersDialogBody item={item} open={open} />
      </DialogContent>
    </Dialog>
  )
}

/** Corpo do dialog: filme = lista; série = episódios → (clique) watchers. */
function WatchersDialogBody({
  item,
  open,
}: {
  item: TopWatchedItem
  open: boolean
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['top-watchers', item.key, item.type],
    queryFn: () => getTopWatchers(item.key, item.type),
    enabled: open,
    staleTime: 60_000,
  })
  const [ep, setEp] = useState<SeriesEpisode | null>(null)
  useEffect(() => {
    if (!open) setEp(null)
  }, [open])

  return (
    <>
      <DialogHeader>
        <DialogTitle className='flex items-center gap-2'>
          {ep && (
            <button
              type='button'
              onClick={() => setEp(null)}
              className='rounded p-0.5 hover:bg-muted'
              aria-label='Voltar aos episódios'
            >
              <ChevronLeft className='size-4' />
            </button>
          )}
          <Users className='size-4' /> {ep ? ep.label : 'Quem assistiu'}
        </DialogTitle>
        <DialogDescription>
          <span className='font-medium text-foreground'>{item.title}</span> —{' '}
          {item.count} {item.count === 1 ? 'espectador' : 'espectadores'}
          {item.type === 'series' ? ' (perfis que assistiram a série)' : ''}
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className='flex justify-center py-8'>
          <Loader2 className='size-5 animate-spin text-muted-foreground' />
        </div>
      ) : !data ? (
        <EmptyMsg>Sem dados de quem assistiu.</EmptyMsg>
      ) : data.type === 'movie' ? (
        <WatcherList watchers={data.watchers} />
      ) : ep ? (
        <WatcherList watchers={ep.watchers} />
      ) : (
        <EpisodeList episodes={data.episodes} onSelect={setEp} />
      )}
    </>
  )
}

/** Lista de EPISÓDIOS assistidos (série) — cada um com pilha de avatares. */
function EpisodeList({
  episodes,
  onSelect,
}: {
  episodes: SeriesEpisode[]
  onSelect: (e: SeriesEpisode) => void
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return episodes
    return episodes.filter((e) =>
      `${e.label} ${e.title}`.toLowerCase().includes(term)
    )
  }, [episodes, q])

  if (episodes.length === 0)
    return <EmptyMsg>Nenhum episódio assistido ainda.</EmptyMsg>

  return (
    <div className='space-y-2'>
      <SearchBox value={q} onChange={setQ} placeholder='Buscar episódio…' />
      {filtered.length === 0 ? (
        <EmptyMsg>Nenhum episódio encontrado.</EmptyMsg>
      ) : (
        <div className='max-h-[55vh] space-y-1 overflow-y-auto'>
          {filtered.map((e) => (
            <button
              key={e.episodeId}
              type='button'
              onClick={() => onSelect(e)}
              className='flex w-full items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-start text-sm transition hover:bg-muted'
            >
              <span className='truncate font-medium'>{e.label}</span>
              <span className='flex shrink-0 items-center gap-2'>
                <AvatarStack
                  watchers={e.watchers.map((w) => ({
                    name: w.profileName || w.accountName,
                    avatarUrl: w.avatarUrl,
                  }))}
                  total={e.count}
                />
                <ChevronRight className='size-4 text-muted-foreground' />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Lista de espectadores — nome/conta + quando + tempo assistido. Com busca. */
function WatcherList({ watchers }: { watchers: WatcherEntry[] }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return watchers
    return watchers.filter((w) =>
      [w.accountName, w.accountEmail, w.profileName].some((x) =>
        (x || '').toLowerCase().includes(term)
      )
    )
  }, [watchers, q])

  if (watchers.length === 0)
    return <EmptyMsg>Sem dados de quem assistiu.</EmptyMsg>

  return (
    <div className='space-y-2'>
      <SearchBox value={q} onChange={setQ} placeholder='Buscar pessoas…' />
      {filtered.length === 0 ? (
        <EmptyMsg>Ninguém encontrado.</EmptyMsg>
      ) : (
        <div className='max-h-[55vh] space-y-1 overflow-y-auto'>
          {filtered.map((w, i) => (
        <div
          key={w.profileId + i}
          className='flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2'
        >
          <div className='flex min-w-0 items-center gap-2'>
            <Avatar className='size-8'>
              {w.avatarUrl && (
                <AvatarImage src={w.avatarUrl} alt={w.profileName} />
              )}
              <AvatarFallback className='text-xs'>
                {getDisplayNameInitials(
                  w.accountName || w.profileName || '?'
                )}
              </AvatarFallback>
            </Avatar>
            <div className='min-w-0'>
              <p className='truncate text-sm font-medium'>
                {w.accountName || w.accountEmail || w.profileName || 'Usuário'}
              </p>
              <p className='truncate text-xs text-muted-foreground'>
                {[
                  w.profileName ? `Perfil: ${w.profileName}` : '',
                  w.accountName && w.accountEmail ? w.accountEmail : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <div className='shrink-0 text-end text-xs'>
            <p className='flex items-center justify-end gap-1 font-medium'>
              <Clock className='size-3' />
              {fmtWatched(w.watchedSec, w.totalSec)}
            </p>
            <p className='text-muted-foreground'>{fmtDateTime(w.when)}</p>
          </div>
        </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Pilha de avatares sobreposta (prévia) com "+N". */
function AvatarStack({
  watchers,
  total,
}: {
  watchers: { name: string; avatarUrl: string | null }[]
  total: number
}) {
  if (total <= 0) return null
  const shown = watchers.slice(0, 3)
  const extra = total - shown.length
  return (
    <div className='flex items-center -space-x-1.5'>
      {shown.map((w, i) => (
        <StackAvatar key={i} name={w.name} url={w.avatarUrl} />
      ))}
      {extra > 0 && (
        <span className='flex size-5 items-center justify-center rounded-full bg-zinc-700 text-[8px] font-semibold text-white ring-1 ring-black/40'>
          +{extra}
        </span>
      )}
    </div>
  )
}

function StackAvatar({ name, url }: { name: string; url: string | null }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  return url ? (
    <img
      src={url}
      alt={name}
      className='size-5 rounded-full object-cover ring-1 ring-black/40'
      loading='lazy'
    />
  ) : (
    <span className='flex size-5 items-center justify-center rounded-full bg-primary text-[8px] font-semibold text-primary-foreground ring-1 ring-black/40'>
      {initial}
    </span>
  )
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return (
    <p className='py-6 text-center text-sm text-muted-foreground'>{children}</p>
  )
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDuration(sec: number): string {
  if (!sec || sec < 0) return '0s'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  if (m > 0) return `${m}min`
  return `${s}s`
}

/** "23min · 51%" (assistido · % do total, quando há duração). */
function fmtWatched(watchedSec: number, totalSec: number): string {
  const w = fmtDuration(watchedSec)
  if (totalSec > 0) {
    const pct = Math.min(100, Math.round((watchedSec / totalSec) * 100))
    return `${w} · ${pct}%`
  }
  return w
}
