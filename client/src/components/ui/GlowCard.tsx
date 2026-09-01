import { Card as ShadcnCard } from "@/components/ui/card";
import { T } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface GlowCardProps extends React.ComponentProps<typeof ShadcnCard> {
  glow?: boolean;
  glowColor?: "gold" | "blue";
}

export function Card({ className, style, glow, glowColor = "gold", ...props }: GlowCardProps) {
  const glowStyle = glow
    ? {
        animation: glowColor === "gold" ? "pulse-glow 4s infinite" : "pulse-glow-blue 4s infinite",
        border: `1px solid ${glowColor === "gold" ? T.gold : T.blue}55`,
      }
    : {
        border: `1px solid ${T.border}`,
      };

  return (
    <div
      className={cn("rounded-xl p-4 backdrop-blur-md relative overflow-hidden", className)}
      style={{
        background: T.bgCard,
        ...glowStyle,
        ...style,
      }}
      {...props}
    />
  );
}
