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

const BASE_URL = (
  process.env.PUBLIC_BASE_URL || "https://moonball.info"
).replace(/\/+$/, "");
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
  <a href="/" style="${NAV_A}">Home</a>
  <a href="/dashboard" style="${NAV_A}">Dashboard</a>
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
    name: "Moonball Protocol",
    url: BASE_URL,
    description:
      "Live Powerball jackpot dashboard with multi-cycle charts, countdown timers, winning numbers, and phase indicators. Built on a sci-fi oracle event-market for MOON tokens on Base.",
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Moonball Labs",
    url: BASE_URL,
    logo: DEFAULT_IMAGE,
    description:
      "Moonball Labs builds the Moonball Protocol — a free-floating ERC-20 event-market token on Base with a transparent, risk-adjusted oracle reference derived from the Powerball jackpot.",
    email: "edgar@moonball.info",
    foundingDate: "2025-04",
    founder: {
      "@type": "Person",
      name: "Edgar Ramirez",
      jobTitle: "Founder & CEO",
    },
    sameAs: [],
  },
];

const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "Moonball — Follow the jackpot. Understand the market.",
    description:
      "Meet MOON, a pre-launch digital token with a reference value derived from the Powerball jackpot. Learn how it works and join the waitlist for launch updates.",
    canonical: BASE_URL + "/",
    bodyHtml:
      '<main style="' +
      STYLE +
      '"><h1>Big jackpots. A new kind of market.</h1><p>Meet MOON: a digital token with a reference value that follows the Powerball jackpot. The market decides its price.</p><p>Pre-launch. Trading is not available yet.</p><nav><a href="/dashboard">Explore the dashboard</a> · <a href="/technical-paper">Read the technical paper</a></nav><h2>How it works</h2><p>The jackpot grows. Moonball checks public sources and updates a reference value. Once trading launches, buyers and sellers independently set the market price.</p><h2>Know the risks</h2><p>No guaranteed price or redemption. MOON does not give you a share of lottery winnings. Jackpot resets, limited liquidity, and smart-contract bugs can cause losses.</p><p>Enable JavaScript to view live data and join the waitlist.</p></main>',
  },
  "/dashboard": {
    title: "Jackpot Dashboard | Moonball",
    description:
      "Explore Powerball jackpot data, drawing history, and Moonball’s reference model. Reference values are not market prices or investment returns.",
    canonical: BASE_URL + "/dashboard",
    bodyHtml: `<main style="${STYLE}"><h1>Jackpot dashboard</h1>${INTERNAL_NAV}<p>Explore Powerball jackpot data, drawing history, source verification, and Moonball’s reference model.</p><p>Reference values are not market prices or investment returns. MOON is pre-launch. There is no guaranteed price or redemption.</p><p>Enable JavaScript to view live jackpot data and interactive charts.</p></main>`,
  },

  "/technical-paper": {
    title: "Technical Paper | Moonball Protocol",
    description:
      "Read the Moonball Protocol technical paper: tokenomics, oracle design, jackpot cycle mechanics, MOON token vesting schedule, and liquidity pool economics on Base.",
    canonical: `${BASE_URL}/technical-paper`,
    ogImage: `${BASE_URL}/social-card-technical-paper.png`,
    ogImageAlt:
      "Moonball Protocol Technical Paper — oracle design, tokenomics, pool calculator, and liquidity economics on Base",
    ogType: "article",
    structuredData: [
      ...WEBSITE_GRAPH,
      {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        headline: "Moonball Protocol — Technical Paper",
        description:
          "Technical documentation covering the Moonball Protocol design: free-floating ERC-20 event-market token on Base, multi-source consensus oracle, jackpot cycle mechanics, tokenomics, liquidity economics, and treasury policy.",
        url: `${BASE_URL}/technical-paper`,
        datePublished: "2025-04-01",
        dateModified: "2026-01-01",
        inLanguage: "en-US",
        author: {
          "@type": "Person",
          name: "Edgar Ramirez",
          jobTitle: "Founder & CEO",
          worksFor: {
            "@type": "Organization",
            name: "Moonball Labs",
          },
        },
        publisher: {
          "@type": "Organization",
          name: "Moonball Labs",
          url: BASE_URL,
          logo: {
            "@type": "ImageObject",
            url: DEFAULT_IMAGE,
          },
        },
        isPartOf: {
          "@type": "WebSite",
          name: "Moonball Protocol",
          url: BASE_URL,
        },
        about: [
          { "@type": "Thing", name: "ERC-20 token" },
          { "@type": "Thing", name: "Powerball jackpot" },
          { "@type": "Thing", name: "Oracle reference model" },
          { "@type": "Thing", name: "Decentralized exchange" },
          { "@type": "Thing", name: "Tokenomics" },
        ],
        keywords:
          "MOON token, ERC-20, Powerball, oracle, Base blockchain, event market, tokenomics, DeFi, liquidity pool, jackpot cycle",
        articleSection: [
          "Protocol Overview",
          "Oracle Reference Model",
          "Source Agreement",
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
      <h2 style="${H2}">3. Source Agreement</h2>
      <p style="${P}">
        The jackpot figure is sourced from multiple independent providers in
        parallel: powerball.com, usamega.com, calottery.com, and
        texaslottery.com. A value is only published once at least two sources
        agree within a $5 million tolerance. The source count describes agreement in the
        latest check, not a probability that the estimate is correct.
      </p>
      <p style="${P}">
        <span style="${BADGE("#34D399")}">Verified</span> 2 to 4 sources agree — the actual count is shown.<br/>
        <span style="${BADGE("#FBBF24")}">Unconfirmed</span> fewer than 2 sources agree, or equally sized groups conflict — the last verified value is held.
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
        The trader pays exactly the 1% pool fee with no Moonball surcharge. When the 2-of-3 Safe
        collects fees earned by Moonball-owned POL positions, 12% goes to the protocol treasury
        and 88% remains with POL. Fees earned by third-party LP positions are unaffected.
      </p>
      <p style="${P}">
        The Safe owns production POL position NFTs. POL may be migrated or withdrawn for legitimate
        governance, security, recovery, or infrastructure needs, but never to guarantee redemption
        or defend a price.
      </p>
    </section>

    <section>
      <h2 style="${H2}">6. Treasury Policy</h2>
      <p style="${P}">
        The treasury is fully visible on-chain. Its mandate is growth and operations — never price defense.
        Fee revenue is the 12% allocation from collected Moonball POL fees.
      </p>
      <p style="${P}">
        The current treasury policy targets 50% for protocol-owned liquidity and 50% for operations.
        This allocation is mutable Safe-governed policy, not automatic or immutable on-chain behavior.
      </p>
      <ul style="color:#94A3B8;font-size:.9rem;padding-left:20px;margin:0 0 12px;">
        <li><strong style="color:#fff;">Manage official liquidity</strong> — Safe-owned protocol liquidity managed under authorized treasury policy.</li>
        <li><strong style="color:#fff;">Fund the oracle</strong> — pays for multi-source jackpot verification under the current operations policy.</li>
        <li><strong style="color:#fff;">Cover operations</strong> — audits, infrastructure, and development, funded under treasury policy from Moonball's collected POL fee allocation.</li>
      </ul>
      <p style="${P}">Treasury reserves create no claim on the protocol and are not a redemption backstop.</p>
    </section>

    <section>
      <h2 style="${H2}">7. Reset Mechanics &amp; Whale Exit</h2>
      <p style="${P}">
        A reset is detected when the oracle reports a jackpot that drops sharply (below 50% of the last
        known value), indicating a winner. The reference value falls back to its base and a new reference
        cycle begins. The perpetual token, official pool, supply, and liquidity continue uninterrupted;
        the market reprices on its own.
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
        <li><strong style="color:#fff;">Standard smart-contract risk</strong> — professional audit and Moonball 2-of-3 Safe administration required before mainnet; an MVP timelock is optional.</li>
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
        Trader pays 1% pool fee. For fees earned and collected by Moonball-owned POL, 88% remains
        with POL and 12% goes to the treasury. The treasury currently targets 50% POL / 50%
        operations as mutable policy. Third-party LP fee earnings are unaffected.
      </p>
      <p style="${P}" style="font-weight:700;color:#94A3B8;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;">Fee Glide Path</p>
      <p style="${P}">
        The pool launches at a 1% fee tier. A future change, potentially to 0.30%, requires a
        separate governance-approved migration or configuration. No TVL milestone changes the fee automatically.
      </p>
    </section>

    <section>
      <h2 style="${H2}">11. Pool Size Calculator</h2>
      <p style="${P}">
        The pool size calculator helps estimate how much liquidity should be seeded in the
        MOON/USDC pool at launch. Given an expected daily trading volume and a target maximum
        price impact per trade, it calculates the required USDC seed, a corresponding MOON
        seed under the displayed oracle-reference scenario, and the total pool TVL needed to
        keep price impact within bounds.
      </p>
      <p style="${P}">
        This is a nonbinding scenario, not a launch-price instruction. The Safe separately
        approves the actual initial pool price and seed ratio. The oracle does not initialize,
        reset, or otherwise control the AMM.
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
    ogImageAlt:
      "Moonball Protocol — on-chain oracle reference and MOON token on Base, currently in pre-launch",
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
        The source agreement count shows how many of four independent sources
        (powerball.com, usamega.com, calottery.com, texaslottery.com) matched within
        a $5M tolerance in the latest check. Values are published only when at least two sources agree.
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
        `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`,
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
    `<div id="root">${meta.bodyHtml}</div>`,
  );
}
