import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

interface AvatarProps {
  src?: string
  firstName?: string
  lastName?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export default function Avatar({ src, firstName = '', lastName = '', size = 'md', className }: AvatarProps) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  }

  const initials = getInitials(firstName, lastName)

  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        className={cn('rounded-full object-cover', sizes[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium',
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  )
}
