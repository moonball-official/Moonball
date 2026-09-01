import {
  HOME_CONSENSUS_DESCRIPTION,
  MOON_MARKET_DESCRIPTION,
  PROTOCOL_PAGE_TITLE,
  PROTOCOL_INTRO_DESCRIPTION,
  PROTOCOL_TRADE_DESCRIPTION,
  PROTOCOL_ORACLE_DESCRIPTION,
  TECHNICAL_PAPER_PAGE_TITLE,
  TECHNICAL_PAPER_INTRO,
} from "@shared/page-descriptions";

const BASE_URL = "https://moonball.replit.app";
const DEFAULT_IMAGE = `${BASE_URL}/moon-logo.png`;

const STYLE = `
  background:#0B0E17;color:#E2E8F0;font-family:system-ui,sans-serif;
  max-width:660px;margin:0 auto;padding:24px 20px;line-height:1.6;
`;
const H1 = `color:#F5A623;font-size:1.5rem;margin:0 0 8px;`;
const H2 = `color:#F5A623;font-size:1rem;margin:24px 0 6px;text-transform:uppercase;letter-spacing:.05em;`;
const P = `color:#94A3B8;font-size:.9rem;margin:0 0 12px;`;
const DL = `display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;`;
const DT = `background:rgba(0,0,0,.4);border:1px solid #1E293B;border-radius:6px;padding:8px 10px;`;
const LABEL = `color:#64748B;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:2px;`;
const VAL = `color:#fff;font-size:1rem;font-weight:600;`;
const BADGE = (color: string) =>
  `display:inline-block;background:${color}20;color:${color};border:1px solid ${color}60;
   border-radius:4px;padding:2px 8px;font-size:.75rem;font-weight:700;margin-right:6px;`;
const NAV = `display:flex;gap:16px;padding:14px 0;border-bottom:1px solid #1E293B;margin-bottom:20px;flex-wrap:wrap;`;
const NAV_A = `color:#94A3B8;font-size:.85rem;text-decoration:none;padding:4px 10px;border:1px solid #1E293B;border-radius:6px;`;
const RISK = `background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.18);border-radius:8px;padding:10px 14px;margin-bottom:8px;`;
const RISK_H = `color:#F87171;font-size:.85rem;font-weight:700;margin:0 0 4px;`;
const CARD = `background:rgba(0,0,0,0.25);border:1px solid #1E293B;border-radius:8px;padding:12px 14px;margin-bottom:8px;`;

const INTERNAL_NAV = `
<nav style="${NAV}">
  <a href="/" style="${NAV_A}">🏠 Dashboard</a>
  <a href="/protocol" style="${NAV_A}">⛓️ Protocol</a>
  <a href="/technical-paper" style="${NAV_A}">📄 Technical Paper</a>
</nav>`;

interface RouteMeta {
  title: string;
  description: string;
  canonical?: string;
  noindex?: boolean;
  ogImage?: string;
  ogImageAlt?: string;
  ogType?: string;
  bodyHtml: string;
  structuredData?: object[];
}

const WEBSITE_GRAPH: object[] = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Moonball Protocol",
    "url": BASE_URL,
    "description":
      "Live Powerball jackpot dashboard with multi-cycle charts, countdown timers, winning numbers, and phase indicators. Built on a sci-fi oracle event-market for MOON tokens on Base.",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Moonball Labs",
    "url": BASE_URL,
    "logo": DEFAULT_IMAGE,
    "description":
      "Moonball Labs builds the Moonball Protocol — a free-floating ERC-20 event-market token on Base with a transparent, risk-adjusted oracle reference derived from the Powerball jackpot.",
    "email": "edgar@moonball.info",
    "foundingDate": "2025-04",
    "founder": [
      {
        "@type": "Person",
        "name": "Edgar Ramirez",
        "jobTitle": "Founder & CEO",
      },
      {
        "@type": "Person",
        "name": "Julio Valdes",
        "jobTitle": "Founding Frontend Engineer",
      },
    ],
    "sameAs": [],
  },
];

