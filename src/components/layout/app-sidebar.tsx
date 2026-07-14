import { useMemo } from 'react'
import { useLayout } from '@/context/layout-provider'
import { useAuthStore } from '@/stores/auth-store'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { usePendingLeads } from './use-pending-leads'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const authUser = useAuthStore((s) => s.auth.user)

  // Poll global + notificação (o sidebar está sempre montado → alerta em
  // qualquer página). Injeta a contagem como badge no item "Financeiro".
  const pending = usePendingLeads({ notify: true })
  const navGroups = useMemo(() => {
    if (!pending) return sidebarData.navGroups
    return sidebarData.navGroups.map((g) => ({
      ...g,
      items: g.items.map((it) =>
        'url' in it && it.url === '/financeiro'
          ? { ...it, badge: String(pending) }
          : it
      ),
    }))
  }, [pending])

  const user = {
    name: authUser?.name || authUser?.email?.split('@')[0] || 'Admin',
    email: authUser?.email || '',
    avatar: '',
  }

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
