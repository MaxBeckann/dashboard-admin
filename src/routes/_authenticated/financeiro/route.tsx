import { createFileRoute } from '@tanstack/react-router'
import { FinanceiroLayout } from '@/features/financeiro'

export const Route = createFileRoute('/_authenticated/financeiro')({
  component: FinanceiroLayout,
})