const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "Moonball Protocol | Track the Powerball Jackpot Live",
    description:
      "Live Powerball jackpot dashboard with multi-cycle charts, countdown timers, winning numbers, and phase indicators. Built on a sci-fi oracle event-market for MOON tokens on Base.",
    canonical: `${BASE_URL}/`,
    ogImage: `${BASE_URL}/social-card.png`,
    ogImageAlt: "Moonball Protocol — Live Powerball jackpot dashboard with oracle reference and MOON token on Base",
    structuredData: [
      ...WEBSITE_GRAPH,
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Is MOON pegged to the jackpot?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. The oracle publishes a reference value derived from public jackpot data, but the price floats freely on the DEX. The market can trade above or below the reference at any time.",
            },
          },
          {
            "@type": "Question",
            "name": "Is MOON backed by anything?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "MOON is not a redeemable claim on reserves. Its value comes from what traders will pay in the open market. The oracle reference is derived from public jackpot data — it is information, not a backing or buy-back promise.",
            },
          },
          {
            "@type": "Question",
            "name": "Can I redeem MOON with the protocol?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. There is no mint or redeem. You buy and sell MOON with other traders in the liquidity pool.",
            },
          },
          {
            "@type": "Question",
            "name": "What happens if a whale sells a large position?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Exits are DEX swaps, so a large sell moves the price down the pool's curve and pays slippage proportional to its size. No one can drain a treasury or jump a redemption queue — the pool simply reprices.",
            },
          },
          {
            "@type": "Question",
            "name": "What happens when someone wins the jackpot?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "The jackpot resets to its base, the oracle reference drops accordingly, and a new cycle begins. The market reprices on its own.",
            },
          },
          {
            "@type": "Question",
            "name": "Does the treasury protect the price?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. The treasury funds liquidity, the oracle, and operations. It never buys back or defends a price level.",
            },
          },
        ],
      },
    ],
    bodyHtml: `
<div style="${STYLE}">
  <header style="border-bottom:1px solid #1E293B;padding-bottom:16px;margin-bottom:4px;">
    <h1 style="${H1}">Trade the Jackpot — Moonball Protocol</h1>
    <p style="${P}">
      Track live Powerball jackpot cycles and trade MOON, the Moonball Protocol
      event-market token on Base. The dashboard shows real-time jackpot data,
      multi-cycle charts, countdown timers, winning numbers, and the oracle
      reference value — the same numbers the on-chain oracle publishes after
      each draw.
    </p>
  </header>

  ${INTERNAL_NAV}

  <main>
    <p style="${P}">
      ${HOME_CONSENSUS_DESCRIPTION}
    </p>

    <div style="${DL}">
      <div style="${DT}">
        <span style="${LABEL}">Draw Schedule</span>
        <span style="${VAL}">Mon · Wed · Sat</span>
      </div>
      <div style="${DT}">
        <span style="${LABEL}">Draw Time</span>
        <span style="${VAL}">10:59 PM ET</span>
      </div>
      <div style="${DT}">
        <span style="${LABEL}">Starting Jackpot</span>
        <span style="${VAL}">$20M per cycle</span>
      </div>
      <div style="${DT}">
        <span style="${LABEL}">Data Sources</span>
        <span style="${VAL}">4 providers</span>
      </div>
    </div>

    <h2 style="${H2}">MOON Market</h2>
    <p style="${P}">
      ${MOON_MARKET_DESCRIPTION}
    </p>

    <h2 style="${H2}">Reference Value Explorer</h2>
    <p style="${P}">
      The reference value explorer lets you calculate the oracle reference value
      and risk-adjusted value for any jackpot level. Enter a hypothetical jackpot
      amount to see the corresponding oracle value, modelled reset probability,
      and risk-adjusted reference. All calculations use the same formula the
      on-chain oracle applies after each draw.
    </p>

    <h2 style="${H2}">Price History</h2>
    <p style="${P}">
      The price history chart shows the Powerball jackpot trajectory over time
      across multiple draw cycles. Each cycle is plotted separately so you can
      compare how the jackpot grew and when it reset. The chart is updated
      automatically after each draw.
    </p>

    <h2 style="${H2}">Next Drawing</h2>
    <p style="${P}">
      A live countdown timer shows the time remaining until the next scheduled
      Powerball draw (Mon, Wed, Sat at 10:59 PM ET). The timer resets after
      each draw and updates the jackpot data once a consensus value is confirmed
      from multiple sources.
    </p>

    <h2 style="${H2}">Latest Draw</h2>
    <p style="${P}">
      The latest draw section displays the most recent winning numbers, the
      Powerball number, and the jackpot outcome for the last draw. Winning
      numbers are sourced from the NY Open Data API and displayed alongside
      the current cycle status and phase indicator.
    </p>

    <h2 style="${H2}">Oracle Reference</h2>
    <p style="${P}">
      The oracle reference panel shows the live MOON token oracle value,
      reset probability, and risk-adjusted value for the current jackpot.
      A confidence grade (High / Medium / Low) indicates how many independent
      sources agreed on the current jackpot figure. The oracle reference is
      information for traders — not a price promise or a redemption rate.
    </p>

    <h2 style="${H2}">Jackpot Reset Cycle</h2>
    <p style="${P}">
      The jackpot reset cycle panel tracks the current active Powerball cycle:
      the number of draws since the last reset, the jackpot at cycle start,
      the current estimated jackpot, and the current cycle phase. Phases
      reflect how far the jackpot has grown and how elevated the reset
      probability is.
    </p>

    <h2 style="${H2}">Cycle History</h2>
    <p style="${P}">
      Moonball archives every completed jackpot cycle from recent Powerball
      history. The cycle history panel displays the peak jackpot, number of
      draws, final winning numbers, and whether a winner was drawn for each
      completed cycle. All cycles are plotted together on the multi-cycle
      SVG chart for trajectory comparison.
    </p>

    <h2 style="${H2}">How It Works</h2>
    <p style="${P}">
      Moonball's dashboard works in three layers: an off-chain data aggregation
      layer fetches jackpot data from multiple sources and reaches consensus;
      an oracle layer publishes the verified reference value and reset probability;
      and a market layer where MOON trades freely in a DEX pool. The dashboard
      presents all three layers in real time so anyone can track the jackpot
      cycle, understand the oracle reference, and follow MOON token activity
      on Base.
    </p>

    <h2 style="${H2}">Tokenomics</h2>
    <p style="${P}">
      MOON has a fixed total supply minted at genesis — no future inflation or protocol-controlled minting.
      The supply is split between a liquidity pool seed, team and advisor allocations subject to a vesting
      cliff and linear on-chain unlock, and a community and ecosystem reserve.
    </p>
    <div style="${DL}">
      <div style="${DT}">
        <span style="${LABEL}">Price</span>
        <span style="${VAL}">Free-float</span>
      </div>
      <div style="${DT}">
        <span style="${LABEL}">Standard</span>
        <span style="${VAL}">ERC-20</span>
      </div>
      <div style="${DT}">
        <span style="${LABEL}">Market</span>
        <span style="${VAL}">DEX pool</span>
      </div>
      <div style="${DT}">
        <span style="${LABEL}">Oracle</span>
        <span style="${VAL}">Multi-source</span>
      </div>
    </div>
    <p style="${P}">
      The pool launches at a 1% fee tier. A protocol skim of swap fees funds the treasury.
      50% of the skim is reinvested as protocol-owned liquidity to deepen the pool; 50% covers
      oracle, audits, infrastructure, and development.
    </p>

    <h2 style="${H2}">How MOON Trades</h2>
    <p style="${P}">
      You buy and sell MOON in an open MOON/USDC liquidity pool on a decentralized exchange on Base.
      The protocol does not mint to you, redeem from you, or guarantee any price — it only publishes
      the oracle reference and helps keep the pool liquid through protocol-owned liquidity.
    </p>
    <p style="${P}">
      The oracle publishes three reference numbers each draw cycle:
    </p>
    <ul style="color:#94A3B8;font-size:.9rem;padding-left:20px;margin:0 0 16px;">
      <li><strong style="color:#fff;">Oracle value</strong> — $10 × (jackpot$M / $20M), scales linearly with the jackpot.</li>
      <li><strong style="color:#fff;">Reset risk</strong> — modelled probability the next draw produces a winner.</li>
      <li><strong style="color:#fff;">Risk-adjusted value</strong> — oracle value discounted by reset probability.</li>
    </ul>

    <h2 style="${H2}">What the Treasury Does</h2>
    <p style="${P}">
      The treasury is visible on-chain. Its mandate is growth and operations — never price defense.
      Revenue comes from a protocol skim on swap fees.
    </p>
    <div style="${CARD}">
      <div style="color:#F5A623;font-size:.8rem;font-weight:700;margin-bottom:4px;">Seed and Deepen Liquidity</div>
      <div style="${P}">Protocol-owned liquidity for tighter spreads. Grows automatically with trading volume.</div>
    </div>
    <div style="${CARD}">
      <div style="color:#F5A623;font-size:.8rem;font-weight:700;margin-bottom:4px;">Fund the Oracle</div>
      <div style="${P}">Pays for multi-source jackpot verification published on-chain after every draw.</div>
    </div>
    <div style="${CARD}">
      <div style="color:#F5A623;font-size:.8rem;font-weight:700;margin-bottom:4px;">Cover Operations</div>
      <div style="${P}">Audits, infrastructure, and development. Funded by the protocol skim, not by selling tokens.</div>
    </div>
    <p style="${P}">Treasury reserves create no claim on the protocol and are not a redemption backstop.</p>

    <h2 style="${H2}">Know the Risks</h2>
    <div style="${RISK}">
      <div style="${RISK_H}">Reset risk</div>
      <p style="${P}">When a winner is drawn, the jackpot resets and the oracle reference drops sharply. The market price can fall just as fast.</p>
    </div>
    <div style="${RISK}">
      <div style="${RISK_H}">No redemption</div>
      <p style="${P}">There is no protocol buy-back or peg. The only way out of a position is to sell to another trader in the pool.</p>
    </div>
    <div style="${RISK}">
      <div style="${RISK_H}">Market and liquidity risk</div>
      <p style="${P}">Price is set by supply and demand. Thin liquidity means large trades can move the price and exits may be costly.</p>
    </div>
    <div style="${RISK}">
      <div style="${RISK_H}">Smart contract risk</div>
      <p style="${P}">Contracts can contain bugs. Audits reduce but never eliminate this risk. Only commit what you can afford to lose.</p>
    </div>

    <h2 style="${H2}">Frequently Asked Questions</h2>

    <div style="${CARD}">
      <div style="color:#fff;font-size:.9rem;font-weight:700;margin-bottom:4px;">Is MOON pegged to the jackpot?</div>
      <p style="${P}">No. The oracle publishes a reference value derived from public jackpot data, but the price floats freely on the DEX. The market can trade above or below the reference at any time.</p>
    </div>
    <div style="${CARD}">
      <div style="color:#fff;font-size:.9rem;font-weight:700;margin-bottom:4px;">Is MOON backed by anything?</div>
      <p style="${P}">MOON is not a redeemable claim on reserves. Its value comes from what traders will pay in the open market. The oracle reference is derived from public jackpot data — it is information, not a backing or buy-back promise.</p>
    </div>
    <div style="${CARD}">
      <div style="color:#fff;font-size:.9rem;font-weight:700;margin-bottom:4px;">Can I redeem MOON with the protocol?</div>
      <p style="${P}">No. There is no mint or redeem. You buy and sell MOON with other traders in the liquidity pool.</p>
    </div>
    <div style="${CARD}">
      <div style="color:#fff;font-size:.9rem;font-weight:700;margin-bottom:4px;">What happens if a whale sells a large position?</div>
      <p style="${P}">Exits are DEX swaps, so a large sell moves the price down the pool's curve and pays slippage proportional to its size. No one can drain a treasury or jump a redemption queue — the pool simply reprices.</p>
    </div>
    <div style="${CARD}">
      <div style="color:#fff;font-size:.9rem;font-weight:700;margin-bottom:4px;">What happens when someone wins the jackpot?</div>
      <p style="${P}">The jackpot resets to its base, the oracle reference drops accordingly, and a new cycle begins. The market reprices on its own.</p>
    </div>
    <div style="${CARD}">
      <div style="color:#fff;font-size:.9rem;font-weight:700;margin-bottom:4px;">Does the treasury protect the price?</div>
      <p style="${P}">No. The treasury funds liquidity, the oracle, and operations. It never buys back or defends a price level.</p>
    </div>

    <h2 style="${H2}">Roadmap</h2>
    <div style="${CARD}">
      <div style="color:#F5A623;font-size:.8rem;font-weight:700;letter-spacing:.05em;margin-bottom:4px;">Q2 2026 — IN PROGRESS</div>
      <div style="color:#fff;font-size:.9rem;font-weight:700;margin-bottom:4px;">Smart Contract &amp; Audit</div>
      <p style="${P}">Solidity contracts finalized, third-party audit complete, testnet deployment.</p>
    </div>
    <div style="${CARD}">
      <div style="color:#94A3B8;font-size:.8rem;font-weight:700;letter-spacing:.05em;margin-bottom:4px;">Q3 2026</div>
      <div style="color:#fff;font-size:.9rem;font-weight:700;margin-bottom:4px;">Powerball Launch</div>
      <p style="${P}">Mainnet launch, oracle reference live, DEX liquidity pool seeded.</p>
    </div>
    <div style="${CARD}">
      <div style="color:#94A3B8;font-size:.8rem;font-weight:700;letter-spacing:.05em;margin-bottom:4px;">Late 2026</div>
      <div style="color:#fff;font-size:.9rem;font-weight:700;margin-bottom:4px;">Multi-Jackpot Expansion</div>
      <p style="${P}">Mega Millions support, cross-chain bridging, institutional partnerships.</p>
    </div>
    <div style="${CARD}">
      <div style="color:#94A3B8;font-size:.8rem;font-weight:700;letter-spacing:.05em;margin-bottom:4px;">2027</div>
      <div style="color:#fff;font-size:.9rem;font-weight:700;margin-bottom:4px;">Staking &amp; Global Scaling</div>
      <p style="${P}">Yield protocol, DAO governance, international lottery expansion.</p>
    </div>

    <h2 style="${H2}">About Us</h2>
    <div style="${CARD}">
      <div style="color:#fff;font-size:1rem;font-weight:700;margin-bottom:2px;">Edgar Ramirez — Founder &amp; CEO</div>
      <p style="${P}">BBA in Finance with 6+ years in banking operations, compliance, and financial systems. Built Moonball from concept to MVP, designing its tokenomics, oracle reference model, and behavioral pricing framework. Focused on disciplined growth, regulatory clarity, and long-term protocol sustainability. Founded Moonball in April 2025 to pioneer behavioral-based digital assets.</p>
    </div>
    <div style="${CARD}">
      <div style="color:#fff;font-size:1rem;font-weight:700;margin-bottom:2px;">Julio Valdes — Founding Frontend Engineer</div>
      <p style="${P}">Full-stack engineer specializing in TypeScript, React, and Web3 integrations. Translates complex protocol mechanics into an intuitive user experience.</p>
    </div>

    <h2 style="${H2}">Join the Waitlist</h2>
    <p style="${P}">
      Moonball is currently in pre-launch. Join the waitlist to be notified when the protocol goes live,
      receive early access, and get updates on the audit and mainnet deployment schedule.
      Contact: <a href="mailto:edgar@moonball.info" style="color:#F5A623;">edgar@moonball.info</a>
    </p>

    <footer style="border-top:1px solid #1E293B;margin-top:24px;padding-top:16px;font-size:.75rem;color:#475569;text-align:center;">
      Moonball Protocol · Reference implementation · Requires professional auditing before mainnet deployment · Moonball Labs, 2026
    </footer>
  </main>
</div>`,
  },

  "/technical-paper": {
    title: "Technical Paper | Moonball Protocol",
    description:
      "Read the Moonball Protocol technical paper: tokenomics, oracle design, jackpot cycle mechanics, MOON token vesting schedule, and liquidity pool economics on Base.",
    canonical: `${BASE_URL}/technical-paper`,
    ogImage: `${BASE_URL}/social-card-technical-paper.png`,
    ogImageAlt: "Moonball Protocol Technical Paper — oracle design, tokenomics, pool calculator, and liquidity economics on Base",
    ogType: "article",
    structuredData: [
      ...WEBSITE_GRAPH,
      {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "Moonball Protocol — Technical Paper",
        "description":
          "Technical documentation covering the Moonball Protocol design: free-floating ERC-20 event-market token on Base, multi-source consensus oracle, jackpot cycle mechanics, tokenomics, liquidity economics, and treasury policy.",
        "url": `${BASE_URL}/technical-paper`,
        "datePublished": "2025-04-01",
        "dateModified": "2026-01-01",
        "inLanguage": "en-US",
        "author": {
          "@type": "Person",
          "name": "Edgar Ramirez",
          "jobTitle": "Founder & CEO",
          "worksFor": {
            "@type": "Organization",
            "name": "Moonball Labs",
          },
        },
        "publisher": {
          "@type": "Organization",
          "name": "Moonball Labs",
          "url": BASE_URL,
          "logo": {
            "@type": "ImageObject",
            "url": DEFAULT_IMAGE,
          },
        },
        "isPartOf": {
          "@type": "WebSite",
          "name": "Moonball Protocol",
          "url": BASE_URL,
        },
        "about": [
          { "@type": "Thing", "name": "ERC-20 token" },
          { "@type": "Thing", "name": "Powerball jackpot" },
          { "@type": "Thing", "name": "Oracle reference model" },
          { "@type": "Thing", "name": "Decentralized exchange" },
          { "@type": "Thing", "name": "Tokenomics" },
        ],
        "keywords":
          "MOON token, ERC-20, Powerball, oracle, Base blockchain, event market, tokenomics, DeFi, liquidity pool, jackpot cycle",
        "articleSection": [
          "Protocol Overview",
          "Oracle Reference Model",
          "Consensus & Confidence",
          "No Redemption",
          "Liquidity & LP Economics",
          "Treasury Policy",
          "Reset Mechanics",
          "Attack Surface & Security",
          "Legal Positioning",
          "Token Allocation",
          "Pool Size Calculator",
        ],
      },
    ],
    bodyHtml: `
<div style="${STYLE}">
  <header style="border-bottom:1px solid #1E293B;padding-bottom:16px;margin-bottom:4px;">
    <h1 style="${H1}">${TECHNICAL_PAPER_PAGE_TITLE}</h1>
    <p style="${P}">
      ${TECHNICAL_PAPER_INTRO}
    </p>
  </header>

  ${INTERNAL_NAV}

  <main>
    <section>
      <h2 style="${H2}">1. Protocol Overview</h2>
      <p style="${P}">
        MOON is an ERC-20 token that trades freely on a decentralized exchange.
        The protocol does <strong style="color:#fff;">not</strong> peg, mint-on-demand,
        or redeem the token. Instead, an on-chain oracle publishes a transparent
        <strong style="color:#fff;">reference value</strong> derived from public jackpot
        data, and the market decides where MOON actually trades relative to that
        reference. This makes MOON an event market on the Powerball cycle rather
        than a collateralized stable instrument.
      </p>
      <div style="${DL}">
        <div style="${DT}"><span style="${LABEL}">Price</span><span style="${VAL}">Free-float</span></div>
        <div style="${DT}"><span style="${LABEL}">Standard</span><span style="${VAL}">ERC-20</span></div>
        <div style="${DT}"><span style="${LABEL}">Market</span><span style="${VAL}">DEX pool</span></div>
        <div style="${DT}"><span style="${LABEL}">Oracle</span><span style="${VAL}">Multi-source</span></div>
      </div>
    </section>

    <section>
      <h2 style="${H2}">2. Oracle Reference Model</h2>
      <p style="${P}">
        The oracle publishes three numbers each cycle. None of them is a price
        the protocol will honor — they are context for traders.
      </p>
      <ul style="color:#94A3B8;font-size:.9rem;padding-left:20px;margin:0 0 12px;">
        <li><strong style="color:#fff;">Oracle value</strong> = $10 × (jackpot$M / $20M) — scales linearly with the jackpot from a $10 base at a fresh $20M reset.</li>
        <li><strong style="color:#fff;">Reset risk</strong> = 1 − e<sup>−(jackpot$M × 0.4) / 292.2</sup> — the modelled probability of a winner on the next draw, growing as the jackpot climbs.</li>
        <li><strong style="color:#fff;">Risk-adjusted value</strong> = oracle × (1 − p) — the oracle value discounted by the survival probability (1 − p).</li>
      </ul>
      <p style="${P}">
        The raw oracle value scales linearly with the jackpot from a $10 base at a fresh $20M reset.
        Reset risk p is the modelled probability that the next draw produces a winner, growing with
        ticket sales as the jackpot climbs. The risk-adjusted value discounts the raw value by the
        survival probability (1 − p) — a more conservative reference as a draw approaches.
      </p>
    </section>

    <section>
      <h2 style="${H2}">3. Consensus &amp; Confidence</h2>
      <p style="${P}">
        The jackpot figure is sourced from multiple independent providers in
        parallel: powerball.com, usamega.com, calottery.com, and
        texaslottery.com. A value is only published once at least two sources
        agree within a $5 million tolerance.
      </p>
      <p style="${P}">
        <span style="${BADGE("#34D399")}">High</span> ≥ 3 sources agree — published immediately.<br/>
        <span style="${BADGE("#FBBF24")}">Medium</span> exactly 2 sources agree — published with medium confidence.<br/>
        <span style="${BADGE("#EF4444")}">Low</span> fewer than 2 sources — value held, not published.
      </p>
      <p style="${P}">
        Post-draw (Mon/Wed/Sat after 10:59 PM ET), polling automatically
        tightens to 60-second intervals until consensus is confirmed, ensuring
        fresh jackpot resets are captured quickly.
      </p>
    </section>

    <section>
      <h2 style="${H2}">4. No Redemption, No Liability</h2>
      <p style="${P}">
        There is no mint or redeem function exposed to users and no promise to
        buy MOON back at any price. The protocol holds no liability against the
        circulating supply, so it cannot become undercollateralized and there is
        no health ratio or redemption haircut to manage. The only way in or out
        of a position is to trade with other participants in the liquidity pool.
      </p>
    </section>

    <section>
      <h2 style="${H2}">5. Liquidity &amp; LP Economics</h2>
      <p style="${P}">
        MOON trades against USDC in a constant-product DEX pool on Base.
        Liquidity providers earn swap fees and bear standard impermanent-loss
        exposure. Because the jackpot cycle is mean-reverting — the reference
        climbs through a cycle then snaps back at reset — LPs face elevated
        impermanent loss around reset events. The pool launches at a 1% fee tier
        to compensate LPs for this asymmetric risk.
      </p>
      <p style="${P}">
        Protocol skim: a portion of each swap fee is routed to the treasury at the router layer —
        separate from and in addition to the LP's share. LPs receive the majority of every swap fee.
        The skim is not deducted from LP earnings; it is charged on top at the routing layer.
      </p>
      <p style="${P}">
        Protocol-owned liquidity deepens the pool to tighten spreads but is never withdrawn to defend a price.
      </p>
    </section>

    <section>
      <h2 style="${H2}">6. Treasury Policy</h2>
      <p style="${P}">
        The treasury is fully visible on-chain. Its mandate is growth and operations — never price defense.
        Revenue comes from the protocol skim on swap fees.
      </p>
      <p style="${P}">
        The treasury split is: 50% protocol-owned liquidity reinvestment (deepens the pool, never withdrawn
        to defend price) and 50% operations (oracle, audits, infrastructure, and development).
      </p>
      <ul style="color:#94A3B8;font-size:.9rem;padding-left:20px;margin:0 0 12px;">
        <li><strong style="color:#fff;">Seed and deepen liquidity</strong> — protocol-owned liquidity for tighter spreads, funded by the 50% POL split, grows automatically with trading volume.</li>
        <li><strong style="color:#fff;">Fund the oracle</strong> — pays for multi-source jackpot verification published on-chain, funded by the 50% operations split.</li>
        <li><strong style="color:#fff;">Cover operations</strong> — audits, infrastructure, and development, funded by the protocol skim, not by selling tokens.</li>
      </ul>
      <p style="${P}">Treasury reserves create no claim on the protocol and are not a redemption backstop.</p>
    </section>

    <section>
      <h2 style="${H2}">7. Reset Mechanics &amp; Whale Exit</h2>
      <p style="${P}">
        A reset is detected when the oracle reports a jackpot that drops sharply (below 50% of the last
        known value), indicating a winner. The reference value falls back to its base and a new cycle begins.
        The market reprices on its own — there is no cooldown gating trades, because there is nothing for
        the protocol to pause.
      </p>
      <p style="${P}">
        <strong style="color:#fff;">Whale exit:</strong> because exits are AMM swaps, a large holder selling moves the price down the curve
        and pays slippage proportional to their size relative to pool depth. No single participant can drain
        a treasury or jump a redemption queue; the pool simply reprices. This is the core safety property
        of removing redemption.
      </p>
    </section>

    <section>
      <h2 style="${H2}">8. Attack Surface &amp; Security</h2>
      <ul style="color:#94A3B8;font-size:.9rem;padding-left:20px;margin:0 0 12px;">
        <li><strong style="color:#fff;">Oracle manipulation</strong> — mitigated by multi-source consensus and sanity bounds; a single bad source cannot publish.</li>
        <li><strong style="color:#fff;">Reference vs. market confusion</strong> — the UI never presents the oracle as a tradable price.</li>
        <li><strong style="color:#fff;">AMM / liquidity risk</strong> — thin pools allow price impact; protocol-owned liquidity reduces but cannot eliminate it.</li>
        <li><strong style="color:#fff;">Standard smart-contract risk</strong> — professional audit and timelocked, multi-sig admin required before mainnet.</li>
      </ul>
    </section>

    <section>
      <h2 style="${H2}">9. Legal Positioning</h2>
      <p style="${P}">
        MOON is a free-floating digital asset, not a lottery ticket, deposit, or redeemable instrument.
        The oracle reports public information only; the protocol makes no promise of value, return, or
        buy-back. Nothing here is financial advice. Participants should only commit funds they can afford to lose.
      </p>
    </section>

    <section>
      <h2 style="${H2}">10. Token Allocation</h2>
      <p style="${P}">
        MOON has a fixed total supply minted at genesis — no future inflation. The distribution
        is split between a liquidity pool seed (immediately deployed as DEX liquidity), team and
        advisor allocations (subject to a cliff and linear on-chain vesting unlock), and a
        community and ecosystem reserve. All vesting is enforced on-chain and verifiable on the
        Base block explorer.
      </p>
      <div style="${DL}">
        <div style="${DT}">
          <span style="${LABEL}">Supply</span>
          <span style="${VAL}">Fixed at genesis</span>
        </div>
        <div style="${DT}">
          <span style="${LABEL}">Inflation</span>
          <span style="${VAL}">None</span>
        </div>
        <div style="${DT}">
          <span style="${LABEL}">Pool fee</span>
          <span style="${VAL}">1% (launch)</span>
        </div>
        <div style="${DT}">
          <span style="${LABEL}">Vesting</span>
          <span style="${VAL}">On-chain enforced</span>
        </div>
      </div>
      <p style="${P}">On-chain vesting: team and advisor allocations are locked in a MoonVestingWallet contract enforcing a cliff and linear unlock schedule. Anyone can verify the locked balance on-chain via the Base block explorer.</p>
      <p style="${P}" style="font-weight:700;color:#94A3B8;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;">Fee Flow</p>
      <p style="${P}">
        Swap fee → LP share (majority) + protocol skim (minority) → treasury → 50% POL
        reinvestment / 50% operations. The LP share compensates liquidity providers for impermanent
        loss exposure. The protocol skim funds the oracle, audits, infrastructure, and POL growth.
      </p>
      <p style="${P}" style="font-weight:700;color:#94A3B8;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;">Fee Glide Path</p>
      <p style="${P}">
        The pool launches at a 1% fee tier to compensate LPs for elevated reset-event impermanent
        loss. As pool depth grows, governance can step the fee tier down: deeper pool → lower fee →
        more volume → more protocol-owned liquidity. Each tier step is triggered by TVL milestones.
      </p>
    </section>

    <section>
      <h2 style="${H2}">11. Pool Size Calculator</h2>
      <p style="${P}">
        The pool size calculator helps estimate how much liquidity should be seeded in the
        MOON/USDC pool at launch. Given an expected daily trading volume and a target maximum
        price impact per trade, it calculates the required USDC seed, the corresponding MOON
        seed at the oracle's risk-adjusted launch price, and the total pool TVL needed to keep
        price impact within bounds.
      </p>
      <p style="${P}">
        The launch price anchor is the oracle's risk-adjusted value for the current jackpot,
        which sets the initial MOON/USDC seed ratio. All calculations are shown live on the
        Technical Paper page using the current oracle reference.
      </p>
    </section>

    <footer style="border-top:1px solid #1E293B;margin-top:24px;padding-top:16px;font-size:.75rem;color:#475569;text-align:center;">
      Reference implementation — requires professional auditing before mainnet deployment. Moonball Labs, 2026.
    </footer>
  </main>
</div>`,
  },

  "/protocol": {
    title: "Protocol | Moonball Protocol — MOON Token on Base",
    description:
      "Overview of the Moonball Protocol smart contracts on Base: oracle reference model, MOON token design, contract status, and upcoming mainnet launch. Pre-launch — contracts in audit.",
    canonical: `${BASE_URL}/protocol`,
    ogImage: `${BASE_URL}/social-card-protocol.png`,
    ogImageAlt: "Moonball Protocol — on-chain oracle reference and MOON token on Base, currently in pre-launch",
    structuredData: [...WEBSITE_GRAPH],
    bodyHtml: `
<div style="${STYLE}">
  <header style="border-bottom:1px solid #1E293B;padding-bottom:16px;margin-bottom:4px;">
    <h1 style="${H1}">${PROTOCOL_PAGE_TITLE}</h1>
    <p style="${P}">${PROTOCOL_INTRO_DESCRIPTION}</p>
  </header>

  ${INTERNAL_NAV}

  <main>
    <section>
      <h2 style="${H2}">Trade MOON</h2>
      <p style="${P}">
        <span style="${BADGE("#FBBF24")}">Pre-Launch</span>
        MOON is a free-floating ERC-20 token on Base. The MOON/USDC liquidity pool
        is not yet live — trading will open at mainnet launch, targeted Q3 2026.
        Connect a Web3 wallet (MetaMask, Coinbase Wallet) to trade once the pool is live.
      </p>
      <div style="${DL}">
        <div style="${DT}"><span style="${LABEL}">Market price</span><span style="${VAL}">Pre-launch</span></div>
        <div style="${DT}"><span style="${LABEL}">Premium / discount</span><span style="${VAL}">Awaiting liquidity</span></div>
        <div style="${DT}"><span style="${LABEL}">Liquidity depth</span><span style="${VAL}">Awaiting liquidity</span></div>
        <div style="${DT}"><span style="${LABEL}">Pair</span><span style="${VAL}">MOON / USDC</span></div>
      </div>
      <p style="${P}">
        ${PROTOCOL_TRADE_DESCRIPTION}
      </p>
    </section>

    <section>
      <h2 style="${H2}">Oracle Reference</h2>
      <p style="${P}">
        ${PROTOCOL_ORACLE_DESCRIPTION}
      </p>
      <ul style="color:#94A3B8;font-size:.9rem;padding-left:20px;margin:0 0 12px;">
        <li><strong style="color:#fff;">Oracle value</strong> — $10 × (jackpot$M / $20M), scales linearly with the jackpot from a $10 base at a $20M reset.</li>
        <li><strong style="color:#fff;">Reset risk</strong> — modelled probability the next draw produces a winner, growing as the jackpot climbs.</li>
        <li><strong style="color:#fff;">Risk-adjusted value</strong> — oracle value discounted by reset probability; the more conservative reference as a draw approaches.</li>
      </ul>
      <p style="${P}">
        The confidence grade (High / Medium / Low) reflects how many of four independent
        sources (powerball.com, usamega.com, calottery.com, texaslottery.com) agreed within
        a $5M tolerance. Values are published only when at least two sources agree.
      </p>
    </section>

    <footer style="border-top:1px solid #1E293B;margin-top:24px;padding-top:16px;font-size:.75rem;color:#475569;text-align:center;">
      Moonball Protocol · Pre-launch · Mainnet deployment requires completed audit · Moonball Labs, 2026
    </footer>
  </main>
</div>`,
  },
};

