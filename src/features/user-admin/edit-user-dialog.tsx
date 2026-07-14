import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { type UpdateUserInput, type UserDetail } from '@/lib/admin-api'
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
  user: UserDetail['user'] | null
  onSubmit: (fields: UpdateUserInput) => void
  isSaving: boolean
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isSaving,
}: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  useEffect(() => {
    if (open && user) {
      setName(user.name ?? '')
      setEmail(user.email ?? '')
      setFullName(user.fullName ?? '')
      setPhone(user.phone ?? '')
      setCpf(user.cpf ?? '')
      setBirthDate(user.birthDate ?? '')
      setAvatarUrl(user.avatarUrl ?? '')
    }
  }, [open, user])

  function handleSave() {
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      fullName: fullName.trim(),
      phone: phone.trim(),
      cpf: cpf.trim(),
      birthDate: birthDate.trim(),
      avatarUrl: avatarUrl.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Editar dados</DialogTitle>
          <DialogDescription>
            Perfil e conta de login. Deixe em branco pra remover (exceto
            nome/e-mail da conta).
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 sm:grid-cols-2'>
          <Field label='Nome (conta)'>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label='E-mail (login)'>
            <Input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label='Nome completo (perfil)'>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field label='Telefone'>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label='CPF'>
            <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
          </Field>
          <Field label='Nascimento'>
            <Input
              value={birthDate}
              placeholder='dd/mm/aaaa'
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>
          <div className='sm:col-span-2'>
            <Field label='Avatar (URL)'>
              <Input
                value={avatarUrl}
                placeholder='https://…'
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </Field>
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
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className='animate-spin' />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      {children}
    </div>
  )
}
