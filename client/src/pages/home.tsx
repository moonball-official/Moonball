import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
} from "lucide-react";
import { MoonLogo } from "@/components/MoonLogo";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { useLivePowerball } from "@/hooks/use-moonball";
import { usePageView, useTrackEvent } from "@/hooks/use-analytics";
import { apiRequest, queryClient } from "@/lib/queryClient";
import "./home.css";

const questions = [
  {
    question: "What exactly is MOON?",
    answer:
      "MOON is a digital token designed to trade on a decentralized exchange. Moonball uses public Powerball jackpot data to calculate a reference value for it. That reference is information for traders, not a price promise or a claim on lottery winnings.",
  },
  {
    question: "Does the jackpot determine the token price?",
    answer:
      "No. Buyers and sellers determine MOON’s market price. It can be above or below the published reference value, and there is no guaranteed return or protocol buy-back.",
  },
  {
    question: "What happens when someone wins Powerball?",
    answer:
      "The jackpot resets and Moonball’s reference value drops with it. MOON continues to exist, but its market price may fall sharply as traders respond. The token does not pay you a share of the jackpot.",
  },
  {
    question: "Can I buy MOON yet?",
    answer:
      "MOON is currently pre-launch. Join the waitlist for launch updates. You do not need a wallet to join, and joining does not purchase tokens.",
  },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const { data, isLoading, isError } = useLivePowerball();
  const track = useTrackEvent();
  usePageView("/");
  useEffect(() => {
    document.title = "Moonball — Follow the jackpot. Understand the market.";
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const signup = useMutation({
    mutationFn: async (value: string) =>
      (await apiRequest("POST", "/api/waitlist", { email: value })).json(),
    onSuccess: (result: { message: string; count: number }) => {
      setMessage(
        result.message ||
          "You’re on the list. Watch your inbox for Moonball updates.",
      );
      setEmail("");
      track("waitlist_signup", { count: result.count });
      queryClient.invalidateQueries({ queryKey: ["/api/waitlist/count"] });
    },
    onError: (error: Error) => {
      try {
        setMessage(
          JSON.parse(error.message.replace(/^\d+:\s*/, "")).message ||
            "We couldn’t add you. Please try again.",
        );
      } catch {
        setMessage("We couldn’t add you. Please try again.");
      }
    },
  });
  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim() && !signup.isPending) signup.mutate(email.trim());
  }
  const nextDraw = data?.nextDrawISO ? new Date(data.nextDrawISO) : null;
  const drawLabel =
    nextDraw && Number.isFinite(nextDraw.getTime())
      ? new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "America/New_York",
          timeZoneName: "short",
        }).format(nextDraw)
      : "Schedule unavailable";
  const hasJackpot =
    typeof data?.estimated === "number" && Number.isFinite(data.estimated);

  return (
    <div className="moon-site moon-home">
      <SiteHeader active="home" />

      <main id="main">
        <section
          className="moon-container moon-hero"
          aria-labelledby="hero-title"
        >
          <div className="moon-hero-copy">
            <span className="moon-eyebrow">
              <span className="moon-status-dot" /> A new perspective on the
              jackpot
            </span>
            <h1 id="hero-title">
              Big jackpots.
              <br />
              <span>
                A new kind
                <br className="moon-desktop-break" /> of market.
              </span>
            </h1>
            <p className="moon-lead">
              Meet MOON: a digital token with a reference value that follows the
              Powerball jackpot. The market decides its price.
            </p>
            <div className="moon-actions">
              <a className="moon-button" href="#waitlist">
                Join the waitlist <ArrowRight size={18} />
              </a>
              <a className="moon-text-link" href="#how-it-works">
                Get to know Moonball <ArrowDown />
              </a>
            </div>
            <p className="moon-hero-note">
              <span className="moon-status-dot" /> Pre-launch · Trading is not
              available yet
            </p>
          </div>
          <div className="moon-hero-visual">
            <div className="moon-orbit-art" aria-hidden="true">
              <div className="moon-orbit moon-orbit-outer" />
              <div className="moon-orbit moon-orbit-inner" />
              <span className="moon-orbit-point" />
              <MoonLogo size={144} animate={false} />
              <span className="moon-star moon-star-one">+</span>
              <span className="moon-star moon-star-two">+</span>
            </div>
            <div className="moon-jackpot-panel" aria-live="polite">
              <div className="moon-jackpot-heading">
                <span>Powerball jackpot</span>
                <span className="moon-data-badge">
                  {isError
                    ? "Feed unavailable"
                    : data?.verificationStatus === "verified"
                      ? "Verified data"
                      : isLoading
                        ? "Loading"
                        : "Awaiting verification"}
                </span>
              </div>
              <div className="moon-jackpot-number" data-testid="home-jackpot">
                {hasJackpot
                  ? `$${data.estimated.toLocaleString("en-US")}`
                  : "—"}
                {hasJackpot && <span>million</span>}
              </div>
              <p className="moon-jackpot-caption">
                {hasJackpot
                  ? "Estimated annuitized jackpot · Not MOON’s price"
                  : "Live jackpot information will appear when available."}
              </p>
              <div className="moon-draw-row">
                <div>
                  <span>Next drawing</span>
                  <strong>{drawLabel}</strong>
                </div>
                <a href="/dashboard" aria-label="Explore jackpot dashboard">
                  <ArrowUpRight size={24} />
                </a>
              </div>
              <a href="/dashboard" className="moon-panel-link">
                Explore the dashboard <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </section>
        <div className="moon-container moon-intro-strip">
          <span>Public jackpot data.</span>
          <span>Transparent reference value.</span>
          <span>Market-driven price.</span>
        </div>

        <section
          id="how-it-works"
          className="moon-container moon-section"
          aria-labelledby="how-title"
        >
          <div className="moon-section-heading">
            <div>
              <span className="moon-eyebrow">The idea, in three steps</span>
              <h2 id="how-title">Follow the cycle.</h2>
            </div>
            <p>
              A familiar jackpot. A different way to follow it.
              <br />
              Here’s how the pieces fit together.
            </p>
          </div>
          <div className="moon-steps">
            <article>
              <span className="moon-step-number">
                01 <span>↗</span>
              </span>
              <h3>The jackpot grows.</h3>
              <p>
                When a drawing has no jackpot winner, the Powerball jackpot
                rolls into the next draw.
              </p>
            </article>
            <article>
              <span className="moon-step-number">
                02 <span>≈</span>
              </span>
              <h3>The reference updates.</h3>
              <p>
                Moonball checks public sources and calculates a reference value
                from the jackpot. Think of it as a point of comparison.
              </p>
            </article>
            <article>
              <span className="moon-step-number">
                03 <span>⇄</span>
              </span>
              <h3>The market makes the call.</h3>
              <p>
                Once trading launches, buyers and sellers set MOON’s price. It
                can move above or below the reference.
              </p>
            </article>
          </div>
        </section>

        <section
          className="moon-container moon-risk-section"
          aria-labelledby="risk-title"
        >
          <div>
            <span className="moon-eyebrow">Before you take part</span>
            <h2 id="risk-title">
              Know what
              <br /> you’re following.
            </h2>
            <a className="moon-text-link" href="/technical-paper">
              Read the full details <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="moon-risk-list">
            <p>
              <strong>A reference, not a guarantee.</strong> MOON does not give
              you lottery tickets, a share of winnings, or a guaranteed price.
            </p>
            <p>
              <strong>A reset can change everything.</strong> When someone wins,
              the jackpot and reference reset. The market price may fall
              sharply.
            </p>
            <p>
              <strong>Real market risk.</strong> There is no protocol
              redemption. Selling depends on other traders and available
              liquidity. Smart-contract bugs can also cause losses.
            </p>
          </div>
        </section>

        <section
          className="moon-container moon-section moon-about"
          aria-labelledby="about-title"
        >
          <div>
            <span className="moon-eyebrow">Built by Moonball Labs</span>
            <h2 id="about-title">
              One founder.
              <br /> An open approach.
            </h2>
          </div>
          <div>
            <p>
              Edgar Ramirez founded Moonball as an independent project. It is
              built around public jackpot data and a transparent reference
              model that anyone can examine.
            </p>
            <p className="moon-muted">
              Currently pre-launch. Explore the technical paper for the model,
              token allocation, treasury policy, and risks.
            </p>
            <div className="moon-inline-links">
              <a className="moon-text-link" href="/technical-paper">
                Explore the technical paper <ArrowUpRight size={16} />
              </a>
              <a
                className="moon-text-link"
                href="https://x.com/moonballlabs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Follow on X <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </section>

        <section
          className="moon-container moon-section moon-faq"
          aria-labelledby="faq-title"
        >
          <div>
            <span className="moon-eyebrow">A little more clarity</span>
            <h2 id="faq-title">Good questions.</h2>
            <p>
              Start here. Go deeper in the <a href="/technical-paper">docs</a>.
            </p>
          </div>
          <div className="moon-faq-list">
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={20} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          id="waitlist"
          className="moon-container moon-waitlist"
          aria-labelledby="waitlist-title"
        >
          <div>
            <span className="moon-eyebrow">Stay in the loop</span>
            <h2 id="waitlist-title">
              Be here for
              <br />
              the next chapter.
            </h2>
            <p>Get Moonball launch updates in your inbox.</p>
          </div>
          <div>
            <form onSubmit={join} className="moon-signup">
              <label htmlFor="waitlist-email">Your email address</label>
              <div className="moon-signup-row">
                <input
                  id="waitlist-email"
                  data-testid="input-waitlist-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="you@example.com"
                  value={email}
                  disabled={signup.isPending}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setMessage("");
                  }}
                  aria-describedby="waitlist-note waitlist-status"
                />
                <button
                  className="moon-button"
                  data-testid="button-waitlist-join"
                  disabled={signup.isPending}
                  type="submit"
                >
                  {signup.isPending ? "Joining…" : "Join waitlist"}
                  <ArrowRight size={17} />
                </button>
              </div>
              <p id="waitlist-note" className="moon-signup-note">
                No wallet needed. Joining does not purchase tokens.
              </p>
              <p
                id="waitlist-status"
                role="status"
                className={
                  signup.isError
                    ? "moon-form-message is-error"
                    : "moon-form-message"
                }
              >
                {message && !signup.isError && <Check size={16} />}
                {message}
              </p>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function ArrowDown() {
  return <span aria-hidden="true">↓</span>;
}
