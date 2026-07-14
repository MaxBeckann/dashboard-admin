import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, MapPin, Play, Radio, Tv } from 'lucide-react'
import {
  applyPresenceEvent,
  isPresenceOnline,
  listPresence,
  subscribePresence,
  type PresenceRow,
} from '@/lib/presence-api'
import { getDisplayNameInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

const CONTENT_TYPE_LABEL: Record<string, string> = {
  live: 'Ao vivo',
  movie: 'Filme',
  series: 'Série',
}

export function Presence() {
  const qc = useQueryClient()
  const [now, setNow] = useState(() => Date.now())

  const query = useQuery({
    queryKey: ['presence'],
    queryFn: listPresence,
    // Rede de segurança caso o Realtime perca um evento.
    refetchInterval: 15_000,
  })

  // Realtime: aplica cada create/update/delete direto no cache do TanStack.
  useEffect(() => {
    const unsub = subscribePresence((row, isDelete) => {
      qc.setQueryData<PresenceRow[]>(['presence'], (prev) =>
        applyPresenceEvent(prev ?? [], row, isDelete)
      )
    })
    return () => unsub()
  }, [qc])

  // Tick local: offline não emite evento — recomputa pela idade do $updatedAt.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(t)
  }, [])

  const rows = query.data ?? []

  const sorted = useMemo(() => {
    const withState = rows.map((r) => ({
      row: r,
      online: isPresenceOnline(r.$updatedAt, now),
    }))
    return withState.sort((a, b) => {
      // 1) online antes de offline; 2) assistindo antes; 3) mais recente.
      if (a.online !== b.online) return a.online ? -1 : 1
      if (a.online && a.row.isWatching !== b.row.isWatching)
        return a.row.isWatching ? -1 : 1
      return (
        new Date(b.row.$updatedAt).getTime() -
        new Date(a.row.$updatedAt).getTime()
      )
    })
  }, [rows, now])

  const onlineCount = sorted.filter((s) => s.online).length
  const watchingCount = sorted.filter((s) => s.online && s.row.isWatching).length

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center gap-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <Radio className='size-6' /> Presença
            </h1>
            <p className='text-muted-foreground'>
              Quem está online agora e o que está assistindo, em tempo real.
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Badge variant='outline' className='gap-1.5 px-3 py-1 text-sm'>
              <span className='relative flex size-2.5'>
                <span
                  className={cn(
                    'absolute inline-flex size-full rounded-full opacity-75',
                    onlineCount > 0 && 'animate-ping bg-emerald-500'
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex size-2.5 rounded-full',
                    onlineCount > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                  )}
                />
              </span>
              {onlineCount} online
            </Badge>
            {watchingCount > 0 && (
              <Badge variant='secondary' className='gap-1.5 px-3 py-1 text-sm'>
                <Play className='size-3.5' /> {watchingCount} assistindo
              </Badge>
            )}
          </div>
        </div>

        {query.isLoading && (
          <div className='flex justify-center py-20'>
            <Loader2 className='size-6 animate-spin text-muted-foreground' />
          </div>
        )}

        {query.isError && (
          <div className='rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive'>
            Erro ao carregar presença. Confira as permissões da coleção
            (read: team:admins) e o CORS do projeto.
          </div>
        )}

        {!query.isLoading && !query.isError && sorted.length === 0 && (
          <div className='rounded-xl border p-12 text-center text-muted-foreground'>
            <Radio className='mx-auto mb-3 size-8 opacity-40' />
            Ninguém apareceu ainda. Assim que alguém abrir o app e escolher um
            perfil, aparece aqui ao vivo.
          </div>
        )}

        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {sorted.map(({ row, online }) => (
            <PresenceCard key={row.$id} row={row} online={online} />
          ))}
        </div>
      </Main>
    </>
  )
}

function PresenceCard({ row, online }: { row: PresenceRow; online: boolean }) {
  const watching = online && row.isWatching && !!row.contentTitle
  const lastSeen = formatDistanceToNow(new Date(row.$updatedAt), {
    addSuffix: true,
    locale: ptBR,
  })

  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border bg-card p-4 transition-colors',
        online ? 'border-emerald-500/30' : 'opacity-80'
      )}
    >
      <div className='relative shrink-0'>
        <Avatar className='size-12'>
          <AvatarImage
            src={row.avatarPath || '/default-avatar.jpg'}
            alt={row.name}
          />
          <AvatarFallback>
            {getDisplayNameInitials(row.name || '?')}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            'absolute -end-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-card',
            online ? 'bg-emerald-500' : 'bg-muted-foreground/50'
          )}
        />
      </div>

      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-2'>
          <p className='truncate font-medium'>{row.name || '(sem nome)'}</p>
          {online ? (
            <Badge
              variant='outline'
              className='shrink-0 border-emerald-500/40 text-emerald-500'
            >
              online
            </Badge>
          ) : (
            <Badge variant='outline' className='shrink-0 text-muted-foreground'>
              offline
            </Badge>
          )}
        </div>

        {watching ? (
          <div className='mt-2 flex items-center gap-2'>
            {row.contentPoster ? (
              <img
                src={row.contentPoster}
                alt={row.contentTitle ?? ''}
                className='h-14 w-10 shrink-0 rounded-md object-cover'
                loading='lazy'
              />
            ) : (
              <div className='flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-muted'>
                <Tv className='size-4 text-muted-foreground' />
              </div>
            )}
            <div className='min-w-0'>
              <div className='flex items-center gap-1 text-xs font-medium text-emerald-500'>
                <Play className='size-3' /> assistindo agora
              </div>
              <p className='truncate text-sm'>{row.contentTitle}</p>
              {row.contentType && CONTENT_TYPE_LABEL[row.contentType] && (
                <span className='text-xs text-muted-foreground'>
                  {CONTENT_TYPE_LABEL[row.contentType]}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className='mt-1.5 space-y-0.5'>
            {online ? (
              <p className='flex items-center gap-1 text-sm'>
                <MapPin className='size-3.5 text-emerald-500/80' />
                {row.screen ?? 'Navegando no app'}
              </p>
            ) : (
              <p className='text-sm text-muted-foreground'>
                última vez {lastSeen}
              </p>
            )}
            {row.contentTitle && (
              <p className='truncate text-xs text-muted-foreground'>
                último: {row.contentTitle}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
