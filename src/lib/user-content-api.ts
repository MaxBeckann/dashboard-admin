import { Query } from 'appwrite'
import { client, tablesDB, DATABASE_ID } from './appwrite'

// =========================================================================
// Leitura direta (admin via team:admins) + Realtime de histórico e favoritos
// dos sub-perfis de um usuário. Sem box-handler — as coleções já liberam
// read("team:admins").
// =========================================================================

export const WATCH_HISTORY_TABLE_ID = 'watch_history'
export const FAVORITES_TABLE_ID = 'favorites'

export interface WatchRow {
  $id: string
  $updatedAt: string
  profileId: string
  title: string
  contentType: string
  posterUrl: string | null
  lastPosition: number
  totalDuration: number
  updatedAt: string | null
}

export interface FavoriteRow {
  $id: string
  profileId: string
  title: string
  contentType: string
  posterUrl: string | null
}

type Raw = Record<string, unknown> & { $id: string; $updatedAt: string }

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
const poster = (v: unknown): string | null =>
  typeof v === 'string' && v.startsWith('http') ? v : null

/** Últimos assistidos dos sub-perfis (mais recente primeiro). */
export async function listWatchHistory(
  profileIds: string[]
): Promise<WatchRow[]> {
  if (profileIds.length === 0) return []
  const res = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: WATCH_HISTORY_TABLE_ID,
    queries: [
      Query.equal('profile_id', profileIds),
      Query.orderDesc('updated_at'),
      Query.limit(24),
    ],
  })
  return (res.rows as Raw[]).map((r) => ({
    $id: r.$id,
    $updatedAt: r.$updatedAt,
    profileId: str(r.profile_id),
    title: str(r.title),
    contentType: str(r.content_type),
    posterUrl: poster(r.poster_path),
    lastPosition: num(r.last_position),
    totalDuration: num(r.total_duration),
    updatedAt: str(r.updated_at) || r.$updatedAt || null,
  }))
}

/** Favoritos dos sub-perfis. */
export async function listFavorites(
  profileIds: string[]
): Promise<FavoriteRow[]> {
  if (profileIds.length === 0) return []
  const res = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: FAVORITES_TABLE_ID,
    queries: [Query.equal('profile_id', profileIds), Query.limit(60)],
  })
  return (res.rows as Raw[]).map((r) => ({
    $id: r.$id,
    profileId: str(r.profile_id),
    title: str(r.title),
    contentType: str(r.content_type),
    posterUrl: poster(r.poster_path),
  }))
}

/**
 * Assina Realtime de uma coleção. `cb(profileId)` é chamado a cada evento com
 * o profile_id afetado (pra filtrar pelos sub-perfis do usuário). Retorna a
 * função de unsubscribe.
 */
export function subscribeContent(
  tableId: string,
  cb: (profileId: string | null) => void
): () => void {
  const channels = [
    `databases.${DATABASE_ID}.collections.${tableId}.documents`,
    `databases.${DATABASE_ID}.tables.${tableId}.rows`,
  ]
  return client.subscribe(channels, (msg: { payload?: unknown }) => {
    const payload = (msg.payload ?? {}) as Record<string, unknown>
    cb(typeof payload.profile_id === 'string' ? payload.profile_id : null)
  })
}
