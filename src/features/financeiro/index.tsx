import { Link, Outlet } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { usePendingLeads } from '@/components/layout/use-pending-leads'

const tabs = [
  { to: '/financeiro', label: 'Visão geral', exact: true },
  { to: '/financeiro/pagamentos', label: 'Pagamentos', exact: false },
  { to: '/financeiro/renovacoes', label: 'Renovações', exact: false },
  { to: '/financeiro/contratacoes', label: 'Contratações', exact: false },
  { to: '/financeiro/funil', label: 'Funil', exact: false },
] as const

export function FinanceiroLayout() {
  // Mesma contagem (compartilhada). O toast global fica no sidebar.
  const pending = usePendingLeads()

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
          <h1 className='text-2xl font-bold tracking-tight'>Financeiro</h1>
          <p className='text-muted-foreground'>
            Pagamentos e contratações num só lugar — receita, pendências e
            conversão.
          </p>
        </div>

        <nav className='mb-5 inline-flex items-center gap-1 rounded-xl border bg-card p-1'>
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: t.exact }}
              className='inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
              activeProps={{
                className: 'bg-accent text-accent-foreground shadow-sm',
              }}
            >
              {t.label}
              {t.to === '/financeiro/contratacoes' && pending > 0 && (
                <Badge className='h-5 min-w-5 justify-center rounded-full bg-amber-500 px-1 text-[11px] text-black tabular-nums hover:bg-amber-500'>
                  {pending}
                </Badge>
              )}
            </Link>
          ))}
        </nav>

        <div className='rounded-2xl border bg-card p-4 sm:p-5'>
          <Outlet />
        </div>
      </Main>
    </>
  )
}
