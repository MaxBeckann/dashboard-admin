import { createFileRoute } from '@tanstack/react-router'
import { Presence } from '@/features/presence'

export const Route = createFileRoute('/_authenticated/presence/')({
  component: Presence,
})
