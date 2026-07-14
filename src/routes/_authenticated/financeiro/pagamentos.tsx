import { createFileRoute } from '@tanstack/react-router'
import { FinanceiroPagamentos } from '@/features/financeiro/pagamentos'

export const Route = createFileRoute('/_authenticated/financeiro/pagamentos')({
  component: FinanceiroPagamentos,
})
