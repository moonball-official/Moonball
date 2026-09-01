import { useLocation } from "wouter";
import { T, MOON_V2, formatUsd, formatPct } from "@/lib/constants";
import {
  ACTIVE_CHAIN,
  ADDRESSES,
  IS_DEPLOYED,
  explorerAddress,
} from "@/lib/moonball-contracts";
import { useWallet } from "@/hooks/use-onchain";
import { useLivePowerball, type OracleModel } from "@/hooks/use-moonball";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Protocol() {
  const [, navigate] = useLocation();
  const wallet = useWallet();
  const { data: live, isLoading } = useLivePowerball();
  const oracle = live?.oracle;

  return (
    <div
      style={{
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        background: T.bg,
        color: T.textPrimary,
        fontFamily: "'Rajdhani', sans-serif",
        paddingBottom: 100,
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 18px 14px",
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); navigate("/"); }}
          data-testid="button-back-home"
          style={{
            background: "transparent",
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.textSecondary,
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "'Rajdhani', sans-serif",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          ← Home
        </a>
        <div style={{ textAlign: "right" }}>
          <h1
            style={{
              fontFamily: "'Montserrat'",
              fontSize: 16,
              fontWeight: 700,
              color: T.gold,
              letterSpacing: 1.5,
              margin: 0,
            }}
            data-testid="text-protocol-title"
          >
            MOONBALL PROTOCOL
          </h1>
          <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: 1, fontFamily: "'Rajdhani', sans-serif" }}>
            {ACTIVE_CHAIN.name} · DEX market
          </div>
        </div>
      </header>

      <main style={{ padding: "16px 18px" }}>
        {!IS_DEPLOYED && (
          <Banner color="#F5A623">
            Contracts are not deployed on {ACTIVE_CHAIN.name} yet. You can preview the oracle
            reference below, but trading is unavailable until the MOON contract goes live.
          </Banner>
        )}

        {IS_DEPLOYED && !MOON_V2.marketLive && (
          <Banner color="#F5A623">
            Market pre-launch: the {MOON_V2.poolPair} pool on {MOON_V2.dexName} is not live yet.
            The figures below are oracle reference values, not tradable prices.
          </Banner>
        )}

        {/* Trade on a DEX */}
        <TradePanel wallet={wallet} oracle={oracle} />

        {/* Oracle reference (read-only) */}
        <div style={{ marginTop: 16 }}>
          <ReferencePanel oracle={oracle} jackpotM={live?.estimated} loading={isLoading} />
        </div>

        {/* Contract footer */}
        <p style={{ fontSize: 11, color: T.textMuted, marginTop: 16, lineHeight: 1.6, fontFamily: "'Rajdhani', sans-serif" }}>
          MOON trades freely on {MOON_V2.dexName} ({MOON_V2.poolPair}). The oracle publishes a
          reference value from public jackpot data — it is not a peg, and the protocol never redeems
          or defends a price. Testnet only — not financial advice.
          {IS_DEPLOYED && (
            <>
              {" "}Contract{" "}
              {ADDRESSES.moon && explorerAddress(ADDRESSES.moon) ? (
                <a
                  href={explorerAddress(ADDRESSES.moon)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: T.textSecondary }}
                >
                  {short(ADDRESSES.moon)}
                </a>
              ) : (
                short(ADDRESSES.moon)
              )}
              .
            </>
          )}
        </p>
      </main>
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────
function PrimaryButton({
  children,
  onClick,
  disabled,
  testid,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  testid?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      style={{
        width: "100%",
        padding: "14px 0",
        borderRadius: 12,
        border: "none",
        background: disabled
          ? "rgba(245,166,35,0.25)"
          : `linear-gradient(135deg, ${T.gold}, ${T.goldDark})`,
        color: "#0B0E17",
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

function WalletBar({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {wallet.address ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: T.bgCard,
            border: `1px solid ${wallet.isWrongNetwork ? "#EF4444" : T.border}`,
            borderRadius: 12,
            padding: "10px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: wallet.isWrongNetwork ? "#EF4444" : "#34D399",
                display: "inline-block",
              }}
            />
            <span
              style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13 }}
              data-testid="text-wallet-address"
            >
              {short(wallet.address)}
            </span>
          </div>
          {wallet.isWrongNetwork ? (
            <button
              onClick={wallet.switchToActiveChain}
              data-testid="button-switch-network"
              style={{
                background: "transparent",
                border: `1px solid #EF4444`,
                color: "#EF4444",
                borderRadius: 8,
                padding: "5px 10px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'Rajdhani', sans-serif",
              }}
            >
              Switch to {ACTIVE_CHAIN.name}
            </button>
          ) : (
            <button
              onClick={wallet.disconnect}
              data-testid="button-disconnect"
              style={{
                background: "transparent",
                border: `1px solid ${T.border}`,
                color: T.textSecondary,
                borderRadius: 8,
                padding: "5px 10px",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'Rajdhani', sans-serif",
              }}
            >
              Disconnect
            </button>
          )}
        </div>
      ) : (
        <PrimaryButton onClick={wallet.connect} testid="button-connect">
          {wallet.connecting
            ? "Connecting…"
            : wallet.hasWallet
              ? "Connect Wallet"
              : "Install a Wallet"}
        </PrimaryButton>
      )}
      {wallet.error && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#EF4444", fontFamily: "'Rajdhani', sans-serif" }} data-testid="text-wallet-error">
          {wallet.error}
        </div>
      )}
    </div>
  );
}

