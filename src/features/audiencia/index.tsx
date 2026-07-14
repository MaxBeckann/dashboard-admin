import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Flame } from 'lucide-react'
import { getTopWatched } from '@/lib/admin-api'
import { cn } from '@/lib/utils'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { AudienceOverview } from './audience-overview'
import { TopWatchedCard } from './top-watched'

const TABS = [
  { key: 'inicio', label: 'Início' },
  { key: 'movie', label: 'Filmes' },
  { key: 'series', label: 'Séries' },
] as const
type TabKey = (typeof TABS)[number]['key']

/** Aba "Audiência" — Início (analytics) + Filmes/Séries (mais assistidos com
 *  drill-down de quem assistiu). */
export function Audiencia() {
  const [tab, setTab] = useState<TabKey>('inicio')
  const { data, isLoading } = useQuery({
    queryKey: ['top-watched', 50],
    queryFn: () => getTopWatched(50),
    enabled: tab !== 'inicio', // só busca o grid quando numa aba de tipo
    refetchInterval: 60_000,
  })
  const items = data?.items ?? []
  const filtered = useMemo(
    () => items.filter((i) => i.type === tab),
    [items, tab]
  )

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
        <div className='mb-4'>
          <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
            <Flame className='size-6' /> Audiência
          </h1>
          <p className='text-muted-foreground'>
            Quem assiste, o que assiste e quanto assiste — cada pessoa conta 1.
          </p>
        </div>

        {/* Sub-abas Início / Filmes / Séries (estilo do Financeiro). */}
        <nav className='mb-5 inline-flex items-center gap-1 rounded-xl border bg-card p-1'>
          {TABS.map((t) => (
            <button
              key={t.key}
              type='button'
              onClick={() => setTab(t.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
                tab === t.key
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'inicio' ? (
          <div className='rounded-2xl border bg-card p-4 sm:p-5'>
            <AudienceOverview />
          </div>
        ) : (
          <div className='rounded-2xl border bg-card p-4 sm:p-5'>
            {isLoading ? (
              <p className='py-10 text-center text-muted-foreground'>
                Carregando…
              </p>
            ) : filtered.length === 0 ? (
              <p className='py-10 text-center text-muted-foreground'>
                Ainda sem {tab === 'series' ? 'séries' : 'filmes'} no histórico.
              </p>
            ) : (
              <div className='grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'>
                {filtered.map((w, i) => (
                  <TopWatchedCard key={w.key} item={w} rank={i + 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </Main>
    </>
  )
}
