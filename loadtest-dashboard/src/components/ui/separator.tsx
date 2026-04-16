import * as React from 'react'

import { cn } from '@/lib/utils'

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical'
}

function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  if (orientation === 'horizontal') {
    return <hr className={cn('shrink-0 border-0 bg-border h-px w-full', className)} {...props} />
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-border h-full w-px',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
