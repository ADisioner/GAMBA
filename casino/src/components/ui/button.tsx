import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-gold-dark via-gold to-gold-light text-primary-foreground hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] hover:scale-[1.02]",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border-2 border-gold/40 bg-transparent text-gold hover:border-gold hover:bg-gold/10 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]",
        secondary: "bg-marble-light text-foreground border border-border hover:bg-marble-light/80",
        ghost: "hover:bg-gold/10 hover:text-gold",
        link: "text-gold underline-offset-4 hover:underline",
        neon: "bg-transparent border-2 border-neon-green text-neon-green hover:bg-neon-green/10 hover:shadow-[0_0_20px_rgba(0,255,100,0.3)]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
