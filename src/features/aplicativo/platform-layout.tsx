import { Link, Outlet } from '@tanstack/react-router'
import { type PlatformKey } from '@/lib/admin-api'

const SCREENS = [
  { to: '/aplicativo/$platform/inicio', label: 'Início' },
  { to: '/aplicativo/$platform/filmes', label: 'Filmes' },
  { to: '/aplicativo/$platform/series', label: 'Séries' },
  { to: '/aplicativo/$platform/aovivo', label: 'Ao Vivo' },
] as const

/** Sub-navegação das TELAS de uma plataforma (Início/Filmes/Séries/Ao Vivo). */
export function PlatformLayout({ platform }: { platform: PlatformKey }) {
  return (
    <div className='space-y-5'>
      <nav className='inline-flex flex-wrap items-center gap-1 rounded-xl border bg-background/40 p-1'>
        {SCREENS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            params={{ platform }}
            className='inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
            activeProps={{
              className: 'bg-accent text-accent-foreground shadow-sm',
            }}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}
