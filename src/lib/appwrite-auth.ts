import { account, tablesDB, DATABASE_ID, PROFILES_TABLE_ID } from './appwrite'

export interface AdminUser {
  id: string
  email: string
  name: string
}

/** Erro lançado quando o login funciona mas o usuário NÃO é admin. */
export class NotAdminError extends Error {
  constructor() {
    super('NOT_ADMIN')
    this.name = 'NotAdminError'
  }
}

/** Lê o próprio perfil (row legível pelo dono) e confere `is_admin === true`. */
async function assertIsAdmin(userId: string): Promise<void> {
  const profile = await tablesDB.getRow({
    databaseId: DATABASE_ID,
    tableId: PROFILES_TABLE_ID,
    rowId: userId,
  })
  if ((profile as Record<string, unknown>).is_admin !== true) {
    throw new NotAdminError()
  }
}

/**
 * Login de admin: cria sessão no Appwrite e exige `is_admin`. A checagem
 * client-side é só pra UX — a segurança real está no `box-handler`
 * (`requireAdmin`), que revalida no servidor em toda ação.
 */
export async function signInAdmin(
  email: string,
  password: string
): Promise<AdminUser> {
  // Evita "session already active" se já houver sessão pendurada.
  try {
    await account.deleteSession({ sessionId: 'current' })
  } catch {
    /* sem sessão anterior */
  }

  await account.createEmailPasswordSession({ email, password })
  const me = await account.get()

  try {
    await assertIsAdmin(me.$id)
  } catch (e) {
    // Não é admin → derruba a sessão pra não deixar um usuário comum logado.
    await account.deleteSession({ sessionId: 'current' }).catch(() => {})
    throw e
  }

  return { id: me.$id, email: me.email, name: me.name }
}

/** Retorna o admin logado, ou `null` se não há sessão / não é admin. */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  try {
    const me = await account.get()
    await assertIsAdmin(me.$id)
    return { id: me.$id, email: me.email, name: me.name }
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  try {
    await account.deleteSession({ sessionId: 'current' })
  } catch {
    /* já deslogado */
  }
}