function ReferencePanel({
  oracle,
  jackpotM,
  loading,
}: {
  oracle?: OracleModel;
  jackpotM?: number;
  loading: boolean;
}) {
  const confColor =
    oracle?.confidence === "High"
      ? "#34D399"
      : oracle?.confidence === "Medium"
        ? T.gold
        : "#EF4444";

  const stats: { label: string; value: string; testid: string; color?: string }[] = oracle
    ? [
        { label: "Risk-adjusted", value: formatUsd(oracle.riskAdjustedValue), testid: "stat-risk-adjusted" },
        { label: "Oracle value", value: formatUsd(oracle.oracleValue), testid: "stat-oracle-value", color: T.gold },
        { label: "Jackpot", value: `$${jackpotM ?? "—"}M`, testid: "stat-jackpot" },
        {
          label: "Reset risk",
          value: formatPct(oracle.resetRisk),
          testid: "stat-reset-risk",
          color: oracle.resetRisk >= 0.5 ? "#EF4444" : oracle.resetRisk >= 0.25 ? T.gold : "#34D399",
        },
        {
          label: "Consensus",
          value: `${oracle.consensusCount}/${oracle.totalSources}`,
          testid: "stat-consensus",
        },
      ]
    : [];

  return (
    <div
      style={{
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontFamily: "'Montserrat'", fontSize: 11, fontWeight: 700, color: T.textSecondary, letterSpacing: 1.5, margin: 0 }}>
          ORACLE REFERENCE
        </h2>
        {oracle && (
          <span
            data-testid="badge-confidence"
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 20,
              color: confColor,
              border: `1px solid ${confColor}`,
              background: `${confColor}1A`,
              fontFamily: "'Nunito Sans'",
              letterSpacing: 0.5,
            }}
          >
            {oracle.confidence} confidence
          </span>
        )}
      </div>

      {loading && !oracle ? (
        <div style={{ color: T.textMuted, fontSize: 13, padding: "12px 0", fontFamily: "'Rajdhani', sans-serif" }} data-testid="text-loading">
          Reading oracle…
        </div>
      ) : !oracle ? (
        <div style={{ color: T.textMuted, fontSize: 13, padding: "12px 0", fontFamily: "'Rajdhani', sans-serif" }} data-testid="text-oracle-unavailable">
          Oracle data unavailable. Reference values will appear once the oracle responds.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {stats.map((s) => (
            <div key={s.testid}>
              <div style={{ fontSize: 9, color: T.textSecondary, marginBottom: 2, fontFamily: "'Nunito Sans'", letterSpacing: 1.5 }}>{s.label}</div>
              <div
                style={{
                  fontSize: 22,
                  fontFamily: "'Bebas Neue'",
                  letterSpacing: 1,
                  color: s.color ?? T.textPrimary,
                }}
                data-testid={s.testid}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TradePanel({
  wallet,
  oracle,
}: {
  wallet: ReturnType<typeof useWallet>;
  oracle?: OracleModel;
}) {
  const marketLive = MOON_V2.marketLive;
  const rows: { label: string; value: string; testid: string }[] = [
    {
      label: "Market price",
      value: marketLive ? "—" : "Pre-launch",
      testid: "row-market-price",
    },
    {
      label: "Oracle value",
      value: oracle ? formatUsd(oracle.oracleValue) : "—",
      testid: "row-oracle-value",
    },
    {
      label: "Premium / discount",
      value: marketLive ? "—" : "Awaiting liquidity",
      testid: "row-premium",
    },
    {
      label: "Liquidity depth",
      value: marketLive ? "—" : "Awaiting liquidity",
      testid: "row-depth",
    },
  ];

  return (
    <div
      style={{
        marginTop: 18,
        background: T.bgCard,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <h2 style={{ fontFamily: "'Montserrat'", fontSize: 11, fontWeight: 700, color: T.textSecondary, letterSpacing: 1.5, margin: 0, marginBottom: 12 }}>
        TRADE MOON
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => (
          <div
            key={r.testid}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span style={{ fontSize: 10, color: T.textSecondary, fontFamily: "'Nunito Sans'", letterSpacing: 1 }}>{r.label}</span>
            <span
              style={{ fontSize: 18, fontFamily: "'Bebas Neue'", letterSpacing: 1, color: T.textPrimary }}
              data-testid={r.testid}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        {!wallet.address ? (
          <PrimaryButton onClick={wallet.connect} testid="button-connect-action">
            {wallet.hasWallet ? "Connect Wallet" : "Install a Wallet"}
          </PrimaryButton>
        ) : wallet.isWrongNetwork ? (
          <PrimaryButton onClick={wallet.switchToActiveChain} testid="button-switch-action">
            Switch to {ACTIVE_CHAIN.name}
          </PrimaryButton>
        ) : marketLive && MOON_V2.dexUrl ? (
          <a href={MOON_V2.dexUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }} data-testid="link-dex-swap">
            <PrimaryButton testid="button-trade">Trade on {MOON_V2.dexName} ↗</PrimaryButton>
          </a>
        ) : (
          <PrimaryButton disabled testid="button-trade-disabled">
            DEX pool not live yet
          </PrimaryButton>
        )}
      </div>

    </div>
  );
}

function Banner({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        background: `${color}1A`,
        border: `1px solid ${color}`,
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 12,
        color,
        marginBottom: 14,
        fontFamily: "'Rajdhani', sans-serif",
      }}
    >
      {children}
    </div>
  );
}
