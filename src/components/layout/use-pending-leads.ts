import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getSupportLeadsCount } from '@/lib/admin-api'

/**
 * Contagem de contratações pendentes (pro badge do menu/aba). SEM polling —
 * carrega ao abrir/navegar (F5) e no foco da janela (padrão do react-query).
 * Realtime fica como pendência (ver memória). Com `notify`, dispara um toast
 * quando a contagem sobe entre atualizações (usar só em UM lugar: o sidebar).
 */
export function usePendingLeads({ notify = false }: { notify?: boolean } = {}) {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['support-leads-count'],
    queryFn: getSupportLeadsCount,
  })
  const pending = q.data ?? 0

  const prev = useRef<number | null>(null)
  useEffect(() => {
    if (!notify) return
    if (q.data === undefined) return // ainda carregando → não notifica
    if (prev.current !== null && q.data > prev.current) {
      toast.info('🔔 Nova contratação pendente!', {
        description:
          'Um cliente foi direcionado ao WhatsApp. Abra Financeiro → Contratações.',
        duration: 8000,
      })
      // Atualiza a lista completa se estiver aberta em alguma tela.
      qc.invalidateQueries({ queryKey: ['support-leads'] })
    }
    prev.current = q.data
  }, [q.data, notify, qc])

  return pending
}
