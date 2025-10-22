"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3 [&>svg+div]:translate-y-[-2px]",
  {
    variants: {
      variant: {
        default: "border-border text-foreground [&>svg]:text-foreground",
        destructive: "border-destructive/50 text-destructive shadow-sm [&>svg]:text-destructive"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

const ICON_BY_VARIANT = {
  default: Info,
  destructive: AlertTriangle
} as const;

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => {
  const Icon = ICON_BY_VARIANT[(variant ?? "default") as keyof typeof ICON_BY_VARIANT] ?? InfoIcon;

  return (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <div className="pl-6">{props.children}</div>
    </div>
  );
});
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  )
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
