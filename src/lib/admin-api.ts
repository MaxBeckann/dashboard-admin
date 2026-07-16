import { callBoxHandler } from './box-handler'

// =========================================================================
// Wrappers das ações admin do box-handler (todas exigem is_admin no servidor).
// =========================================================================

export interface AdminUserRow {
  id: string
  name: string
  email: string
  phone: string | null
  createdAt: string
  avatarUrl: string | null
  plan: string | null
  planName: string | null
  subscriptionExpiresAt: string | null
  maxProfiles: number | null
  isAdmin: boolean
  banned: boolean
  banUntil: string | null
  banMessage: string | null
  appVersion: string | null
  platform: string | null
  screenInfo: string | null
  clientSeenAt: string | null
}

/** `true` se o ban ainda está em vigor (permanente ou data futura). */
export function effectivelyBanned(
  banned: boolean,
  banUntil: string | null
): boolean {
  if (!banned) return false
  if (!banUntil) return true
  return new Date(banUntil).getTime() > Date.now()
}

// --- Versão do app (telemetria do cliente) -------------------------------

/** Converte "0.0.14+14" numa tupla [major, minor, patch, build] pra comparar. */
export function parseVersion(v: string | null | undefined): number[] | null {
  if (!v) return null
  const m = String(v).trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\+(\d+))?/)
  if (!m) return null
  return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0), Number(m[4] || 0)]
}

/** Compara duas versões: -1 se a<b, 0 se iguais, 1 se a>b. Nulos vão pro fim. */
export function compareVersion(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa && !pb) return 0
  if (!pa) return -1
  if (!pb) return 1
  for (let i = 0; i < 4; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return 0
}

/** Versão mais nova entre uma lista (ignora nulos). Null se nenhuma válida. */
export function newestVersion(versions: (string | null | undefined)[]): string | null {
  let best: string | null = null
  for (const v of versions) {
    if (parseVersion(v) && (best === null || compareVersion(v, best) > 0)) {
      best = v as string
    }
  }
  return best
}

/** Rótulo amigável da plataforma reportada pelo app. */
export function platformLabel(code: string | null | undefined): string | null {
  if (!code) return null
  const map: Record<string, string> = {
    tizen: 'Samsung TV',
    androidtv: 'Android TV',
    android: 'Android',
    ios: 'iPhone',
    windows: 'PC (Windows)',
    macos: 'Mac',
    linux: 'Linux',
    web: 'Web',
  }
  return map[code] || code
}

export type PopupType = 'silent' | 'full' | 'mini'

export interface SentMessage {
  id: string
  userId: string
  title: string
  body: string
  imageUrl: string | null
  read: boolean
  broadcastId: string | null
  popup: PopupType
  createdAt: string
}

export interface DashboardStats {
  users: {
    total: number
    active: number
    expiringSoon: number
    expired: number
    banned: number
    noSub: number
  }
  presence: { online: number; watching: number }
  revenue: {
    month: number
    lastMonth: number
    total: number
    byPlan: Record<string, number>
  }
  signups: { date: string; count: number }[]
  topWatched: TopWatchedItem[]
  newUsers7d: number
  newUsers30d: number
}

/** Item do Top 10 "Mais assistidos" (série já agrupada; `count` = perfis). */
export interface TopWatchedItem {
  key: string
  type: 'movie' | 'series'
  title: string
  count: number
  poster: string | null
  /** Prévia (até 4 perfis mais recentes) pra pilha de avatares no card. */
  watchers: { name: string; avatarUrl: string | null }[]
}

/** Um espectador (perfil) que assistiu — com quando e quanto assistiu. */
export interface WatcherEntry {
  profileId: string
  profileName: string
  avatarUrl: string | null
  accountName: string
  accountEmail: string
  /** ISO de quando assistiu por último. */
  when: string | null
  /** Segundos assistidos (posição) e duração total do conteúdo. */
  watchedSec: number
  totalSec: number
}

/** Episódio assistido de uma série (com seus espectadores). */
export interface SeriesEpisode {
  episodeId: string
  label: string
  title: string
  count: number
  watchers: WatcherEntry[]
}

/** Resultado do drill-down "quem assistiu": filme = lista; série = episódios. */
export type WatchersResult =
  | { type: 'movie'; total: number; watchers: WatcherEntry[] }
  | { type: 'series'; total: number; episodes: SeriesEpisode[] }

/** Agregados do Painel Início (KPIs + gráficos). */
export async function getDashboardStats(): Promise<DashboardStats> {
  return callBoxHandler<DashboardStats>('admin_dashboard_stats', {})
}

/** Drill-down "quem assistiu". Filme → watchers; série → episódios→watchers. */
export async function getTopWatchers(
  key: string,
  type: 'movie' | 'series'
): Promise<WatchersResult> {
  return callBoxHandler('admin_top_watchers', { key, type })
}

