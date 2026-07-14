import { createFileRoute } from '@tanstack/react-router'
import { Iptv } from '@/features/iptv'

export const Route = createFileRoute('/_authenticated/iptv/')({
  component: Iptv,
})
