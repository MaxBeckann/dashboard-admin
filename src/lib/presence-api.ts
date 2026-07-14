import { Query } from 'appwrite'
import {
  client,
  tablesDB,
  DATABASE_ID,
  PRESENCE_TABLE_ID,
} from './appwrite'

// =========================================================================
// Presença (online / assistindo agora / última vez). O app Flutter faz upsert
// de 1 linha por sub-perfil ativo; o dashboard lê DIRETO (admin via team) e
// assina Realtime. Online = idade do `$updatedAt` do servidor < limiar.
// =========================================================================

/** Uma linha da coleção `presence` (já normalizada em camelCase). */
export interface PresenceRow {
  $id: string
  $updatedAt: string
  $createdAt: string
  profileId: string
  accountId: string
  name: string
  avatarPath: string | null
  lastSeen: string | null
  isWatching: boolean
  contentId: string | null
  contentTitle: string | null
  contentPoster: string | null
  contentType: string | null
  screen: string | null
  totalOnlineSeconds: number
}

type RawRow = Record<string, unknown> & {
  $id: string
  $updatedAt: string
  $createdAt: string
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null

/** Converte a linha crua do Appwrite (snake_case) no nosso PresenceRow. */
export function mapPresenceRow(r: RawRow): PresenceRow {
  return {
    $id: r.$id,
    $updatedAt: r.$updatedAt,
    $createdAt: r.$createdAt,
    profileId: str(r.profile_id) || r.$id,
    accountId: str(r.account_id),
    name: str(r.name),
    avatarPath: strOrNull(r.avatar_path),
    lastSeen: strOrNull(r.last_seen),
    isWatching: r.is_watching === true,
    contentId: strOrNull(r.content_id),
    contentTitle: strOrNull(r.content_title),
    contentPoster: strOrNull(r.content_poster),
    contentType: strOrNull(r.content_type),
    screen: strOrNull(r.screen),
    totalOnlineSeconds:
      typeof r.total_online_seconds === 'number' ? r.total_online_seconds : 0,
  }
}

/** Leitura direta (admin lê todas via `read("team:admins")` da coleção). */
export async function listPresence(): Promise<PresenceRow[]> {
  const res = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: PRESENCE_TABLE_ID,
    queries: [Query.orderDesc('$updatedAt'), Query.limit(200)],
  })
  return (res.rows as RawRow[]).map(mapPresenceRow)
}

/** Um usuário é considerado ONLINE se bateu heartbeat nos últimos 120s. */
export const PRESENCE_ONLINE_THRESHOLD_MS = 120_000

export function isPresenceOnline(updatedAt: string, now: number): boolean {
  return now - new Date(updatedAt).getTime() < PRESENCE_ONLINE_THRESHOLD_MS
}

/** Aplica um evento Realtime (create/update/delete) numa lista imutável. */
export function applyPresenceEvent(
  list: PresenceRow[],
  row: PresenceRow,
  isDelete: boolean
): PresenceRow[] {
  if (isDelete) return list.filter((r) => r.$id !== row.$id)
  const idx = list.findIndex((r) => r.$id === row.$id)
  if (idx === -1) return [row, ...list]
  const copy = [...list]
  copy[idx] = row
  return copy
}

// Assina os dois formatos de canal (collections/documents legado e
// tables/rows novo) — qualquer versão do servidor entrega. Upsert por id é
// idempotente, então receber o mesmo evento nos dois é inofensivo.
const PRESENCE_CHANNELS = [
  `databases.${DATABASE_ID}.collections.${PRESENCE_TABLE_ID}.documents`,
  `databases.${DATABASE_ID}.tables.${PRESENCE_TABLE_ID}.rows`,
]

type RealtimeMessage = { events?: string[]; payload?: unknown }

/**
 * Assina Realtime da presença. `cb(row, isDelete)` é chamado a cada
 * create/update/delete. Retorna a função de unsubscribe.
 */
export function subscribePresence(
  cb: (row: PresenceRow, isDelete: boolean) => void
): () => void {
  return client.subscribe(PRESENCE_CHANNELS, (msg: RealtimeMessage) => {
    const events = msg.events ?? []
    const payload = msg.payload
    if (!payload || typeof payload !== 'object') return
    const isDelete = events.some((e) => e.endsWith('.delete'))
    cb(mapPresenceRow(payload as RawRow), isDelete)
  })
}