/** Lista maior do "mais assistidos" (aba Audiência). */
export async function getTopWatched(
  limit = 24
): Promise<{ items: TopWatchedItem[] }> {
  return callBoxHandler('admin_top_watched', { limit })
}

// ── Audiência: painel de analytics (aba Início) ──────────────────────────
export interface AudienceViewer {
  accountId: string
  name: string
  email: string
  profileName: string
  avatarUrl: string | null
  plays: number
  titles: number
  watchedSec: number
  lastWatched: string | null
}

export interface AudienceCategory {
  name: string
  plays: number
  sec: number
}

export interface AudienceOverview {
  window: number
  totals: {
    plays: number
    viewers: number
    watchedSec: number
    avgCompletion: number
  }
  byType: {
    movie: { plays: number; sec: number }
    series: { plays: number; sec: number }
  }
  topViewers: AudienceViewer[]
  activity: { date: string; plays: number }[]
  hasCategoryData: boolean
  categories: AudienceCategory[]
  categoriesByType: {
    movie: AudienceCategory[]
    series: AudienceCategory[]
  }
  /** Matriz 7×24 (dia-da-semana 0=Dom × hora 0..23) de reproduções. */
  peakHours: number[][]
  completion: { labels: string[]; buckets: number[] }
  abandoned: {
    title: string
    type: 'movie' | 'series'
    poster: string | null
    plays: number
    avgCompletion: number
  }[]
}

/** KPIs + top espectadores + filmes×séries + atividade + categorias. */
export async function getAudienceOverview(
  windowDays = 30
): Promise<AudienceOverview> {
  return callBoxHandler('admin_audience_overview', { windowDays })
}

// ── Audiência de UM usuário (perfil) ─────────────────────────────────────
export interface UserAudience {
  totals: {
    plays: number
    titles: number
    watchedSec: number
    avgCompletion: number
    firstWatched: string | null
    lastWatched: string | null
  }
  byType: {
    movie: { plays: number; sec: number }
    series: { plays: number; sec: number }
  }
  topWatched: {
    title: string
    type: 'movie' | 'series'
    poster: string | null
    plays: number
    watchedSec: number
  }[]
  categories: { name: string; plays: number }[]
  recent: {
    title: string
    type: 'movie' | 'series'
    poster: string | null
    when: string | null
    watchedSec: number
    totalSec: number
  }[]
}

/** Audiência (analytics) de um usuário específico, pra aba Usuário. */
export async function getUserAudience(accountId: string): Promise<UserAudience> {
  return callBoxHandler('admin_user_audience', { accountId })
}

// ── Auditoria de ações admin ─────────────────────────────────────────────
export interface AuditEntry {
  id: string
  adminId: string
  adminName: string
  action: string
  targetId: string
  targetName: string
  details: Record<string, unknown> | null
  createdAt: string | null
}

/** Log de auditoria (quem fez o quê e quando). */
export async function getAuditLog(opts?: {
  limit?: number
  action?: string
}): Promise<{ items: AuditEntry[] }> {
  return callBoxHandler('admin_audit_log', {
    limit: opts?.limit ?? 100,
    action: opts?.action,
  })
}

// ── Funil de contratação (Lead → Pagou → Ativo) ──────────────────────────
export interface ConversionFunnel {
  window: number
  stages: { key: string; label: string; count: number }[]
  rates: { leadToPaid: number; paidToActive: number; leadToActive: number }
  biggestDropStage: 'leadToPaid' | 'paidToActive'
  valorEmRisco: number
  ticketMedio: number
  resolvidos: number
  byPlan: { plan: string; leads: number; pagaram: number; rate: number }[]
  topReasons: { reason: string; count: number }[]
}

/** Funil de contratação: leads (WhatsApp/QR) → pagaram → ativos. */
export async function getConversionFunnel(
  windowDays = 30
): Promise<ConversionFunnel> {
  return callBoxHandler('admin_conversion_funnel', { windowDays })
}

// ── ROI de cupom (por campanha / batch) ──────────────────────────────────
export interface CouponCampaign {
  batchId: string
  label: string
  type: 'free_days' | 'discount'
  days: number
  discountPercent: number
  planTitle: string
  couponCount: number
  resgates: number
  resgatantes: number
  convertidos: number
  taxa: number
  receita: number
  custo: number
  roi: number
  createdAt: string | null
}

/** ROI por campanha de cupom: receita trazida vs custo (dias grátis/desconto). */
export async function getCouponRoi(): Promise<{
  campaigns: CouponCampaign[]
  totals: {
    resgates: number
    resgatantes: number
    convertidos: number
    receita: number
    custo: number
    roi: number
  }
}> {
  return callBoxHandler('admin_coupon_roi', {})
}

/** Recalcula o Top 10 do público (tabela `top_rankings` que o APP usa no
 * banner) agora, sem esperar o cron. Retorna a contagem por tipo. */
