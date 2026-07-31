import baymaxLogo from '@/assets/baymax-logo.svg'
import { cn } from '@/lib/utils'

export function BaymaxLogo({ size = 'md', className }) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-14 w-14',
  }

  return (
    <img
      src={baymaxLogo}
      alt="Baymax"
      className={cn('flex-shrink-0', sizes[size] ?? sizes.md, className)}
    />
  )
}
