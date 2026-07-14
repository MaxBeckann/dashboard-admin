import { createFileRoute } from '@tanstack/react-router'
import { Messages } from '@/features/messages'

export const Route = createFileRoute('/_authenticated/messages/')({
  component: Messages,
})
