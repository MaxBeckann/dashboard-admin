import { createFileRoute } from '@tanstack/react-router'
import { Dns } from '@/features/dns'

export const Route = createFileRoute('/_authenticated/dns/')({
  component: Dns,
})
