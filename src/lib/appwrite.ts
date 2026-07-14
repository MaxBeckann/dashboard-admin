import { Account, Client, Functions, TablesDB } from 'appwrite'

// =========================================================================
// Configuração do Appwrite (BOX+). Endpoint e Project ID são PÚBLICOS
// (podem ir pro bundle). NENHUMA API key aqui — tudo que é sensível passa
// pela função `box-handler` (que revalida `is_admin` no servidor).
// =========================================================================
export const APPWRITE_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1'
export const APPWRITE_PROJECT_ID = '69d28bb3002c3847e5c9'

export const DATABASE_ID = 'main_db'
export const PROFILES_TABLE_ID = 'profiles'
export const MESSAGES_TABLE_ID = 'user_messages'
export const PRESENCE_TABLE_ID = 'presence'
export const BOX_HANDLER_FUNCTION_ID = 'box-handler'

export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)

export const account = new Account(client)
export const tablesDB = new TablesDB(client)
export const functions = new Functions(client)
