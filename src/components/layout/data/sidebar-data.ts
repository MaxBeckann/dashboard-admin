import {
  Bell,
  Flame,
  LayoutDashboard,
  Radio,
  ScrollText,
  Smartphone,
  Tags,
  Ticket,
  Tv,
  Users,
  Wallet,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: 'Geral',
      items: [
        { title: 'Início', url: '/', icon: LayoutDashboard },
        { title: 'Presença', url: '/presence', icon: Radio },
        { title: 'Audiência', url: '/audiencia', icon: Flame },
      ],
    },
    {
      title: 'Clientes',
      items: [
        { title: 'Usuários', url: '/user-admin', icon: Users },
        { title: 'Mensagens', url: '/messages', icon: Bell },
      ],
    },
    {
      title: 'Financeiro',
      items: [
        { title: 'Financeiro', url: '/financeiro', icon: Wallet },
        { title: 'Planos', url: '/planos', icon: Tags },
        { title: 'Cupons', url: '/coupons', icon: Ticket },
      ],
    },
    {
      title: 'Serviços',
      items: [
        { title: 'IPTV', url: '/iptv', icon: Tv },
        { title: 'Aplicativo', url: '/aplicativo', icon: Smartphone },
        { title: 'Auditoria', url: '/auditoria', icon: ScrollText },
      ],
    },
  ],
}