export async function recomputeRankings(): Promise<{
  movies: number
  series: number
  scan: number
}> {
  return callBoxHandler('admin_recompute_rankings', {})
}

// ── Config REMOTA do app (aba "Aplicativo") ──────────────────────────────
/** Config que o app lê no boot e aplica (com fallback pros defaults). */
export type ImageSource = 'tmdb' | 'iptv'

export type FeaturedSource = 'category' | 'top10' | 'tmdb'

/** Config do INÍCIO (por plataforma). */
export interface InicioConfig {
  /** Palavras-chave do destaque SEPARADAS por tipo (Filmes/Séries). */
  featuredKeywords: { movies: string[]; series: string[] }
  rowPriorityKeywords: string[]
  carouselSeconds: number
  featuredCount: number
  featuredSource: FeaturedSource
  /** Tipo que o banner destaca: 'movies' (Filmes) | 'series' (Séries). */
  featuredType: 'movies' | 'series'
  trailerAutoplay: boolean
  /** Sem trailer → toca o próprio conteúdo (mudo) na prévia do banner. */
  autoOpenOnNoTrailer: boolean
}

/** Config de uma plataforma (TV/PC ou Smartphone). */
export interface PlatformConfig {
  inicio: InicioConfig
  filmes: { imageSource: ImageSource }
  series: { imageSource: ImageSource }
  aovivo: { imageSource: ImageSource } // travado (canal não tem TMDB)
}

/** Config remota v2 — por PLATAFORMA (tv/mobile) → TELA + aba GERAL. */
export interface AppConfig {
  v: number
  tv: PlatformConfig
  mobile: PlatformConfig
  geral: {
    ranking: { enabled: boolean; windowDays: number }
    cacheDays: number
    /** "Continue assistindo" (card do histórico) — global. 'tmdb' | 'iptv'. */
    historyImageSource: ImageSource
  }
}

/** Chave de plataforma usada nas rotas (`$platform`). */
export type PlatformKey = 'tv' | 'mobile'

export async function getAppConfig(): Promise<AppConfig> {
  const r = await callBoxHandler<{ config: AppConfig }>('admin_get_app_config', {})
  return r.config
}

export async function setAppConfig(config: AppConfig): Promise<void> {
  await callBoxHandler('admin_set_app_config', { config })
}

/** Nomes de categoria reportados pelos apps (por tipo), com frequência —
 * pra sugerir palavras-chave reais (as categorias variam por lista). */
export interface ReportedCategories {
  movie: { name: string; count: number }[]
  series: { name: string; count: number }[]
  live: { name: string; count: number }[]
  scanned: number
}

export async function listReportedCategories(): Promise<ReportedCategories> {
  return callBoxHandler<ReportedCategories>('admin_list_categories', {})
}

/** Lista os usuários cadastrados (contas Appwrite + plano/admin do perfil). */
export async function listUsers(search?: string): Promise<AdminUserRow[]> {
  const res = await callBoxHandler<{ users?: AdminUserRow[] }>(
    'admin_list_users',
    { search: search || undefined, limit: 100 }
  )
  return res.users ?? []
}

export interface SupportLead {
  id: string
  accountId: string | null
  userName: string | null
  userPhone: string | null
  userEmail: string | null
  planId: string | null
  planTitle: string | null
  reason: string | null
  source: string | null
  status: string
  price: string | null
  couponCode: string | null
  discountPercent: string | null
  maxScreens: string | null
  createdAt: string | null
  resolvedAt: string | null
  converted: boolean
}

