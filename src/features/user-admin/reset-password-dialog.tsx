import { useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userName: string
  onSubmit: (password: string) => void
  isSaving: boolean
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userName,
  onSubmit,
  isSaving,
}: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword('')
      setConfirm('')
      setShow(false)
    }
  }, [open])

  const tooShort = password.length > 0 && password.length < 8
  const mismatch = confirm.length > 0 && password !== confirm
  const canSave = password.length >= 8 && password === confirm

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            Define uma nova senha de login para <b>{userName}</b>. Depois é só
            informar a senha ao usuário.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label>Nova senha</Label>
            <div className='relative'>
              <Input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='Mín. 8 caracteres'
                autoComplete='new-password'
              />
              <button
                type='button'
                onClick={() => setShow((s) => !s)}
                className='absolute end-2 top-2.5 text-muted-foreground hover:text-foreground'
                title={show ? 'Ocultar' : 'Mostrar'}
              >
                {show ? (
                  <EyeOff className='size-4' />
                ) : (
                  <Eye className='size-4' />
                )}
              </button>
            </div>
            {tooShort && (
              <p className='text-xs text-destructive'>
                A senha precisa ter ao menos 8 caracteres.
              </p>
            )}
          </div>

          <div className='grid gap-2'>
            <Label>Confirmar senha</Label>
            <Input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete='new-password'
            />
            {mismatch && (
              <p className='text-xs text-destructive'>
                As senhas não conferem.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={() => onSubmit(password)} disabled={isSaving || !canSave}>
            {isSaving && <Loader2 className='animate-spin' />}
            Salvar senha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
