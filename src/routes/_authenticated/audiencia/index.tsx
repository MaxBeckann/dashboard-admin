import { createFileRoute } from '@tanstack/react-router'
import { Audiencia } from '@/features/audiencia'

export const Route = createFileRoute('/_authenticated/audiencia/')({
  component: Audiencia,
})