/** Converte um preço BR ("71,40" / "1.234,56") em número. 0 se inválido. */
export function parsePriceBR(v: string | null | undefined): number {
  if (!v) return 0
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Formata um número como preço BR ("1234.5" → "1.234,50"). */
export function formatPriceBR(n: number): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Lista os leads de contratação (clientes levados ao WhatsApp no checkout).
 * Com `accountId` → só os daquele usuário (histórico no perfil). */
export async function listSupportLeads(
  accountId?: string
): Promise<SupportLead[]> {
  const res = await callBoxHandler<{ leads?: SupportLead[] }>(
    'admin_list_support_leads',
    { limit: 100, accountId: accountId || undefined }
  )
  return res.leads ?? []
}

/** Contagem enxuta de contratações pendentes (pro badge/notificação). */
export async function getSupportLeadsCount(): Promise<number> {
  const res = await callBoxHandler<{ pending?: number }>(
    'admin_support_leads_count',
    {}
  )
  return res.pending ?? 0
}

/** Marca um lead como 'resolvido' ou reabre ('aberto'). */
export async function updateSupportLead(
  id: string,
  status: 'aberto' | 'resolvido'
): Promise<void> {
  await callBoxHandler('admin_update_support_lead', { id, status })
}

/** Exclui um lead de contratação. */
export async function deleteSupportLead(id: string): Promise<void> {
  await callBoxHandler('admin_delete_support_lead', { id })
}

export interface PaymentRow {
  id: string
  userId: string | null
  userName: string | null
  userPhone: string | null
  planTitle: string | null
  amount: string | null
  status: string | null
  paymentType: string | null
  createdAt: string | null
}

/** Lista TODOS os pagamentos (Financeiro), mais recentes primeiro. */
export async function listPayments(): Promise<PaymentRow[]> {
  const res = await callBoxHandler<{ payments?: PaymentRow[] }>(
    'admin_list_payments',
    { limit: 150 }
  )
  return res.payments ?? []
}

export interface ExpiringSub {
  id: string
  userName: string | null
  userPhone: string | null
  planId: string | null
  planTitle: string | null
  maxScreens: number | null
  expiresAt: string | null
  lockedPrice: string | null
}

/** Assinaturas que vencem nos próximos `days` dias (renovações a vencer). */
export async function listExpiring(days: number): Promise<ExpiringSub[]> {
  const res = await callBoxHandler<{ subs?: ExpiringSub[] }>(
    'admin_list_expiring',
    { days }
  )
  return res.subs ?? []
}

/** `true` se o status do pagamento é considerado aprovado/pago. */
export function isPaymentApproved(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase()
  return ['approved', 'paid', 'aprovado', 'pago', 'completed', 'success'].includes(
    s
  )
}

/** Lista mensagens enviadas. Com `userId` → thread daquele usuário. */
export async function listMessages(userId?: string): Promise<SentMessage[]> {
  const res = await callBoxHandler<{ messages?: SentMessage[] }>(
    'admin_list_messages',
    { userId: userId || undefined, limit: 100 }
  )
  return res.messages ?? []
}

export interface SendMessageInput {
  title: string
  body: string
  imageUrl?: string
  target: 'all' | 'user'
  userId?: string
  popup?: PopupType
}

export interface SendMessageResult {
  success?: boolean
  target?: string
  sent?: number
  broadcast_id?: string
}

/** Envia mensagem (1 usuário ou broadcast) via box-handler. */
export async function sendMessage(
  input: SendMessageInput
): Promise<SendMessageResult> {
  const payload: Record<string, unknown> = {
    title: input.title,
    body: input.body,
    target: input.target,
    popup: input.popup ?? 'full',
  }
  if (input.imageUrl) payload.imageUrl = input.imageUrl
  if (input.target === 'user') payload.userId = input.userId
  return callBoxHandler<SendMessageResult>('send_message', payload)
}

/** Apaga UMA mensagem (por id). */
export async function deleteMessage(messageId: string) {
  return callBoxHandler('admin_delete_message', { messageId })
}

/** Apaga um broadcast INTEIRO (remove de todos os destinatários). */
export async function deleteBroadcast(broadcastId: string) {
  return callBoxHandler('admin_delete_message', { broadcastId })
}

export interface SetBanInput {
  banUntil?: string | null
  banMessage?: string | null
}

/** Bane (com duração/mensagem opcionais) ou desbane um usuário. */
export async function setBan(
  userId: string,
  banned: boolean,
  opts: SetBanInput = {}
) {
  return callBoxHandler('admin_set_ban', {
    userId,
    banned,
    banUntil: opts.banUntil ?? undefined,
    banMessage: opts.banMessage ?? undefined,
  })
}

export interface SubProfile {
  id: string
  name: string
  avatarUrl: string | null
  isKids: boolean
  serverUrl: string | null
  username: string | null
  password: string | null
  banned: boolean
}

export interface Payment {
  id: string
  planTitle: string
  amount: string
  status: string
  paymentType: string
  createdAt: string | null
}

export interface WatchItem {
  title: string
  contentType: string
  posterUrl: string | null
  lastPosition: number
  totalDuration: number
  updatedAt: string | null
}

export interface UserDetail {
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    fullName: string | null
    cpf: string | null
    birthDate: string | null
    avatarUrl: string | null
    plan: string | null
    planName: string | null
    subscriptionExpiresAt: string | null
    subscriptionActivatedAt: string | null
    maxProfiles: number | null
    isAdmin: boolean
    banned: boolean
    banUntil: string | null
    banMessage: string | null
    appVersion: string | null
    platform: string | null
    screenInfo: string | null
    clientSeenAt: string | null
    status: boolean | null
    emailVerification: boolean
    accessedAt: string | null
    registration: string | null
    createdAt: string | null
  }
  subProfilesCount: number
  subProfiles: SubProfile[]
  watchHistory: WatchItem[]
  payments: Payment[]
}

/** Detalhes completos de um usuário (perfil + sub-perfis + assistidos + pagamentos). */
export async function getUserDetails(userId: string): Promise<UserDetail> {
  return callBoxHandler<UserDetail>('admin_get_user', { userId })
}

