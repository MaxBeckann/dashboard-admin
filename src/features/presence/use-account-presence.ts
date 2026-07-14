import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyPresenceEvent,
  isPresenceOnline,
  listPresence,
  subscribePresence,
  type PresenceRow,
} from '@/lib/presence-api'

export interface AccountPresence {
  online: boolean
  watching: boolean
  row: PresenceRow | null
}

/** Estado de presença agregado de uma conta (para listas de usuários). */
export interface PresenceState {
  online: boolean
  watching: boolean
  updatedAt: string
  row: PresenceRow
}

/**
 * Base ao vivo: carrega `['presence']` (compartilhado), assina Realtime e faz
 * um tick local de 5s (offline não emite evento → recomputa pela idade).
 */
function usePresenceLive() {
  const qc = useQueryClient()
  const [now, setNow] = useState(() => Date.now())

  const query = useQuery({
    queryKey: ['presence'],
    queryFn: listPresence,
    refetchInterval: 15_000,
  })

  useEffect(() => {
    const unsub = subscribePresence((row, isDelete) => {
      qc.setQueryData<PresenceRow[]>(['presence'], (prev) =>
        applyPresenceEvent(prev ?? [], row, isDelete)
      )
    })
    return () => unsub()
  }, [qc])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(t)
  }, [])

  return { rows: query.data ?? [], now }
}

/** Presença ao vivo de UMA conta (agrega sub-perfis, usa o mais recente). */
export function useAccountPresence(
  accountId: string | undefined
): AccountPresence {
  const { rows, now } = usePresenceLive()
  return useMemo(() => {
    const mine = rows.filter((r) => r.accountId === accountId)
    if (mine.length === 0) return { online: false, watching: false, row: null }
    const latest = mine.reduce((a, b) =>
      new Date(a.$updatedAt).getTime() >= new Date(b.$updatedAt).getTime()
        ? a
        : b
    )
    const online = isPresenceOnline(latest.$updatedAt, now)
    return { online, watching: online && latest.isWatching, row: latest }
  }, [rows, accountId, now])
}

/**
 * Mapa `accountId → PresenceState` para pintar a bolinha em listas (Usuários).
 * Agrega os sub-perfis de cada conta pelo heartbeat mais recente.
 */
export function usePresenceMap(): Map<string, PresenceState> {
  const { rows, now } = usePresenceLive()
  return useMemo(() => {
    const map = new Map<string, PresenceState>()
    for (const r of rows) {
      const prev = map.get(r.accountId)
      if (
        !prev ||
        new Date(r.$updatedAt).getTime() > new Date(prev.updatedAt).getTime()
      ) {
        const online = isPresenceOnline(r.$updatedAt, now)
        map.set(r.accountId, {
          online,
          watching: online && r.isWatching,
          updatedAt: r.$updatedAt,
          row: r,
        })
      }
    }
    return map
  }, [rows, now])
}
