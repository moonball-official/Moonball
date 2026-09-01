export function MoonLogo({ size = 34, animate = true, opacity = 1 }) {
  return (
    <img
      src="/moon-logo.png"
      alt="Moonball"
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        opacity,
        animation: animate ? "logo-glow 4s ease-in-out infinite" : "none",
        flexShrink: 0,
      }}
    />
  );
}