export interface UpdateUserInput {
  fullName?: string
  phone?: string
  cpf?: string
  birthDate?: string
  avatarUrl?: string
  name?: string
  email?: string
}

/** Edita dados do perfil + conta (nome/e-mail de login). */
export async function updateUser(userId: string, fields: UpdateUserInput) {
  return callBoxHandler('admin_update_user', { userId, ...fields })
}

/** Promove/rebaixa admin. */
export async function setAdmin(userId: string, isAdmin: boolean) {
  return callBoxHandler('admin_set_admin', { userId, isAdmin })
}

/** Redefine a senha de login do usuário (mín. 8 caracteres). */
export async function setPassword(userId: string, password: string) {
  return callBoxHandler('admin_set_password', { userId, password })
}

// ---- Cupons / códigos --------------------------------------------------

export type CouponType = 'free_days' | 'discount'

export interface Coupon {
  code: string
  /** Tipo: dias grátis (padrão) ou desconto %. */
  type: CouponType
  /** % de desconto (só type='discount'). */
  discountPercent: number
  /** Usos por pessoa (só type='discount'; padrão 1). */
  perUserLimit: number
  planTitle: string | null
  planName: string | null
  maxProfiles: number | null
  days: number
  batchId: string | null
  used: boolean
  usedBy: string | null
  usedAt: string | null
  note: string | null
  /** Limite de usos (0 = ilimitado). */
  maxUses: number
  /** Quantas contas já resgataram. */
  uses: number
  /** Ligado/desligado (pausar sem apagar). */
  active: boolean
  /** Validade do código (ISO) ou null. */
  expiresAt: string | null
  /** Mensagem de boas-vindas (template com placeholders) ou null. */
  welcomeMessage: string | null
  /** Estilo da mensagem no app: card (pop) ou tela cheia. */
  welcomeStyle: CouponWelcomeStyle
  /** Selo (pílula) da tela cheia. null = padrão do app; '' = escondido. */
  welcomeBadge: string | null
  /** `true` quando atingiu o teto de usos. */
  exhausted: boolean
  createdAt: string
}

export type CouponWelcomeStyle = 'pop' | 'fullscreen'

export interface CouponRedemption {
  userId: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  redeemedAt: string
  days: number | null
}

export interface CreateCouponsInput {
  /** 'free_days' (padrão) ou 'discount'. */
  type?: CouponType
  /** % de desconto (type='discount'). */
  discountPercent?: number
  /** Usos por pessoa (type='discount'; padrão 1). */
  perUserLimit?: number
  /** Código personalizado (o admin digita). Se vier, ignora quantity (cria 1). */
  customCode?: string
  planName?: string
  planTitle?: string
  maxProfiles?: number
  days: number
  quantity: number
  note?: string
  /** Limite de usos por código (0 = ilimitado). */
  maxUses?: number
  active?: boolean
  /** Validade opcional (ISO). */
  expiresAt?: string
  /** Mensagem de boas-vindas (template com {NOME} {DIAS} {VALIDADE} {PLANO}). */
  welcomeMessage?: string
  /** Estilo: 'pop' (card) ou 'fullscreen' (tela de boas-vindas). */
  welcomeStyle?: CouponWelcomeStyle
  /** Selo (pílula) da tela cheia. Omitir = padrão; '' = escondido. */
  welcomeBadge?: string
}

/** Gera um lote de códigos (retorna os códigos criados). */
export async function createCoupons(input: CreateCouponsInput) {
  return callBoxHandler<{ batchId: string; codes: string[]; created: number }>(
    'admin_create_coupons',
    { ...input }
  )
}

/** Lista cupons (filtra por lote / usados). */
export async function listCoupons(opts?: {
  batchId?: string
  used?: boolean
}): Promise<Coupon[]> {
  const res = await callBoxHandler<{ coupons?: Coupon[] }>(
    'admin_list_coupons',
    { batchId: opts?.batchId, used: opts?.used, limit: 300 }
  )
  return res.coupons ?? []
}

/** Apaga 1 cupom pelo código. */
export async function deleteCoupon(code: string) {
  return callBoxHandler('admin_delete_coupon', { code })
}

/** Apaga um lote inteiro de cupons. */
export async function deleteCouponBatch(batchId: string) {
  return callBoxHandler('admin_delete_coupon', { batchId })
}

export interface UpdateCouponInput {
  active?: boolean
  expiresAt?: string | null
  maxUses?: number
  note?: string | null
  welcomeMessage?: string | null
  welcomeStyle?: CouponWelcomeStyle
  welcomeBadge?: string | null
}

/** Liga/desliga, edita validade / limite / nota de um cupom (sem apagar). */
export async function updateCoupon(code: string, fields: UpdateCouponInput) {
  return callBoxHandler('admin_update_coupon', { code, ...fields })
}

