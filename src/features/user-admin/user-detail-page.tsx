import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MapPin,
  Pencil,
  Play,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  deleteUser,
  effectivelyBanned,
  getUserAudience,
  getUserDetails,
  listMessages,
  listSupportLeads,
  platformLabel,
  setAdmin,
  setPassword,
  updateSubprofile,
  updateUser,
  type AdminUserRow,
  type SubProfile,
  type UpdateSubprofileInput,
  type UpdateUserInput,
  type UserAudience,
} from '@/lib/admin-api'
import { getDisplayNameInitials } from '@/lib/utils'
import { PlatformIcon } from './platform-icon'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useAccountPresence } from '@/features/presence/use-account-presence'
import { useFavorites, useWatchHistory } from './use-user-content'
import { ResetPasswordDialog } from './reset-password-dialog'
import { EditSubprofileDialog } from './edit-subprofile-dialog'
import { EditUserDialog } from './edit-user-dialog'
import { UserActionsBar, copyId, useUserActions } from './user-actions'

const route = getRouteApi('/_authenticated/user-admin/$userId')

function fmtWatchTime(sec: number) {
  if (sec <= 0) return '0min'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

function fmtOnlineTime(sec: number) {
  if (sec <= 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function fmt(iso: string | null | undefined, withTime = false) {
  if (!iso) return '—'
  try {
    return format(new Date(iso), withTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy')
  } catch {
    return '—'
  }
}

export function UserDetailPage() {
  const { userId } = route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const actions = useUserActions()

  const q = useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: () => getUserDetails(userId),
    enabled: !!userId,
  })
  const d = q.data
  const banned = d ? effectivelyBanned(d.user.banned, d.user.banUntil) : false
  const presence = useAccountPresence(userId)

  // Histórico + favoritos ao vivo (Realtime). O `watch_history.profile_id`
  // guarda o **id da CONTA** (não do sub-perfil), então incluímos o `userId`
  // além dos sub-perfis (robusto p/ dados antigos) — senão vinha vazio (0h/0).
  const profileIds = useMemo(
    () => [userId, ...(d?.subProfiles ?? []).map((s) => s.id)],
    [d, userId]
  )
  const watchQuery = useWatchHistory(userId, profileIds)
  const favQuery = useFavorites(userId, profileIds)
  const watchHistory = watchQuery.data ?? []
  const favorites = favQuery.data ?? []

  // Audiência do usuário (analytics agregado no servidor — todos os registros,
  // não só os 24 recentes). Fonte dos stats corretos + da seção Audiência.
  const audQuery = useQuery({
    queryKey: ['user-audience', userId],
    queryFn: () => getUserAudience(userId),
    enabled: !!userId,
  })
  const aud = audQuery.data

  // Horas assistidas: usa o total do servidor; cai no cliente (24 recentes) só
  // enquanto carrega.
  const totalWatchedSec =
    aud?.totals.watchedSec ??
    watchHistory.reduce((acc, w) => acc + (w.lastPosition || 0), 0)
  const contentCount = aud?.totals.titles ?? watchHistory.length
  const memberSince = d?.user.registration
    ? formatDistanceToNow(new Date(d.user.registration), { locale: ptBR })
    : '—'

  // Mensagens enviadas pra este usuário (reusa a mesma query do Chat).
  const messagesQuery = useQuery({
    queryKey: ['admin-messages', userId],
    queryFn: () => listMessages(userId),
    enabled: !!userId,
  })
  // Histórico de contratações (leads) deste usuário.
  const leadsQuery = useQuery({
    queryKey: ['support-leads', userId],
    queryFn: () => listSupportLeads(userId),
    enabled: !!userId,
  })
  const leads = leadsQuery.data ?? []
  const row: AdminUserRow | null = d
    ? { ...d.user, createdAt: d.user.createdAt ?? '' }
    : null

  // Dialog / UI state
  const [editUserOpen, setEditUserOpen] = useState(false)
  const [resetPwOpen, setResetPwOpen] = useState(false)
  const [editSub, setEditSub] = useState<SubProfile | null>(null)
  const [editSubOpen, setEditSubOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] })
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  }

  const updateUserMut = useMutation({
    mutationFn: (fields: UpdateUserInput) => updateUser(userId, fields),
    onSuccess: () => {
      toast.success('Dados atualizados.')
      setEditUserOpen(false)
      invalidate()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  })

  const setAdminMut = useMutation({
    mutationFn: (isAdmin: boolean) => setAdmin(userId, isAdmin),
    onSuccess: (_r, isAdmin) => {
      toast.success(isAdmin ? 'Agora é admin.' : 'Admin removido.')
      invalidate()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao atualizar.'),
  })

  const setPasswordMut = useMutation({
    mutationFn: (password: string) => setPassword(userId, password),
    onSuccess: () => {
      toast.success('Senha redefinida.')
      setResetPwOpen(false)
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao redefinir senha.'),
  })

  const updateSubMut = useMutation({
    mutationFn: (v: { profileId: string; fields: UpdateSubprofileInput }) =>
      updateSubprofile(v.profileId, v.fields),
    onSuccess: () => {
      toast.success('Sub-perfil atualizado.')
      setEditSubOpen(false)
      invalidate()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteUser(userId),
    onSuccess: () => {
      toast.success('Usuário excluído.')
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      navigate({ to: '/user-admin' })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir.'),
  })

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <Header>
        <Button
          variant='ghost'
          size='icon'
          aria-label='Voltar'
          onClick={() => navigate({ to: '/user-admin' })}
        >
          <ArrowLeft className='size-5' />
        </Button>
        <h1 className='text-lg font-semibold'>Perfil do usuário</h1>
        <div className='ms-auto flex items-center gap-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        {q.isLoading && (
          <div className='flex justify-center py-20 text-muted-foreground'>
            <Loader2 className='size-6 animate-spin' />
          </div>
        )}
        {q.isError && (
          <p className='py-16 text-center text-sm text-destructive'>
            Erro ao carregar. Verifique o box-handler/CORS.
          </p>
        )}

        {d && row && (
          <div className='space-y-8'>
            {/* ===== Cabeçalho + ações ===== */}
            <div className='flex flex-wrap items-center gap-5'>
              <div className='relative shrink-0'>
                <Avatar className='size-20'>
                  <AvatarImage
                    src={d.user.avatarUrl || '/default-avatar.jpg'}
                    alt={d.user.name}
                  />
                  <AvatarFallback>
                    {getDisplayNameInitials(d.user.name || d.user.email || '?')}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={
                    'absolute end-1 bottom-1 size-4 rounded-full border-2 border-background ' +
                    (presence.online ? 'bg-emerald-500' : 'bg-muted-foreground/50')
                  }
                  title={presence.online ? 'online' : 'offline'}
                />
              </div>
              <div className='min-w-0'>
                <p className='truncate text-2xl font-bold tracking-tight'>
                  {d.user.name || '(sem nome)'}
                </p>
                <p className='truncate text-muted-foreground'>{d.user.email}</p>
                <div className='mt-2 flex flex-wrap gap-1'>
                  {presence.online ? (
                    <Badge
                      variant='outline'
                      className='gap-1 border-emerald-500/40 text-emerald-500'
                    >
                      <span className='size-2 rounded-full bg-emerald-500' />
                      online
                    </Badge>
                  ) : (
                    <Badge variant='outline' className='gap-1 text-muted-foreground'>
                      <span className='size-2 rounded-full bg-muted-foreground/50' />
                      {presence.row
                        ? `visto ${formatDistanceToNow(new Date(presence.row.$updatedAt), { addSuffix: true, locale: ptBR })}`
                        : 'offline'}
                    </Badge>
                  )}
                  {presence.watching && presence.row?.contentTitle ? (
                    <Badge
                      variant='outline'
                      className='gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                    >
                      <Play className='size-3' /> assistindo:{' '}
                      {presence.row.contentTitle}
                    </Badge>
                  ) : presence.row?.contentTitle ? (
                    <Badge variant='secondary' className='gap-1'>
                      <Play className='size-3' /> último:{' '}
                      {presence.row.contentTitle}
                    </Badge>
                  ) : null}
                  {presence.online &&
                    !presence.watching &&
                    presence.row?.screen && (
                      <Badge variant='outline' className='gap-1'>
                        <MapPin className='size-3' /> {presence.row.screen}
                      </Badge>
                    )}
                  {d.user.isAdmin && (
                    <Badge variant='secondary' className='gap-1'>
                      <ShieldCheck className='size-3' /> admin
                    </Badge>
                  )}
                  {banned ? (
                    <Badge variant='destructive'>
                      {d.user.banUntil
                        ? `banido até ${fmt(d.user.banUntil)}`
                        : 'banido (permanente)'}
                    </Badge>
                  ) : (
                    <Badge variant='outline'>ativo</Badge>
                  )}
                </div>
              </div>
              <div className='ms-auto flex flex-wrap items-center justify-end gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setEditUserOpen(true)}
                >
                  <Pencil className='size-4' /> Editar dados
                </Button>
                <UserActionsBar user={row} banned={banned} actions={actions} />
              </div>
            </div>

            {banned && d.user.banMessage && (
              <div className='rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm'>
                <p className='mb-1 font-medium text-destructive'>
                  Mensagem de banimento
                </p>
                <p className='whitespace-pre-wrap text-muted-foreground'>
                  {d.user.banMessage}
                </p>
              </div>
            )}

            <div className='space-y-6 rounded-2xl border bg-card p-4 sm:p-5'>
            {/* ===== Conta ===== */}
            <Section title='👤 Conta'>
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                <InfoCopy label='ID' value={d.user.id} />
                <Info
                  label='Conta'
                  value={d.user.status === false ? 'Bloqueada' : 'Ativa'}
                />
                <Info
                  label='E-mail verificado'
                  value={d.user.emailVerification ? 'Sim' : 'Não'}
                />
                <Info label='Registrado' value={fmt(d.user.registration)} />
                <Info
                  label='Último acesso'
                  value={fmt(d.user.accessedAt, true)}
                />
                <Info
                  label='Versão do app'
                  value={d.user.appVersion || '—'}
                />
                <Info
                  label='Tela (lógica@DPR • física)'
                  value={d.user.screenInfo || '—'}
                />
                <div className='flex min-h-[62px] flex-col justify-center gap-1 rounded-lg bg-muted px-3.5 py-2.5'>
                  <p className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
                    Plataforma
                  </p>
                  <div className='flex items-center gap-1.5'>
                    <PlatformIcon
                      code={d.user.platform}
                      className='size-4 shrink-0 text-muted-foreground'
                    />
                    <p className='truncate font-medium'>
                      {platformLabel(d.user.platform) || '—'}
                    </p>
                  </div>
                </div>
                <Info
                  label='Último acesso ao app'
                  value={fmt(d.user.clientSeenAt, true)}
                />
                <div className='flex min-h-[62px] flex-col justify-center gap-1 rounded-lg bg-muted px-3.5 py-2.5'>
                  <p className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
                    Presença
                  </p>
                  <div className='flex items-center gap-1.5'>
                    <span
                      className={
                        'size-2.5 shrink-0 rounded-full ' +
                        (presence.online
                          ? 'bg-emerald-500'
                          : 'bg-muted-foreground/50')
                      }
                    />
                    <p className='truncate font-medium'>
                      {presence.online
                        ? presence.watching
                          ? 'Assistindo'
                          : presence.row?.screen
                            ? `Online · ${presence.row.screen}`
                            : 'Online agora'
                        : 'Offline'}
                    </p>
                  </div>
                </div>
                <div className='flex min-h-[62px] flex-col justify-center gap-1 rounded-lg bg-muted px-3.5 py-2.5'>
                  <p className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
                    Última vez online
                  </p>
                  <p className='truncate font-medium'>
                    {presence.online
                      ? 'Agora'
                      : presence.row
                        ? fmt(presence.row.$updatedAt, true)
                        : '—'}
                  </p>
                </div>
              </div>
            </Section>

            {/* ===== Estatísticas ===== */}
            <Section title='📊 Estatísticas'>
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                <Info
                  label='Tempo online'
                  value={fmtOnlineTime(presence.row?.totalOnlineSeconds ?? 0)}
                />
                <Info
                  label='Horas assistidas'
                  value={fmtWatchTime(totalWatchedSec)}
                />
                <Info
                  label='Conteúdos assistidos'
                  value={`${contentCount}`}
                />
                <Info label='Membro há' value={memberSince} />
              </div>
            </Section>

            {/* ===== Audiência do usuário ===== */}
            {aud && aud.totals.plays > 0 && (
              <Section title='🎬 Audiência'>
                <UserAudiencePanel aud={aud} />
              </Section>
            )}

            {/* ===== Contratações (leads WhatsApp) ===== */}
            <Section title='🤝 Contratações'>
              {leadsQuery.isLoading ? (
                <div className='flex justify-center py-4 text-muted-foreground'>
                  <Loader2 className='size-5 animate-spin' />
                </div>
              ) : leads.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  Nenhuma contratação direcionada ao WhatsApp.
                </p>
              ) : (
                <div className='max-h-80 space-y-2 overflow-y-auto pr-1'>
                  {leads.map((l) => (
                    <div key={l.id} className='rounded-lg bg-muted p-3'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='min-w-0'>
                          <p className='text-sm font-semibold'>
                            {l.planTitle || l.planId || 'Plano'}
                            {l.maxScreens ? ` · ${l.maxScreens} tela(s)` : ''}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            {l.reason || '—'}
                          </p>
                        </div>
                        {l.status === 'resolvido' ? (
                          <Badge className='shrink-0 gap-1 bg-emerald-600 text-white hover:bg-emerald-600'>
                            <CheckCheck className='size-3' /> Resolvido
                          </Badge>
                        ) : (
                          <Badge
                            variant='outline'
                            className='shrink-0 text-amber-500'
                          >
                            Pendente
                          </Badge>
                        )}
                      </div>
                      <div className='mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                        {l.price && (
                          <span className='font-semibold text-foreground'>
                            R$ {l.price}
                          </span>
                        )}
                        {l.couponCode && (
                          <Badge variant='secondary' className='text-[10px]'>
                            🎟 {l.couponCode}
                            {l.discountPercent ? ` -${l.discountPercent}%` : ''}
                          </Badge>
                        )}
                        <span>· {l.source || 'checkout'}</span>
                        <span>· {fmt(l.createdAt, true)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ===== Mensagens enviadas ===== */}
            <Section title='📨 Mensagens enviadas'>
              {messagesQuery.isLoading ? (
                <div className='flex justify-center py-4 text-muted-foreground'>
                  <Loader2 className='size-5 animate-spin' />
                </div>
              ) : (messagesQuery.data ?? []).length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  Nenhuma mensagem enviada.
                </p>
              ) : (
                <div className='max-h-80 space-y-2 overflow-y-auto pr-1'>
                  {(messagesQuery.data ?? []).map((m) => (
                    <div key={m.id} className='rounded-lg bg-muted p-3'>
                      <div className='flex items-start justify-between gap-2'>
                        <p className='text-sm font-semibold'>{m.title}</p>
                        <div className='flex shrink-0 items-center gap-2'>
                          {m.broadcastId && (
                            <Badge variant='secondary' className='text-[10px]'>
                              broadcast
                            </Badge>
                          )}
                          {m.read ? (
                            <span className='flex items-center gap-1 text-[11px] text-sky-500'>
                              <CheckCheck className='size-3' /> lida
                            </span>
                          ) : (
                            <span className='text-[11px] text-muted-foreground'>
                              não lida
                            </span>
                          )}
                        </div>
                      </div>
                      <p className='whitespace-pre-wrap text-sm text-muted-foreground'>
                        {m.body}
                      </p>
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          alt=''
                          className='mt-2 max-h-32 rounded-lg object-cover'
                        />
                      )}
                      <p className='mt-1 text-[11px] text-muted-foreground'>
                        {fmt(m.createdAt, true)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ===== Assinatura ===== */}
            <Section title='💳 Assinatura'>
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                <Info label='Plano' value={d.user.plan || '—'} />
                <Info label='Expira' value={fmt(d.user.subscriptionExpiresAt)} />
                <Info
                  label='Ativada em'
                  value={fmt(d.user.subscriptionActivatedAt)}
                />
                <Info
                  label='Máx. telas'
                  value={d.user.maxProfiles?.toString() || '—'}
                />
              </div>
              <div className='mt-3 flex justify-end'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => actions.editSubscription(row)}
                >
                  <Pencil className='size-4' /> Editar assinatura
                </Button>
              </div>
            </Section>

            {/* ===== Dados pessoais ===== */}
            <Section title='📋 Dados pessoais'>
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                <Info label='Nome completo' value={d.user.fullName || '—'} />
                <Info label='Telefone' value={d.user.phone || '—'} />
                <Info label='CPF' value={d.user.cpf || '—'} />
                <Info label='Nascimento' value={d.user.birthDate || '—'} />
              </div>
            </Section>

            {/* ===== Acesso (admin) ===== */}
            <Section title='🔐 Acesso'>
              <div className='grid gap-3'>
                <ControlRow
                  icon={<ShieldCheck className='size-5' />}
                  title='Administrador'
                  desc='Acesso total ao painel; bypassa várias regras do app.'
                >
                  {d.user.isAdmin ? (
                    <Badge variant='secondary'>Sim</Badge>
                  ) : (
                    <Badge variant='outline'>Não</Badge>
                  )}
                  <Switch
                    checked={d.user.isAdmin}
                    disabled={setAdminMut.isPending}
                    onCheckedChange={(v) => {
                      if (
                        confirm(
                          v
                            ? 'Tornar este usuário administrador?'
                            : 'Remover acesso de admin deste usuário?'
                        )
                      )
                        setAdminMut.mutate(v)
                    }}
                  />
                </ControlRow>

                <ControlRow
                  icon={<Ban className='size-5' />}
                  title='Banimento'
                  desc='Bloqueia o acesso do usuário ao app (com duração e mensagem).'
                >
                  {banned ? (
                    <Badge variant='destructive'>
                      {d.user.banUntil ? `até ${fmt(d.user.banUntil)}` : 'permanente'}
                    </Badge>
                  ) : (
                    <Badge variant='outline'>ativo</Badge>
                  )}
                  {banned ? (
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={actions.banPending}
                      onClick={() => actions.unban(row)}
                    >
                      Desbanir
                    </Button>
                  ) : (
                    <Button
                      variant='destructive'
                      size='sm'
                      disabled={actions.banPending}
                      onClick={() => actions.openBan(row)}
                    >
                      Banir
                    </Button>
                  )}
                </ControlRow>

                <ControlRow
                  icon={<KeyRound className='size-5' />}
                  title='Senha de login'
                  desc='Defina uma nova senha quando o usuário pedir (esqueceu/recuperação).'
                >
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setResetPwOpen(true)}
                  >
                    Redefinir
                  </Button>
                </ControlRow>
              </div>
            </Section>

            {/* ===== Sub-perfis ===== */}
            <Section title={`👥 Sub-perfis (${d.subProfilesCount})`}>
              {d.subProfiles.length === 0 ? (
                <p className='text-sm text-muted-foreground'>Nenhum.</p>
              ) : (
                <div className='grid gap-3 lg:grid-cols-2'>
                  {d.subProfiles.map((s) => (
                    <div key={s.id} className='rounded-lg bg-muted p-4'>
                      <div className='flex items-center gap-3'>
                        <Avatar className='size-10'>
                          <AvatarImage
                            src={s.avatarUrl || '/default-avatar.jpg'}
                            alt={s.name}
                          />
                          <AvatarFallback>
                            {getDisplayNameInitials(s.name || '?')}
                          </AvatarFallback>
                        </Avatar>
                        <div className='min-w-0 flex-1'>
                          <p className='truncate text-sm font-medium'>
                            {s.name || '(sem nome)'}
                          </p>
                          {s.isKids && (
                            <Badge variant='secondary' className='text-[10px]'>
                              kids
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant='ghost'
                          size='icon'
                          title='Editar sub-perfil'
                          onClick={() => {
                            setEditSub(s)
                            setEditSubOpen(true)
                          }}
                        >
                          <Pencil className='size-4' />
                        </Button>
                      </div>
                      <div className='mt-3 grid gap-1 text-sm'>
                        <CredRow label='Servidor' value={s.serverUrl} />
                        <CredRow label='Usuário' value={s.username} />
                        <div className='flex items-center gap-2'>
                          <span className='w-20 text-muted-foreground'>
                            Senha
                          </span>
                          <span className='font-mono'>
                            {s.password
                              ? revealed.has(s.id)
                                ? s.password
                                : '••••••••'
                              : '—'}
                          </span>
                          {s.password && (
                            <button
                              type='button'
                              className='text-muted-foreground hover:text-foreground'
                              onClick={() => toggleReveal(s.id)}
                              title={revealed.has(s.id) ? 'Ocultar' : 'Mostrar'}
                            >
                              {revealed.has(s.id) ? (
                                <EyeOff className='size-4' />
                              ) : (
                                <Eye className='size-4' />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ===== Pagamentos ===== */}
            <Section title='💰 Pagamentos'>
              {d.payments.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  Nenhum pagamento registrado.
                </p>
              ) : (
                <div className='rounded-lg border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <PaymentBadge status={p.status} />
                          </TableCell>
                          <TableCell className='text-sm'>
                            {p.planTitle || '—'}
                          </TableCell>
                          <TableCell className='text-sm'>
                            {p.amount ? `R$ ${p.amount}` : '—'}
                          </TableCell>
                          <TableCell className='text-sm'>
                            {p.paymentType || '—'}
                          </TableCell>
                          <TableCell className='text-sm'>
                            {fmt(p.createdAt, true)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Section>

            {/* ===== Últimos assistidos ===== */}
            <Section title='🎬 Últimos assistidos'>
              {watchQuery.isLoading ? (
                <div className='flex justify-center py-4 text-muted-foreground'>
                  <Loader2 className='size-5 animate-spin' />
                </div>
              ) : watchHistory.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  Nenhum registro de reprodução.
                </p>
              ) : (
                <div className='grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10'>
                  {watchHistory.map((w) => {
                    const pct =
                      w.totalDuration > 0
                        ? Math.min(100, (w.lastPosition / w.totalDuration) * 100)
                        : 0
                    return (
                      <div key={w.$id} className='space-y-1'>
                        <div className='relative aspect-[2/3] overflow-hidden rounded-md bg-muted'>
                          {w.posterUrl ? (
                            <img
                              src={w.posterUrl}
                              alt={w.title}
                              className='size-full object-cover'
                            />
                          ) : (
                            <div className='flex size-full items-center justify-center text-[10px] text-muted-foreground'>
                              sem capa
                            </div>
                          )}
                          <div className='absolute inset-x-0 bottom-0 h-1 bg-black/40'>
                            <div
                              className='h-full bg-sky-500'
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <p className='truncate text-[11px]' title={w.title}>
                          {w.title}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </Section>

            {/* ===== Favoritos ===== */}
            <Section title='❤️ Favoritos'>
              {favQuery.isLoading ? (
                <div className='flex justify-center py-4 text-muted-foreground'>
                  <Loader2 className='size-5 animate-spin' />
                </div>
              ) : favorites.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  Nenhum favorito.
                </p>
              ) : (
                <div className='grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10'>
                  {favorites.map((f) => (
                    <div key={f.$id} className='space-y-1'>
                      <div className='relative aspect-[2/3] overflow-hidden rounded-md bg-muted'>
                        {f.posterUrl ? (
                          <img
                            src={f.posterUrl}
                            alt={f.title}
                            className='size-full object-cover'
                          />
                        ) : (
                          <div className='flex size-full items-center justify-center text-[10px] text-muted-foreground'>
                            sem capa
                          </div>
                        )}
                      </div>
                      <p className='truncate text-[11px]' title={f.title}>
                        {f.title}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ===== Zona de perigo ===== */}
            <Section title='⚠️ Zona de perigo'>
              <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4'>
                <div>
                  <p className='text-sm font-medium'>Excluir usuário</p>
                  <p className='text-sm text-muted-foreground'>
                    Apaga a conta + perfil + sub-perfis. Irreversível.
                  </p>
                </div>
                <Button
                  variant='destructive'
                  onClick={() => {
                    setDeleteConfirm('')
                    setDeleteOpen(true)
                  }}
                >
                  <Trash2 className='size-4' /> Excluir usuário
                </Button>
              </div>
            </Section>
            </div>
          </div>
        )}
      </Main>

      {/* Diálogos de assinatura + ban (via hook) */}
      {actions.dialogs}

      <EditUserDialog
        open={editUserOpen}
        onOpenChange={setEditUserOpen}
        user={d?.user ?? null}
        onSubmit={(fields) => updateUserMut.mutate(fields)}
        isSaving={updateUserMut.isPending}
      />

      <ResetPasswordDialog
        open={resetPwOpen}
        onOpenChange={setResetPwOpen}
        userName={d?.user.name || d?.user.email || 'usuário'}
        onSubmit={(password) => setPasswordMut.mutate(password)}
        isSaving={setPasswordMut.isPending}
      />

      <EditSubprofileDialog
        open={editSubOpen}
        onOpenChange={setEditSubOpen}
        subProfile={editSub}
        onSubmit={(profileId, fields) =>
          updateSubMut.mutate({ profileId, fields })
        }
        isSaving={updateSubMut.isPending}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga a conta, o perfil e todos os sub-perfis de{' '}
              <strong>{d?.user.name || d?.user.email}</strong>. Não dá pra
              desfazer. Digite <strong>EXCLUIR</strong> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder='EXCLUIR'
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteConfirm !== 'EXCLUIR' || deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault()
                deleteMut.mutate()
              }}
              className='bg-destructive text-white hover:bg-destructive/90'
            >
              {deleteMut.isPending && <Loader2 className='animate-spin' />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function UserAudiencePanel({ aud }: { aud: UserAudience }) {
  const { byType, topWatched, categories, totals } = aud
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <MiniStat label='Filmes' value={`${byType.movie.plays}`} />
        <MiniStat label='Séries' value={`${byType.series.plays}`} />
        <MiniStat
          label='Conclusão média'
          value={`${Math.round(totals.avgCompletion * 100)}%`}
        />
        <MiniStat
          label='Último assistido'
          value={
            totals.lastWatched
              ? format(new Date(totals.lastWatched), 'dd/MM HH:mm')
              : '—'
          }
        />
      </div>

      <div>
        <p className='mb-2 text-sm font-medium'>Mais assistidos por ele</p>
        {topWatched.length === 0 ? (
          <p className='text-sm text-muted-foreground'>Sem dados.</p>
        ) : (
          <div className='space-y-1'>
            {topWatched.map((t, i) => (
              <div
                key={t.title + i}
                className='flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm'
              >
                <span className='truncate'>
                  <span className='me-1 text-xs text-muted-foreground'>
                    {i + 1}.
                  </span>
                  {t.title}
                  <span className='ms-1 text-xs text-muted-foreground'>
                    ({t.type === 'series' ? 'Série' : 'Filme'})
                  </span>
                </span>
                <span className='shrink-0 text-xs text-muted-foreground'>
                  {fmtWatchTime(t.watchedSec)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <div>
          <p className='mb-2 text-sm font-medium'>
            Categorias que mais assiste
          </p>
          <div className='flex flex-wrap gap-1.5'>
            {categories.map((c) => (
              <span
                key={c.name}
                className='rounded-full bg-muted px-2.5 py-1 text-xs'
              >
                {c.name}{' '}
                <span className='text-muted-foreground'>· {c.plays}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg bg-muted/50 p-2.5'>
      <p className='text-[11px] text-muted-foreground'>{label}</p>
      <p className='text-lg font-bold'>{value}</p>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className='bg-muted/40'>
      <CardHeader className='pb-4'>
        <CardTitle className='text-lg'>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ControlRow({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3'>
      <div className='flex items-start gap-3'>
        <div className='mt-0.5 text-muted-foreground'>{icon}</div>
        <div>
          <p className='text-sm font-medium'>{title}</p>
          <p className='text-xs text-muted-foreground'>{desc}</p>
        </div>
      </div>
      <div className='flex items-center gap-2'>{children}</div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex min-h-[62px] flex-col justify-center gap-1 rounded-lg bg-muted px-3.5 py-2.5'>
      <p className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
        {label}
      </p>
      <p className='truncate font-semibold'>{value}</p>
    </div>
  )
}

function InfoCopy({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex min-h-[62px] flex-col justify-center gap-1 rounded-lg bg-muted px-3.5 py-2.5'>
      <p className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
        {label}
      </p>
      <div className='flex items-center gap-1'>
        <p className='truncate font-mono text-sm'>{value}</p>
        <button
          type='button'
          className='text-muted-foreground hover:text-foreground'
          title='Copiar'
          onClick={() => copyId(value)}
        >
          <Copy className='size-3.5' />
        </button>
      </div>
    </div>
  )
}

function CredRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className='flex items-center gap-2'>
      <span className='w-20 text-muted-foreground'>{label}</span>
      <span className='truncate font-mono'>{value || '—'}</span>
    </div>
  )
}

function PaymentBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'pago' || s === 'concluido' || s === 'approved')
    return <Badge className='bg-emerald-600 text-white'>{status}</Badge>
  if (s === 'pendente')
    return <Badge className='bg-amber-500 text-black'>{status}</Badge>
  return <Badge variant='secondary'>{status || '—'}</Badge>
}
