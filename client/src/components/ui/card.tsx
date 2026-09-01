import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  glowColor?: "gold" | "blue";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow, glowColor = "gold", style, ...props }, ref) => {
    const glowStyle = glow 
      ? { animation: glowColor === "blue" ? "pulse-glow-blue 3s infinite" : "pulse-glow 3s infinite" } 
      : {};

    return (
      <div
        ref={ref}
        style={{ ...style, ...glowStyle }}
        className={cn(
          "rounded-xl border bg-[hsl(var(--bg-card))] text-card-foreground shadow-sm backdrop-blur-md transition-all duration-300",
          "border-[rgba(245,166,35,0.1)]", // Default gold border subtle
          glowColor === "blue" && "border-[rgba(59,130,246,0.12)]",
          className
        )}
        {...props}
      />
    );
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