/** Lista quem resgatou um código (auditoria). */
export async function couponRedemptions(
  code: string
): Promise<CouponRedemption[]> {
  const res = await callBoxHandler<{ redemptions?: CouponRedemption[] }>(
    'admin_coupon_redemptions',
    { code }
  )
  return res.redemptions ?? []
}

export interface RecentRedemption {
  userId: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  code: string
  days: number | null
  redeemedAt: string
}

/** Últimos resgates de todos os códigos (feed do Início). */
export async function recentRedemptions(
  limit = 8
): Promise<RecentRedemption[]> {
  const res = await callBoxHandler<{ redemptions?: RecentRedemption[] }>(
    'admin_recent_redemptions',
    { limit }
  )
  return res.redemptions ?? []
}

// ---- IPTV (linhas provisionadas no painel Sigma) -----------------------

export interface IptvSettings {
  salesPaused: boolean
  autoReplenish: boolean
  alertThreshold: number
  rechargeAmount: number
}

export interface IptvStats {
  panelOk: boolean
  panelError?: string | null
  credits: number | null
  lines: {
    total: number
    test: number
    full: number
    active: number
    expired: number
  }
  settings?: IptvSettings
}

export interface IptvConsumptionItem {
  accountId: string
  name: string | null
  email: string | null
  creditsUsed: number
  planId: string | null
  adult: boolean
  source: string | null
  createdAt: string
  expiresAt: string | null
}

export interface IptvConversion {
  coupon: { tested: number; converted: number; rate: number }
  all: { tested: number; converted: number; rate: number }
  paid: number
}

export interface IptvLine {
  accountId: string
  name: string | null
  email: string | null
  lineId: string | null
  username: string | null
  password: string | null
  serverUrl: string | null
  connections: number | null
  type: 'test' | 'full'
  status: string
  adult: boolean
  packageName: string | null
  planId: string | null
  expiresAt: string | null
  createdAt: string
}

/** Saldo de créditos do painel + contagem de linhas. */
export async function getIptvStats(): Promise<IptvStats> {
  return callBoxHandler<IptvStats>('admin_iptv_stats', {})
}

/** Lista as linhas IPTV geradas (test/full). */
export async function listIptvLines(type?: 'test' | 'full'): Promise<IptvLine[]> {
  const res = await callBoxHandler<{ lines?: IptvLine[] }>(
    'admin_list_iptv_lines',
    { type }
  )
  return res.lines ?? []
}

/** Desativa a linha paga de um usuário (no painel). */
export async function iptvDisable(userId: string) {
  return callBoxHandler('admin_iptv_disable', { userId })
}

export interface IptvProvisionOpts {
  adult?: boolean
  /** Modo "gastar fichas": 1/3/6/12 meses (também concede acesso ao app). */
  months?: number
  /** Código do plano App+Lista: `list_${telas}t_${months}m` (ex.: list_2t_6m). */
  planId?: string
  planTitle?: string
}

/** Gera/renova a linha paga (regenerar), OU "gastar fichas" (com months+planId). */
export async function iptvProvision(userId: string, opts: IptvProvisionOpts = {}) {
  return callBoxHandler<{ line?: { username: string; expiresAt: string } }>(
    'admin_iptv_provision',
    { userId, ...opts }
  )
}

/** Configurações do IPTV (interruptor, alerta, auto-recarga). */
export async function getIptvSettings(): Promise<IptvSettings> {
  const res = await callBoxHandler<{ settings: IptvSettings }>(
    'admin_get_settings',
    {}
  )
  return res.settings
}
export async function setIptvSettings(patch: Partial<IptvSettings>) {
  return callBoxHandler('admin_set_settings', patch)
}

// ── Config de PLANOS (editável no dashboard, lida pelo app) ──────────────────
export interface PlanConfigFamily {
  code: 'app' | 'list'
  title: string
  subtitle: string
  enabled: boolean
}
export interface PlanConfigTela {
  n: number
  enabled: boolean
}
export interface PlanConfigDuration {
  months: number
  label: string
  enabled: boolean
  badge: string
  popular: boolean
}
export interface PlanConfig {
  v: number
  /** Custo por ficha/crédito (R$) — usado só p/ margem no dashboard. */
  fichaCost?: number
  /** Fichas/mês consumidas por qtde de telas (modelo do painel). SEVEN = todos 1. */
  fichasPerTela?: Record<string, number>
  /** Se cada plano aceita cupom de desconto [family][telas][months] (default true). */
  acceptsDiscount?: Record<string, Record<string, Record<string, boolean>>>
  /** Promoção agendada (desconto automático numa janela). */
  promo?: {
    enabled: boolean
    percent: number
    startsAt: string | null
    endsAt: string | null
    scope: 'all' | 'app' | 'list'
  }

