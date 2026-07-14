import { createFileRoute } from '@tanstack/react-router'
import { Planos } from '@/features/planos'

export const Route = createFileRoute('/_authenticated/planos/')({
  component: Planos,
})
