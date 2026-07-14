import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FAVORITES_TABLE_ID,
  WATCH_HISTORY_TABLE_ID,
  listFavorites,
  listWatchHistory,
  subscribeContent,
} from '@/lib/user-content-api'

/** Últimos assistidos (com Realtime) dos sub-perfis de um usuário. */
export function useWatchHistory(userId: string, profileIds: string[]) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['watch-history', userId],
    queryFn: () => listWatchHistory(profileIds),
    enabled: profileIds.length > 0,
  })

  useEffect(() => {
    if (profileIds.length === 0) return
    const mine = new Set(profileIds)
    const unsub = subscribeContent(WATCH_HISTORY_TABLE_ID, (profileId) => {
      if (!profileId || mine.has(profileId)) {
        qc.invalidateQueries({ queryKey: ['watch-history', userId] })
      }
    })
    return () => unsub()
  }, [qc, userId, profileIds])

  return query
}

/** Favoritos (com Realtime) dos sub-perfis de um usuário. */
export function useFavorites(userId: string, profileIds: string[]) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['favorites', userId],
    queryFn: () => listFavorites(profileIds),
    enabled: profileIds.length > 0,
  })

  useEffect(() => {
    if (profileIds.length === 0) return
    const mine = new Set(profileIds)
    const unsub = subscribeContent(FAVORITES_TABLE_ID, (profileId) => {
      if (!profileId || mine.has(profileId)) {
        qc.invalidateQueries({ queryKey: ['favorites', userId] })
      }
    })
    return () => unsub()
  }, [qc, userId, profileIds])

  return query
}