  /** Aviso quando o preço é GARANTIDO (travado). Placeholders {NOME}{PLANO}{PRECO_ANTIGO}{PRECO_NOVO}. */
  noticeTemplate?: string
  /** Aviso quando o preço NÃO será mantido (sobe pra todos). */
  noticeTemplateChange?: string
  families: PlanConfigFamily[]
  telas: PlanConfigTela[]
  durations: PlanConfigDuration[]
  /** prices[family][telas][months] = valor total cobrado (R$). */
  prices: Record<string, Record<string, Record<string, number>>>
}

export async function getPlanConfig(): Promise<PlanConfig> {
  const res = await callBoxHandler<{ config: PlanConfig }>(
    'admin_get_plan_config',
    {}
  )
  return res.config
}
export async function setPlanConfig(config: PlanConfig) {
  return callBoxHandler('admin_set_plan_config', { config })
}

// ── Lucro & vendas por plano ────────────────────────────────────────────────
export interface PlanSalesRow {
  planId: string
  sales: number
  revenue: number
  cost: number
  profit: number
  marginPct: number
}
export interface PlanSalesReport {
  fichaCost: number
  days: number
  plans: PlanSalesRow[]
  totals: { sales: number; revenue: number; cost: number; profit: number }
}
/** Relatório de vendas/lucro por plano. days=0 → tudo; 30/7 → período. */
export async function getPlanSales(days = 0): Promise<PlanSalesReport> {
  return callBoxHandler<PlanSalesReport>('admin_plan_sales', { days })
}

// ── Reconciliação de assinatura (pagou e não ativou → ativa) ────────────────
export interface ReconcileResult {
  checked: number
  fixed: number
  fixedList: {
    paymentId: string
    userId: string
    planId: string
    expiresAt: string
  }[]
}
export async function reconcileSubscriptions(days = 7): Promise<ReconcileResult> {
  return callBoxHandler<ReconcileResult>('admin_reconcile_subscriptions', {
    days,
  })
}

// ── Mudança de preço: impacto nos clientes + travar preço/avisar ────────────
export interface PlanChangeUser {
  id: string
  name: string
  avatarUrl: string | null
}
export interface PlanChangeImpact {
  code: string
  count: number
  users: PlanChangeUser[]
}
/** Quantos clientes estão em cada plano (antes de aplicar mudança de preço). */
export async function getPlanChangeImpact(
  codes: string[]
): Promise<{ impacts: PlanChangeImpact[] }> {
  return callBoxHandler('admin_plan_change_impact', { codes })
}
export interface ApplyPlanChangeInput {
  config: PlanConfig
  /** Planos cujo preço anterior será travado (fidelidade) p/ clientes atuais. */
  lockCodes: string[]
  /** Por quantos dias garantir o preço travado. 0 = para sempre. */
  lockDurationDays?: number
  /** Se preenchido, aplica só a esses clientes; senão, a todos dos planos. */
  userIds?: string[]
  /** Aviso opcional aos clientes desses planos. */
  notify: { title: string; body: string; popup?: string; codes: string[] } | null
}
/** Salva a config + trava preço anterior + avisa clientes (impacto controlado). */
export async function applyPlanChange(
  input: ApplyPlanChangeInput
): Promise<{ locked: number; notified: number }> {
  return callBoxHandler('admin_apply_plan_change', { ...input })
}

/** Relatório de consumo (fichas usadas + quem). */
export async function iptvConsumption(): Promise<{
  totalCreditsUsed: number
  items: IptvConsumptionItem[]
}> {
  return callBoxHandler('admin_iptv_consumption', {})
}

/** Métrica de conversão (teste → compra). */
export async function iptvConversion(): Promise<IptvConversion> {
  return callBoxHandler<IptvConversion>('admin_iptv_conversion', {})
}

export interface PendingProvision {
  jobId: string
  accountId: string
  name: string | null
  email: string | null
  planId: string | null
  months: number
  adult: boolean
  reason: string
  lastError: string | null
  attempts: number
  createdAt: string
}

/** Pendências: clientes que pagaram App+Lista mas a lista não gerou. */
export async function iptvPendingProvisions(): Promise<PendingProvision[]> {
  const res = await callBoxHandler<{ items?: PendingProvision[] }>(
    'admin_list_pending_provisions',
    {}
  )
  return res.items ?? []
}

/** Re-tenta gerar a lista de uma pendência. */
export async function iptvRetryProvision(jobId: string) {
  return callBoxHandler('admin_retry_provision', { jobId })
}

export interface UpdateSubprofileInput {
  name?: string
  isKids?: boolean
  avatarPath?: string
  serverUrl?: string
  username?: string
  password?: string
}

/** Edita um sub-perfil (qualquer conta). */
export async function updateSubprofile(
  profileId: string,
  fields: UpdateSubprofileInput
) {
  return callBoxHandler('admin_update_subprofile', { profileId, ...fields })
}

