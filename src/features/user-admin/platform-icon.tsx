import {
  Globe,
  Laptop,
  Monitor,
  MonitorSmartphone,
  Smartphone,
  Tv,
  type LucideIcon,
} from 'lucide-react'

// Mapa código-da-plataforma → ícone lucide (o app reporta o código no boot).
const PLATFORM_ICONS: Record<string, LucideIcon> = {
  tizen: Tv,
  androidtv: Tv,
  android: Smartphone,
  ios: Smartphone,
  windows: Monitor,
  macos: Laptop,
  linux: Monitor,
  web: Globe,
}

/** Ícone da plataforma reportada pelo app. `null` se nada reportado. */
export function PlatformIcon({
  code,
  className,
}: {
  code: string | null | undefined
  className?: string
}) {
  if (!code) return null
  const Icon = PLATFORM_ICONS[code] ?? MonitorSmartphone
  return <Icon className={className} />
}
