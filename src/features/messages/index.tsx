import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  MessagesSquare,
  Search as SearchIcon,
  Send,
  SquarePen,
  Trash2,
} from 'lucide-react'
import {
  deleteBroadcast,
  deleteMessage,
  listMessages,
  listUsers,
  sendMessage,
  type PopupType,
  type SendMessageInput,
} from '@/lib/admin-api'
import { cn, getDisplayNameInitials } from '@/lib/utils'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  usePresenceMap,
  type PresenceState,
} from '@/features/presence/use-account-presence'
import {
  NewMessageDialog,
  type MessageTarget,
} from './components/new-message-dialog'

export function Messages() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MessageTarget | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Compose
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [popup, setPopup] = useState<PopupType>('full')

  const presenceMap = usePresenceMap()

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => listUsers(),
  })

  const selectedUserId =
    selected?.type === 'user' ? selected.user.id : undefined

  const threadQuery = useQuery({
    queryKey: ['admin-messages', selectedUserId],
    queryFn: () => listMessages(selectedUserId),
    enabled: !!selectedUserId,
  })

  const broadcastsQuery = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: () => listMessages(),
    enabled: selected?.type === 'broadcast',
  })

  const sendMutation = useMutation({
    mutationFn: (input: SendMessageInput) => sendMessage(input),
    onSuccess: (res, vars) => {
      setTitle('')
      setBody('')
      setImageUrl('')
      if (vars.target === 'user') {
        toast.success('Mensagem enviada.')
        queryClient.invalidateQueries({
          queryKey: ['admin-messages', vars.userId],
        })
      } else {
        toast.success(`Broadcast enviado para ${res.sent ?? 0} usuários.`)
        queryClient.invalidateQueries({ queryKey: ['admin-broadcasts'] })
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar.')
    },
  })

  const deleteMsgMutation = useMutation({
    mutationFn: (messageId: string) => deleteMessage(messageId),
    onSuccess: () => {
      toast.success('Mensagem apagada.')
      queryClient.invalidateQueries({ queryKey: ['admin-messages'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao apagar.'),
  })

  const deleteBroadcastMutation = useMutation({
    mutationFn: (broadcastId: string) => deleteBroadcast(broadcastId),
    onSuccess: () => {
      toast.success('Broadcast apagado.')
      queryClient.invalidateQueries({ queryKey: ['admin-broadcasts'] })
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao apagar.'),
  })

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const all = usersQuery.data ?? []
    if (!q) return all
    return all.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [usersQuery.data, search])

  const broadcasts = useMemo(() => {
    const rows = broadcastsQuery.data ?? []
    const map = new Map<
      string,
      {
        broadcastId: string
        title: string
        body: string
        count: number
        createdAt: string
      }
    >()
    for (const m of rows) {
      if (!m.broadcastId) continue
      const cur = map.get(m.broadcastId)
      if (cur) cur.count += 1
      else
        map.set(m.broadcastId, {
          broadcastId: m.broadcastId,
          title: m.title,
          body: m.body,
          count: 1,
          createdAt: m.createdAt,
        })
    }
    return [...map.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    )
  }, [broadcastsQuery.data])

  function handleSend() {
    if (!selected) return
    if (!title.trim() || !body.trim()) {
      toast.error('Preencha título e texto.')
      return
    }
    const base = {
      title: title.trim(),
      body: body.trim(),
      imageUrl: imageUrl.trim() || undefined,
      popup,
    }
    const input: SendMessageInput =
      selected.type === 'user'
        ? { ...base, target: 'user', userId: selected.user.id }
        : { ...base, target: 'all' }
    sendMutation.mutate(input)
  }

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center gap-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fixed fluid>
        <section className='flex h-full gap-6'>
          {/* ===== Inbox (esquerda) ===== */}
          <div className='flex w-full shrink-0 flex-col gap-3 lg:w-96 2xl:w-[28rem]'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <h1 className='text-2xl font-bold tracking-tight'>Mensagens</h1>
                <MessagesSquare className='size-5' />
              </div>
              <Button
                variant='ghost'
                size='icon'
                title='Nova mensagem'
                onClick={() => setDialogOpen(true)}
              >
                <SquarePen className='size-5' />
              </Button>
            </div>

            <div className='relative'>
              <SearchIcon className='absolute start-2.5 top-2.5 size-4 text-muted-foreground' />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Buscar usuário…'
                className='ps-8'
              />
            </div>

            <button
              type='button'
              onClick={() => setSelected({ type: 'broadcast' })}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 text-start transition-colors hover:bg-muted',
                selected?.type === 'broadcast' && 'border-primary bg-muted'
              )}
            >
              <div className='flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary'>
                <Megaphone className='size-4' />
              </div>
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>Todos</p>
                <p className='truncate text-xs text-muted-foreground'>
                  Broadcast para toda a base
                </p>
              </div>
            </button>

            <ScrollArea className='-mx-1 flex-1 px-1'>
              <div className='flex flex-col gap-1'>
                {usersQuery.isLoading && (
                  <div className='flex items-center justify-center py-8 text-muted-foreground'>
                    <Loader2 className='size-5 animate-spin' />
                  </div>
                )}
                {usersQuery.isError && (
                  <p className='px-2 py-4 text-sm text-destructive'>
                    Erro ao carregar usuários. Verifique o box-handler/CORS.
                  </p>
                )}
                {!usersQuery.isLoading &&
                  filteredUsers.map((u) => {
                    const active =
                      selected?.type === 'user' && selected.user.id === u.id
                    return (
                      <button
                        key={u.id}
                        type='button'
                        onClick={() => setSelected({ type: 'user', user: u })}
                        className={cn(
                          'flex items-center gap-3 rounded-lg p-2 text-start transition-colors hover:bg-muted',
                          active && 'bg-muted'
                        )}
                      >
                        <div className='relative shrink-0'>
                          <Avatar className='size-9'>
                            <AvatarImage
                              src={u.avatarUrl || '/default-avatar.jpg'}
                              alt={u.name}
                            />
                            <AvatarFallback>
                              {getDisplayNameInitials(u.name || u.email || '?')}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              'absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background',
                              presenceMap.get(u.id)?.online
                                ? 'bg-emerald-500'
                                : 'bg-muted-foreground/50'
                            )}
                          />
                        </div>
                        <div className='min-w-0 flex-1'>
                          <p className='truncate text-sm font-medium'>
                            {u.name || '(sem nome)'}
                          </p>
                          <PresenceLine
                            state={presenceMap.get(u.id)}
                            fallback={u.email}
                          />
                        </div>
                        {u.isAdmin && (
                          <Badge
                            variant='secondary'
                            className='shrink-0 text-[10px]'
                          >
                            admin
                          </Badge>
                        )}
                        {u.banned && (
                          <Badge
                            variant='destructive'
                            className='shrink-0 text-[10px]'
                          >
                            banido
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                {!usersQuery.isLoading &&
                  !usersQuery.isError &&
                  filteredUsers.length === 0 && (
                    <p className='px-2 py-4 text-sm text-muted-foreground'>
                      Nenhum usuário.
                    </p>
                  )}
              </div>
            </ScrollArea>
          </div>

          {/* ===== Conversa (direita) ===== */}
          <div className='hidden min-w-0 flex-1 flex-col overflow-hidden rounded-xl border lg:flex'>
            {!selected ? (
              <div className='flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground'>
                <div className='flex size-16 items-center justify-center rounded-full border'>
                  <MessagesSquare className='size-7 opacity-60' />
                </div>
                <div>
                  <p className='text-lg font-semibold text-foreground'>
                    Suas mensagens
                  </p>
                  <p className='text-sm'>
                    Escolha um contato ou envie uma nova mensagem.
                  </p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>
                  <SquarePen /> Nova mensagem
                </Button>
              </div>
            ) : (
              <>
                <div className='flex items-center gap-3 border-b p-4'>
                  {selected.type === 'broadcast' ? (
                    <>
                      <div className='flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary'>
                        <Megaphone className='size-4' />
                      </div>
                      <div>
                        <p className='font-semibold'>Todos (broadcast)</p>
                        <p className='text-xs text-muted-foreground'>
                          Vai para todos os usuários cadastrados
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className='relative shrink-0'>
                        <Avatar className='size-9'>
                          <AvatarImage
                            src={
                              selected.user.avatarUrl || '/default-avatar.jpg'
                            }
                            alt={selected.user.name}
                          />
                          <AvatarFallback>
                            {getDisplayNameInitials(
                              selected.user.name || selected.user.email || '?'
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            'absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background',
                            presenceMap.get(selected.user.id)?.online
                              ? 'bg-emerald-500'
                              : 'bg-muted-foreground/50'
                          )}
                        />
                      </div>
                      <div className='min-w-0'>
                        <p className='truncate font-semibold'>
                          {selected.user.name || '(sem nome)'}
                        </p>
                        <PresenceLine
                          state={presenceMap.get(selected.user.id)}
                          fallback={
                            selected.user.email +
                            (selected.user.plan
                              ? ` · ${selected.user.plan}`
                              : '')
                          }
                        />
                      </div>
                    </>
                  )}
                </div>

                <ScrollArea className='min-h-0 flex-1 p-4'>
                  {selected.type === 'user' ? (
                    <UserThread
                      loading={threadQuery.isLoading}
                      messages={(threadQuery.data ?? []).slice().reverse()}
                      onDelete={(id) => deleteMsgMutation.mutate(id)}
                      deleting={deleteMsgMutation.isPending}
                    />
                  ) : (
                    <BroadcastHistory
                      loading={broadcastsQuery.isLoading}
                      broadcasts={broadcasts}
                      onDelete={(id) => deleteBroadcastMutation.mutate(id)}
                      deleting={deleteBroadcastMutation.isPending}
                    />
                  )}
                </ScrollArea>

                <div className='space-y-2 border-t p-4'>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder='Título'
                    maxLength={120}
                  />
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder='Escreva a mensagem…'
                    rows={2}
                    maxLength={2000}
                  />
                  <PopupPicker value={popup} onChange={setPopup} />
                  <div className='flex items-center gap-2'>
                    <Input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder='URL de imagem (opcional)'
                    />
                    <Button
                      onClick={handleSend}
                      disabled={sendMutation.isPending}
                    >
                      {sendMutation.isPending ? (
                        <Loader2 className='animate-spin' />
                      ) : (
                        <Send />
                      )}
                      Enviar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </Main>

      <NewMessageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        users={usersQuery.data ?? []}
        loading={usersQuery.isLoading}
        onPick={(t) => setSelected(t)}
      />
    </>
  )
}

/** Linha de presença: assistindo / online / visto há X + último assistido. */
function PresenceLine({
  state,
  fallback,
}: {
  state?: PresenceState
  fallback: string
}) {
  if (!state) {
    return <p className='truncate text-xs text-muted-foreground'>{fallback}</p>
  }
  const { online, row } = state
  const watching = online && row.isWatching && !!row.contentTitle
  const lastSeen = formatDistanceToNow(new Date(row.$updatedAt), {
    addSuffix: true,
    locale: ptBR,
  })
  const here = row.screen ?? 'online'
  const text = watching
    ? `▶ assistindo: ${row.contentTitle}`
    : online
      ? row.contentTitle
        ? `${here} · último: ${row.contentTitle}`
        : here
      : row.contentTitle
        ? `visto ${lastSeen} · último: ${row.contentTitle}`
        : `visto ${lastSeen}`
  return (
    <p
      className={cn(
        'truncate text-xs',
        watching ? 'text-emerald-500' : 'text-muted-foreground'
      )}
    >
      {text}
    </p>
  )
}

const POPUP_OPTIONS: {
  value: PopupType
  label: string
  icon: typeof Bell
  hint: string
}[] = [
  { value: 'silent', label: 'Silenciosa', icon: BellOff, hint: 'Só na caixa de entrada' },
  { value: 'full', label: 'Pop completo', icon: ImageIcon, hint: 'Título + texto + imagem' },
  { value: 'mini', label: 'Pop mini', icon: Bell, hint: '“+1 nova mensagem”' },
]

/** Seletor do tipo de pop que a mensagem vai disparar no app. */
function PopupPicker({
  value,
  onChange,
}: {
  value: PopupType
  onChange: (v: PopupType) => void
}) {
  return (
    <div className='grid grid-cols-3 gap-2'>
      {POPUP_OPTIONS.map((o) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type='button'
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center text-xs transition-colors',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Icon className='size-4' />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function UserThread({
  loading,
  messages,
  onDelete,
  deleting,
}: {
  loading: boolean
  messages: {
    id: string
    title: string
    body: string
    imageUrl: string | null
    read: boolean
    createdAt: string
  }[]
  onDelete: (id: string) => void
  deleting: boolean
}) {
  if (loading) {
    return (
      <div className='flex justify-center py-8 text-muted-foreground'>
        <Loader2 className='size-5 animate-spin' />
      </div>
    )
  }
  if (messages.length === 0) {
    return (
      <p className='py-8 text-center text-sm text-muted-foreground'>
        Nenhuma mensagem enviada ainda.
      </p>
    )
  }
  return (
    <div className='flex flex-col gap-3'>
      {messages.map((m) => (
        <div key={m.id} className='group ms-auto max-w-[80%]'>
          <div className='rounded-2xl rounded-ee-sm bg-primary px-4 py-2 text-primary-foreground'>
            <p className='text-sm font-semibold'>{m.title}</p>
            <p className='whitespace-pre-wrap text-sm'>{m.body}</p>
            {m.imageUrl && (
              <img
                src={m.imageUrl}
                alt=''
                className='mt-2 max-h-40 rounded-lg object-cover'
              />
            )}
          </div>
          <div className='mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground'>
            <button
              type='button'
              disabled={deleting}
              onClick={() => onDelete(m.id)}
              className='opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100'
              title='Apagar mensagem'
            >
              <Trash2 className='size-3.5' />
            </button>
            <span>{format(new Date(m.createdAt), 'dd/MM HH:mm')}</span>
            {m.read ? (
              <CheckCheck className='size-3 text-sky-500' />
            ) : (
              <Check className='size-3' />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function BroadcastHistory({
  loading,
  broadcasts,
  onDelete,
  deleting,
}: {
  loading: boolean
  broadcasts: {
    broadcastId: string
    title: string
    body: string
    count: number
    createdAt: string
  }[]
  onDelete: (broadcastId: string) => void
  deleting: boolean
}) {
  if (loading) {
    return (
      <div className='flex justify-center py-8 text-muted-foreground'>
        <Loader2 className='size-5 animate-spin' />
      </div>
    )
  }
  if (broadcasts.length === 0) {
    return (
      <p className='py-8 text-center text-sm text-muted-foreground'>
        Nenhum broadcast enviado ainda.
      </p>
    )
  }
  return (
    <div className='flex flex-col gap-3'>
      <p className='text-xs font-medium text-muted-foreground'>
        Broadcasts recentes
      </p>
      {broadcasts.map((b) => (
        <div key={b.broadcastId} className='rounded-lg border p-3'>
          <div className='flex items-center justify-between gap-2'>
            <p className='text-sm font-semibold'>{b.title}</p>
            <div className='flex shrink-0 items-center gap-2'>
              <Badge variant='secondary' className='text-[10px]'>
                {b.count} destinatários
              </Badge>
              <button
                type='button'
                disabled={deleting}
                onClick={() => onDelete(b.broadcastId)}
                className='text-muted-foreground transition-colors hover:text-destructive'
                title='Apagar broadcast (de todos)'
              >
                <Trash2 className='size-4' />
              </button>
            </div>
          </div>
          <p className='whitespace-pre-wrap text-sm text-muted-foreground'>
            {b.body}
          </p>
          <p className='mt-1 text-[11px] text-muted-foreground'>
            {format(new Date(b.createdAt), 'dd/MM HH:mm')}
          </p>
        </div>
      ))}
    </div>
  )
}