function buildHead(meta: RouteMeta): string {
  const img = meta.ogImage ?? DEFAULT_IMAGE;
  const imgAlt = meta.ogImageAlt ?? meta.title;
  const ogType = meta.ogType ?? "website";
  const canonicalUrl = meta.canonical ?? "";

  const ldJsonBlocks = (meta.structuredData ?? [])
    .map(
      (schema) =>
        `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`
    )
    .join("\n    ");

  const canonicalTag = canonicalUrl
    ? `<link rel="canonical" href="${canonicalUrl}" />`
    : "";
  const noindexTag = meta.noindex
    ? `<meta name="robots" content="noindex, nofollow" />`
    : "";
  const ogUrlTag = canonicalUrl
    ? `<meta property="og:url" content="${canonicalUrl}" />\n    <meta name="twitter:url" content="${canonicalUrl}" />`
    : "";

  return `
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}" />
    ${noindexTag}
    ${canonicalTag}
    <meta property="og:type" content="${ogType}" />
    ${ogUrlTag}
    <meta property="og:title" content="${meta.title}" />
    <meta property="og:description" content="${meta.description}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:alt" content="${imgAlt}" />
    <meta property="og:site_name" content="Moonball Protocol" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${meta.title}" />
    <meta name="twitter:description" content="${meta.description}" />
    <meta name="twitter:image" content="${img}" />
    <meta name="twitter:image:alt" content="${imgAlt}" />
    ${ldJsonBlocks}`.trim();
}

