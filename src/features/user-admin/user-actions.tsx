import { type ReactNode, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  MessageCircle,
  Pencil,
  RefreshCw,
} from 'lucide-react'
import {
  setBan,
  setSubscription,
  type AdminUserRow,
  type SetBanInput,
  type SetSubscriptionInput,
} from '@/lib/admin-api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { BanDialog } from './ban-dialog'
import { SubscriptionDialog } from './subscription-dialog'

/** Botão quadrado colorido de ação rápida (tooltip nativo via `title`). */
export function QuickAction({
  label,
  color,
  onClick,
  disabled,
  children,
}: {
  label: string
  color: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type='button'
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-8 items-center justify-center rounded-md text-white shadow-sm transition hover:opacity-85 disabled:opacity-40',
        color
      )}
    >
      {children}
    </button>
  )
}

export async function copyId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
    toast.success('ID copiado.')
  } catch {
    toast.error('Não foi possível copiar.')
  }
}

/** Link do WhatsApp a partir do telefone (adiciona 55 se faltar). */
export function waUrl(phone: string | null): string | null {
  if (!phone) return null
  let d = phone.replace(/\D/g, '')
  if (!d) return null
  if (!d.startsWith('55')) d = '55' + d
  return `https://wa.me/${d}`
}

/**
 * Hook que dona as mutations (assinatura/ban) + os diálogos. Reusado pela
 * tabela de Usuários e pela página de detalhe. Renderize `dialogs` uma vez.
 */
export function useUserActions() {
  const queryClient = useQueryClient()
  const [subUser, setSubUser] = useState<AdminUserRow | null>(null)
  const [subOpen, setSubOpen] = useState(false)
  const [banUser, setBanUser] = useState<AdminUserRow | null>(null)
  const [banOpen, setBanOpen] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] })
  }

  const subMutation = useMutation({
    mutationFn: (input: SetSubscriptionInput) => setSubscription(input),
    onSuccess: () => {
      toast.success('Assinatura atualizada.')
      setSubOpen(false)
      invalidate()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.'),
  })

  const banMutation = useMutation({
    mutationFn: (v: { userId: string; banned: boolean; opts?: SetBanInput }) =>
      setBan(v.userId, v.banned, v.opts),
    onSuccess: (_r, v) => {
      toast.success(v.banned ? 'Usuário banido.' : 'Usuário desbanido.')
      setBanOpen(false)
      invalidate()
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Falha ao atualizar.'),
  })

  const editSubscription = (u: AdminUserRow) => {
    setSubUser(u)
    setSubOpen(true)
  }
  const renew = (u: AdminUserRow) =>
    subMutation.mutate({
      userId: u.id,
      planName: u.planName ?? undefined,
      planTitle: u.plan ?? undefined,
      maxProfiles: u.maxProfiles ?? undefined,
      days: 30,
    })
  const openBan = (u: AdminUserRow) => {
    setBanUser(u)
    setBanOpen(true)
  }
  const unban = (u: AdminUserRow) =>
    banMutation.mutate({ userId: u.id, banned: false })

  const dialogs = (
    <>
      <SubscriptionDialog
        open={subOpen}
        onOpenChange={setSubOpen}
        user={subUser}
        onSubmit={(input) => subMutation.mutate(input)}
        isSaving={subMutation.isPending}
      />
      <BanDialog
        open={banOpen}
        onOpenChange={setBanOpen}
        user={banUser}
        onSubmit={(opts) =>
          banUser &&
          banMutation.mutate({ userId: banUser.id, banned: true, opts })
        }
        isSaving={banMutation.isPending}
      />
    </>
  )

  return {
    editSubscription,
    renew,
    openBan,
    unban,
    banPending: banMutation.isPending,
    subPending: subMutation.isPending,
    dialogs,
  }
}

export type UserActions = ReturnType<typeof useUserActions>

/** Barra de ações rápidas de um usuário (reusa `useUserActions`). */
export function UserActionsBar({
  user,
  banned,
  actions,
  onViewProfile,
}: {
  user: AdminUserRow
  banned: boolean
  actions: UserActions
  onViewProfile?: () => void
}) {
  return (
    <div className='flex flex-wrap items-center gap-1'>
      {onViewProfile && (
        <QuickAction
          label='Ver perfil'
          color='bg-violet-600'
          onClick={onViewProfile}
        >
          <Eye className='size-4' />
        </QuickAction>
      )}
      <QuickAction
        label='Editar assinatura'
        color='bg-blue-600'
        onClick={() => actions.editSubscription(user)}
      >
        <Pencil className='size-4' />
      </QuickAction>
      <QuickAction
        label='Renovar +30 dias'
        color='bg-emerald-600'
        disabled={actions.subPending}
        onClick={() => actions.renew(user)}
      >
        <RefreshCw className='size-4' />
      </QuickAction>
      {waUrl(user.phone) && (
        <QuickAction
          label='WhatsApp'
          color='bg-green-600'
          onClick={() => window.open(waUrl(user.phone)!, '_blank')}
        >
          <MessageCircle className='size-4' />
        </QuickAction>
      )}
      <QuickAction
        label='Copiar ID'
        color='bg-slate-600'
        onClick={() => copyId(user.id)}
      >
        <Copy className='size-4' />
      </QuickAction>
      {banned ? (
        <QuickAction
          label='Desbanir'
          color='bg-emerald-600'
          disabled={actions.banPending}
          onClick={() => actions.unban(user)}
        >
          <CheckCircle2 className='size-4' />
        </QuickAction>
      ) : (
        <QuickAction
          label='Banir'
          color='bg-red-600'
          disabled={actions.banPending}
          onClick={() => actions.openBan(user)}
        >
          <Ban className='size-4' />
        </QuickAction>
      )}
    </div>
  )
}
