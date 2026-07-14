// Catálogo PARAMÉTRICO de planos — espelho de lib/auth/subscription_config.dart.
// Código self-describing: `${family}_${telas}t_${months}m` (ex.: list_2t_6m).
//   family: 'app' (só app) | 'list' (app + lista IPTV nossa)
//   telas  = max_profiles = conexões IPTV
//   months = duração (1/3/6/12)

export interface PlanFamily {
  code: 'app' | 'list'
  title: string
  hasPlaylist: boolean
}

export const FAMILIES: PlanFamily[] = [
  { code: 'list', title: 'BOX COMPLETO', hasPlaylist: true },
  { code: 'app', title: 'BOX PLAYER', hasPlaylist: false },
]

export const TELAS = [1, 2, 3] as const

export interface Duration {
  months: number
  label: string
}

export const DURATIONS: Duration[] = [
  { months: 1, label: 'Mensal' },
  { months: 3, label: 'Trimestral' },
  { months: 6, label: 'Semestral' },
  { months: 12, label: 'Anual' },
]

export function familyTitle(family: string): string {
  return family === 'list' ? 'BOX COMPLETO' : 'BOX PLAYER'
}

export function durationLabel(months: number): string {
  switch (months) {
    case 1:
      return 'Mensal'
    case 3:
      return 'Trimestral'
    case 6:
      return 'Semestral'
    case 12:
      return 'Anual'
    default:
      return `${months} meses`
  }
}

export function buildPlanCode(
  family: string,
  telas: number,
  months: number
): string {
  return `${family}_${telas}t_${months}m`
}

export function planTitleFor(
  family: string,
  telas: number,
  months: number
): string {
  const t = telas === 1 ? '1 Tela' : `${telas} Telas`
  return `${familyTitle(family)} · ${t} · ${durationLabel(months)}`
}

// Traduz os códigos ANTIGOS já gravados para o modelo paramétrico.
const LEGACY: Record<string, PlanSpec> = {
  plan_basic: { family: 'list', telas: 1, months: 1 },
  plan_standard: { family: 'list', telas: 2, months: 1 },
  plan_platinum: { family: 'list', telas: 3, months: 1 },
  app_monthly: { family: 'app', telas: 1, months: 1 },
  app_quarterly: { family: 'app', telas: 2, months: 3 },
  app_annual: { family: 'app', telas: 3, months: 12 },
}
const CODE_RE = /^(app|list)_(\d+)t_(\d+)m$/

export interface PlanSpec {
  family: string
  telas: number
  months: number
}

export function parsePlanCode(code: string | null | undefined): PlanSpec | null {
  if (!code) return null
  if (LEGACY[code]) return LEGACY[code]
  const m = code.match(CODE_RE)
  if (!m) return null
  return { family: m[1], telas: parseInt(m[2], 10), months: parseInt(m[3], 10) }
}

/** Rótulo amigável de um código (novo, legado, trial ou desconhecido). */
export function planLabel(code: string | null | undefined): string {
  if (!code) return '—'
  if (code === 'trial_3dias') return 'BOX TESTE (3 dias)'
  if (code === 'teste_iptv') return 'Teste IPTV 6h'
  const s = parsePlanCode(code)
  return s ? planTitleFor(s.family, s.telas, s.months) : code
}

export interface PlanPreset {
  code: string
  title: string
  maxProfiles: number
  days: number
  family: string
  telas: number
  months: number
}

// Catálogo completo gerado (2 famílias × 3 telas × 4 durações = 24 combos).
// Usado pelos dropdowns de cupom e assinatura no dashboard.
export const PLAN_PRESETS: PlanPreset[] = FAMILIES.flatMap((f) =>
  TELAS.flatMap((t) =>
    DURATIONS.map((d) => ({
      code: buildPlanCode(f.code, t, d.months),
      title: planTitleFor(f.code, t, d.months),
      maxProfiles: t,
      days: d.months * 30,
      family: f.code,
      telas: t,
      months: d.months,
    }))
  )
)
