import { useEffect, useRef, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { MoonLogo } from "@/components/MoonLogo";
import "@/pages/home.css";

type Page = "home" | "dashboard" | "protocol" | "docs";

export function SiteHeader({ active }: { active: Page }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <>
      <a className="moon-skip" href="#main">Skip to content</a>
      <header className="moon-header">
        <div className="moon-container moon-header-inner">
          <a href="/" className="moon-brand" aria-label="Moonball home">
            <MoonLogo size={38} animate={false} />
            <span>moonball<span className="moon-brand-dot">.</span></span>
          </a>
          <button
            ref={menuButton}
            className="moon-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
          <nav
            id="main-navigation"
            aria-label="Main navigation"
            className={menuOpen ? "moon-nav is-open" : "moon-nav"}
            onClick={() => setMenuOpen(false)}
          >
            <a href={active === "home" ? "#how-it-works" : "/#how-it-works"}>How it works</a>
            <a href="/dashboard" aria-current={active === "dashboard" ? "page" : undefined}>Dashboard</a>
            <a href="/protocol" aria-current={active === "protocol" ? "page" : undefined}>Protocol</a>
            <a href="/technical-paper" aria-current={active === "docs" ? "page" : undefined}>Docs</a>
            <a href={active === "home" ? "#waitlist" : "/#waitlist"} className="moon-button moon-button-small">
              Join the waitlist <ArrowRight size={16} />
            </a>
          </nav>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="moon-container moon-footer">
      <div className="moon-footer-top">
        <a className="moon-brand" href="/">
          <MoonLogo size={30} animate={false} />
          <span>moonball.</span>
        </a>
        <nav aria-label="Footer navigation">
          <a href="/dashboard">Dashboard</a>
          <a href="/protocol">Protocol</a>
          <a href="/technical-paper">Technical paper</a>
          <a href="mailto:edgar@moonball.info">Contact</a>
        </nav>
      </div>
      <div className="moon-footer-bottom">
        <span>© {new Date().getFullYear()} Moonball Labs</span>
        <p>MOON is a speculative digital asset. No guaranteed returns or redemption. Only commit what you can afford to lose.</p>
      </div>
    </footer>
  );
}