// ── DNS (servidor da lista) ──────────────────────────────────────────────
export type DnsScope = 'plan' | 'app'
export interface DnsUsage {
  url: string
  count: number
  /** Amostra de avatares (http) p/ o empilhado no card. */
  avatars?: string[]
}
export interface KnownDns {
  url: string
  label: string
  note?: string
  active: boolean
}
export interface DnsOverview {
  planDns: DnsUsage[]
  appDns: DnsUsage[]
  known: KnownDns[]
  totals: {
    planUsers: number
    appUsers: number
    distinctPlanDns: number
    distinctAppDns: number
  }
}
/** Panorama de DNS: distribuição dos planos + só-app + lista curada. */
export async function getDnsOverview(
  includeInactive = false
): Promise<DnsOverview> {
  return callBoxHandler<DnsOverview>('admin_dns_overview', { includeInactive })
}

export interface DnsUser {
  userId: string
  accountName: string
  accountEmail: string
  profileName: string
  avatarUrl: string | null
  username: string
  password: string
  phone: string | null
}

export interface DnsTestResult {
  ok: boolean
  status?: number
  active?: boolean
  reason?: string
  message: string
}
/** Testa se um DNS responde (health-check no player_api, roda no servidor). */
export async function testDns(
  dns: string,
  creds?: { username: string; password: string }
): Promise<DnsTestResult> {
  return callBoxHandler<DnsTestResult>('admin_test_dns', { dns, ...(creds ?? {}) })
}

/** Histórico das últimas trocas de DNS (do audit log). */
export async function getDnsHistory(limit = 30): Promise<{ items: AuditEntry[] }> {
  return callBoxHandler('admin_audit_log', {
    limit,
    actions: ['admin_bulk_set_dns', 'admin_set_user_dns', 'admin_dns_save_known'],
  })
}
/** Lista os usuários de um DNS (drill-down). scope='plan' (nossas listas) / 'app' (lista própria). */
export async function getDnsUsers(
  url: string,
  scope: DnsScope
): Promise<{
  url: string
  scope: DnsScope
  total: number
  capped: boolean
  users: DnsUser[]
}> {
  return callBoxHandler('admin_dns_users', { url, scope })
}

export interface DnsImpact {
  count: number
  sample: { userId: string; email: string | null; currentUrl: string | null }[]
}
/** Prévia: quantos usuários a troca atinge (filtro opcional por DNS de origem + scope). */
export async function getDnsImpact(
  fromUrl?: string,
  scope: DnsScope = 'plan'
): Promise<DnsImpact> {
  return callBoxHandler<DnsImpact>('admin_dns_impact', {
    scope,
    ...(fromUrl ? { fromUrl } : {}),
  })
}

export interface BulkSetDnsInput {
  /** 'plan' = listas que nós geramos; 'app' = lista própria do cliente (perigoso). */
  scope?: DnsScope
  /** Se vier, só troca quem está NESSE DNS. Vazio = todos (só p/ plano). */
  fromUrl?: string
  toUrl: string
  /** Avisar os afetados (mensagem no app; aceita {NOME}/{DNS_NOVO}/{DNS_ANTIGO}). */
  notify?: boolean
  notifyTitle?: string
  notifyBody?: string
}
/** Troca em massa o DNS dos usuários (plano ou lista própria). */
export async function bulkSetDns(
  input: BulkSetDnsInput
): Promise<{ changed: number; failed: number; notified: number }> {
  return callBoxHandler('admin_bulk_set_dns', { ...input })
}

/** Salva a lista curada de DNS conhecidos. */
export async function saveKnownDns(
  servers: KnownDns[]
): Promise<{ servers: KnownDns[] }> {
  return callBoxHandler('admin_dns_save_known', { servers })
}

/** Troca o DNS de UM usuário de plano (user_profiles + iptv_lines). */
export async function setUserDns(userId: string, toUrl: string) {
  return callBoxHandler('admin_set_user_dns', { userId, toUrl })
}

/** Exclui o usuário (conta + dados). Irreversível. */
export async function deleteUser(userId: string) {
  return callBoxHandler('admin_delete_user', { userId })
}

export interface SetSubscriptionInput {
  userId: string
  planName?: string
  planTitle?: string
  maxProfiles?: number
  /** Renova a partir de agora (+N dias). Ignorado se `expiresAt` vier. */
  days?: number
  /** Data de expiração explícita (ISO). Tem prioridade sobre `days`. */
  expiresAt?: string
  /** Data de ativação explícita (ISO). Opcional. */
  activatedAt?: string
}

/** Define/edita a assinatura: plano, data de expiração e ativação. */
export async function setSubscription(input: SetSubscriptionInput) {
  return callBoxHandler<{ subscription_expires_at?: string }>(
    'admin_set_subscription',
    {
      userId: input.userId,
      planName: input.planName,
      planTitle: input.planTitle,
      maxProfiles: input.maxProfiles,
      days: input.days,
      expiresAt: input.expiresAt,
      activatedAt: input.activatedAt,
    }
  )
}
