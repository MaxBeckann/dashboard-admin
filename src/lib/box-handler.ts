import { ExecutionMethod } from 'appwrite'
import { BOX_HANDLER_FUNCTION_ID, functions } from './appwrite'

/**
 * Chama a função `box-handler` do Appwrite com uma `action` e devolve o JSON
 * de resposta já parseado. A execução usa a SESSÃO do admin logado — o
 * Appwrite injeta `x-appwrite-user-id`, e a função revalida `is_admin`
 * (`requireAdmin`) no servidor. Nenhum segredo trafega pelo browser.
 */
export async function callBoxHandler<T = Record<string, unknown>>(
  action: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  const exec = await functions.createExecution({
    functionId: BOX_HANDLER_FUNCTION_ID,
    body: JSON.stringify({ action, ...data }),
    async: false,
    method: ExecutionMethod.POST,
  })

  let parsed: Record<string, unknown> = {}
  try {
    parsed = exec.responseBody ? JSON.parse(exec.responseBody) : {}
  } catch {
    // resposta não-JSON — mantém {}
  }

  if (exec.status === 'failed') {
    throw new Error(
      `box-handler (${action}) falhou: ${exec.errors || 'erro desconhecido'}`
    )
  }
  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    throw new Error(`box-handler (${action}): ${String(parsed.error)}`)
  }
  return parsed as T
}
