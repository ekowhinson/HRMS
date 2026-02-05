import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn('px-6 py-4 border-b border-gray-200', className)}>{children}</div>
}

export function CardTitle({ children, className }: CardProps) {
  return <h3 className={cn('text-lg font-semibold text-gray-900', className)}>{children}</h3>
}

export function CardDescription({ children, className }: CardProps) {
  return <p className={cn('text-sm text-gray-500 mt-1', className)}>{children}</p>
}

export function CardContent({ children, className }: CardProps) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>
}

export function CardFooter({ children, className }: CardProps) {
  return (
    <div className={cn('px-6 py-4 bg-gray-50 border-t border-gray-200', className)}>{children}</div>
  )
}
