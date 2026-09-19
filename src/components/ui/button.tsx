import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        neon: "rounded-full bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98]",
        outline: "rounded-full border border-border bg-transparent text-foreground hover:border-primary hover:text-primary",
        ghost: "rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground",
      },
      size: {
        default: "h-12 px-6 text-sm",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-7 text-sm",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "neon", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };