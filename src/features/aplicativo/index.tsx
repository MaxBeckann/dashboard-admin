import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { EyeOff, Monitor, Settings, Smartphone } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { type PlatformKey } from '@/lib/admin-api'

const platformTabs: {
  platform: PlatformKey
  label: string
  icon: typeof Monitor
}[] = [
  { platform: 'tv', label: 'TV / PC', icon: Monitor },
  { platform: 'mobile', label: 'Smartphones', icon: Smartphone },
]

export function AplicativoLayout() {
  const { pathname } = useLocation()

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
          <h1 className='text-2xl font-bold tracking-tight'>Aplicativo</h1>
          <p className='text-muted-foreground'>
            Controle o comportamento do app sem gerar build — por plataforma
            (TV/PC vs Smartphones) e por tela. As mudanças chegam no próximo boot.
          </p>
        </div>

        <nav className='mb-5 inline-flex flex-wrap items-center gap-1 rounded-xl border bg-card p-1'>
          {platformTabs.map((t) => {
            const active = pathname.startsWith(`/aplicativo/${t.platform}`)
            return (
              <Link
                key={t.platform}
                to='/aplicativo/$platform'
                params={{ platform: t.platform }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <t.icon className='size-4' />
                {t.label}
              </Link>
            )
          })}
          <Link
            to='/aplicativo/geral'
            className='inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
            activeProps={{
              className: 'bg-accent text-accent-foreground shadow-sm',
            }}
          >
            <Settings className='size-4' />
            Configuração Geral
          </Link>
          {/* Vermelho de propósito: é a única aba desta seção que REMOVE
              conteúdo do app dos clientes. Precisa destoar das demais. */}
          <Link
            to='/aplicativo/ocultar'
            className='inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:text-red-500 dark:text-red-500'
            activeProps={{
              className:
                'bg-red-600 text-white shadow-sm hover:text-white dark:text-white',
            }}
          >
            <EyeOff className='size-4' />
            Ocultar Conteúdo
          </Link>
        </nav>

        <div className='rounded-2xl border bg-card p-4 sm:p-5'>
          <Outlet />
        </div>
      </Main>
    </>
  )
}