const NOT_FOUND_META: RouteMeta = {
  title: "Page Not Found | Moonball Protocol",
  description: "The requested page could not be found.",
  noindex: true,
  bodyHtml: `
<div style="${STYLE}">
  <header style="border-bottom:1px solid #1E293B;padding-bottom:16px;margin-bottom:4px;">
    <h1 style="${H1}">404 — Page Not Found</h1>
    <p style="${P}">The page you requested does not exist on Moonball Protocol.</p>
  </header>
  ${INTERNAL_NAV}
  <main>
    <p style="${P}">Try one of the links above to navigate to a valid page.</p>
  </main>
</div>`,
};

export function injectRouteMeta(html: string, pathname: string): string {
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  const meta = ROUTE_META[cleanPath] ?? NOT_FOUND_META;

  const injectedHead = buildHead(meta);

  const withHead = html
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/(<meta\s[^>]*name=["']description["'][^>]*>)/gi, "")
    .replace(/(<link\s[^>]*rel=["']canonical["'][^>]*>)/gi, "")
    .replace(/(<meta\s[^>]*property=["']og:[^"']*["'][^>]*>)/gi, "")
    .replace(/(<meta\s[^>]*name=["']twitter:[^"']*["'][^>]*>)/gi, "")
    .replace(/(<meta\s[^>]*property=["']twitter:[^"']*["'][^>]*>)/gi, "")
    .replace(/(<meta\s[^>]*name=["']robots["'][^>]*>)/gi, "")
    .replace("</head>", `${injectedHead}\n  </head>`);

  return withHead.replace(
    '<div id="root"></div>',
    `<div id="root">${meta.bodyHtml}</div>`
  );
}
