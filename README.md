<div align="center">

# D3FAULT Trading Agent

**Autonomous Solana memecoin trading agent — non-custodial, browser-native, fully on-chain.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF?style=flat-square&logo=solana&logoColor=white)](https://solana.com)
[![Jupiter](https://img.shields.io/badge/Jupiter-V6-E8552D?style=flat-square)](https://jup.ag)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/d3faultlabs/D3FAULT-Trading-Agent/typecheck.yml?style=flat-square&label=typecheck)](https://github.com/d3faultlabs/D3FAULT-Trading-Agent/actions)
[![Website](https://img.shields.io/badge/Website-d3fault.sh-0ea5e9?style=flat-square)](https://d3fault.sh)
[![Twitter](https://img.shields.io/badge/@d3fault__sh-000000?style=flat-square&logo=x&logoColor=white)](https://x.com/d3fault_sh)

</div>

---

## Overview

The D3FAULT Trading Agent is a fully client-side, autonomous trading engine written in TypeScript. It runs entirely inside the user's browser — private keys never leave the device.

```
Scanner ──▶ Researcher ──▶ Executor
   │              │              │
DexScreener   12-factor      Jupiter V6
pump.fun      scoring        VersionedTx
CoinGecko     model (0-100)  on-chain confirm
```

| Property | Detail |
|---|---|
| **Chain** | Solana Mainnet |
| **Swap Router** | Jupiter Aggregator V6 |
| **Wallet** | Privy embedded wallet (non-custodial) |
| **Persistence** | PostgreSQL (Drizzle ORM) + localStorage fast-path |
| **Scan sources** | DexScreener · pump.fun · CoinGecko |
| **Strategy** | Momentum + MCap sweet-spot (targeting 2–3×) |
| **Scan interval** | Configurable — default 90 s |
| **Position monitor** | Every 6 s via live DexScreener price feed |
| **Balance poll** | Every 15 s |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AgentEngine (class)                    │
│                                                             │
│   ┌───────────┐    ┌──────────────┐    ┌────────────────┐  │
│   │  SCANNER  │───▶│  RESEARCHER  │───▶│    EXECUTOR    │  │
│   │           │    │              │    │                │  │
│   │ DexScreen │    │  scoreToken  │    │  jupiterBuy()  │  │
│   │ pump.fun  │    │  12-factor   │    │  jupiterSell() │  │
│   │ CoinGecko │    │  0-100 model │    │  confirmCheck  │  │
│   └───────────┘    └──────────────┘    └────────────────┘  │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │            Position Monitor  (every 6 s)             │  │
│   │   Take Profit · Stop Loss · Instant Pump · Trailing  │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │                    Persistence                       │  │
│   │  localStorage (sync) → PostgreSQL (fire-and-forget)  │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Three-Phase Pipeline

### Phase 1 — Scanner

Runs on a configurable interval (default 90 s). Aggregates candidates from three independent sources, deduplicates by mint address, and feeds the unified list to the Researcher.

```
SCAN_CYCLE_START
    ├── DexScreener /token-profiles   →  boosted Solana tokens
    ├── pump.fun    /coins/latest     →  most-recent launches
    ├── pump.fun    /coins?sort=mcap  →  top market cap
    └── CoinGecko   /search/trending  →  globally trending Solana mints

Dedup by mint address → candidates[]
    └── Researcher queue  (180 ms spacing between candidates)
```

**Concurrency guard** — `_scannerActive` flag prevents overlapping scan cycles.

---

### Phase 2 — Researcher

Parallel data fetch + scoring per candidate:

```
mint
 ├── fetchDex(mint)       →  price, MCap, volume, txns, liquidity, age
 └── fetchPumpCoin(mint)  →  KOTH flag, socials, virtual reserves

scoreToken(12 factors)  →  { score: 0-100, notes: string[] }

Filter gates (all configurable):
 ├── Blacklist · Age · MCap range · Volume · Liquidity · Buy ratio
 ├── Max positions cap · Daily loss limit · Wallet balance floor
 └── Honeypot detection · Rug risk · Extreme pump signal · Whale filter

SKIP  →  logged, added to opportunities[] with willBuy: false
PASS  →  added to opportunities[] with willBuy: true  →  executeBuy()
```

**5-minute forced-entry mode** — if no position opened after 5 min, non-safety filters relax for any token scoring ≥ 30. Hard stops (loss limit, honeypot, rug) are never relaxed.

---

### Phase 3 — Executor

**Buy:**
```
executeBuy(opp)
 ├── buyLock mutex  (prevents concurrent buys)
 ├── fetchBalance() →  accurate sizing before order
 ├── solAmount = min(maxTradeSol, walletSol − 0.013 KEEP_SOL)
 ├── jupiterBuy(slippageBps, priorityFeeLamports)
 │     GET /quote → POST /swap → sendVersionedTx → confirmAndCheck
 │     Slippage retry: ×1.6 per attempt, max 3 attempts, ceil 5000 bps
 └── Position opened → _positions.set(mint) → emit() → persist()
```

**Sell:**
```
executeSell(pos, reason)
 ├── jupiterSell(slippageBps × 1.5, same retry logic)
 ├── pnlSol = solReceived − entryAmountSol
 ├── pnlPct = pnlSol / entryAmountSol × 100
 └── _trades.unshift({ side:"sell", pnlSol, pnlPct, reason, durationMs })

On swap failure: position restored — no silent loss
```

---

## Scoring Model

Minimum threshold configurable (default **62 / 100**).

| Factor | Max pts | Signal |
|---|---|---|
| 1h Volume | 25 | Primary liquidity signal — >$200K/h = max |
| Vol / MCap ratio | 15 | Key 2–3× momentum signal — >1.5× = max |
| Liquidity | 15 | Slippage protection — >$80K = max |
| MCap sweet spot | 12 | $15K–$100K = max (2× is realistic) |
| Age window | 12 | 10–30 min = max ("prime entry window") |
| 5m price momentum | 12 | >50% = max; negative momentum penalised |
| 1h price trend | 8 | >80% = max |
| Buy / Sell ratio | 12 | >5× = max; honeypot flag <3 sells after >30 min |
| Social presence | 5 | Twitter, Telegram, website detected |
| King of the Hill | 6 | pump.fun KOTH status |
| Top holder concentration | −22 max | >50% → rug risk deduction |
| MCap / Liquidity ratio | −12 max | >1000× → extreme penalty |
| Extreme pump signal | −18 max | >500% 5 m → dump likely |

Score is clamped to `[0, 100]` after all factors apply.

---

## Exit Strategy

Position monitor polls DexScreener every **6 seconds**. Triggers evaluated in priority order:

```
pnlPct     = (currentPrice − entryPrice) / entryPrice × 100
highPnlPct = running peak pnlPct for this position

1. Instant Pump TP  →  pnlPct ≥ instantProfitPct  AND  holdTime < 12 min
2. Take Profit      →  pnlPct ≥ takeProfitPct
3. Trailing Stop    →  highPnlPct > 20  AND  pnlPct < highPnlPct − trailingStopPct
4. Stop Loss        →  pnlPct ≤ −stopLossPct
```

Default thresholds:

| Trigger | Default |
|---|---|
| `instantProfitPct` | 70% |
| `takeProfitPct` | 40% |
| `trailingStopPct` | 10% (activates after +20%) |
| `stopLossPct` | 15% |

---

## Risk Controls

| Control | Mechanism |
|---|---|
| **KEEP_SOL reserve** | 0.013 SOL always kept (0.010 floor + 0.003 fee buffer) |
| **Low-balance auto-pause** | Pauses if `walletSol < 0.010` with no open positions |
| **Max positions cap** | Configurable (default 2) |
| **Daily loss limit** | `totalLostSol ≥ maxLossSol` blocks all new buys |
| **Min balance gate** | Researcher skips if `walletSol ≤ 0.018` |
| **Buy lock mutex** | Prevents concurrent swap race conditions |
| **Honeypot detection** | <3 sells + >40 buys + age >30 min → −18 pts + skip |
| **Rug detection** | Top holder >50% → −22 pts + skip |
| **Extreme pump guard** | >500% 5 m → −18 pts + skip |
| **Whale filter** | Optional: skip if `sells > buys × 2 AND sells > 20` |
| **Blacklist** | User-defined mint exclusion list |
| **Sell failure recovery** | Position restored on failed swap — no silent loss |

---

## Presets

| | Conservative | Default | Sniper | Degen |
|---|---|---|---|---|
| `maxTradeSol` | 0.05 | **0.10** | 0.15 | 0.20 |
| `maxPositions` | 1 | **2** | 2 | 4 |
| `takeProfitPct` | 30% | **40%** | 60% | 80% |
| `stopLossPct` | 10% | **15%** | 12% | 20% |
| `instantProfitPct` | 50% | **70%** | 80% | 120% |
| `trailingStopPct` | 8% | **10%** | 12% | 15% |
| `minScore` | 70 | **62** | 72 | 45 |
| `minMcapK` | $20K | **$10K** | $10K | $5K |
| `maxMcapK` | $200K | **$500K** | $100K | $1M |
| `minVolume1hK` | $10K | **$5K** | $15K | $2K |
| `maxAgeMin` | 120 min | **240 min** | 60 min | 480 min |
| `slippageBps` | 600 | **800** | 1000 | 1500 |
| `scanIntervalSec` | 120 s | **90 s** | 45 s | 60 s |
| `whaleFilterEnabled` | ✓ | — | ✓ | — |

---

## Persistence Layer

State persisted on every `emit()` — two layers, one authoritative.

### localStorage — fast path (sync)

| Key | Value | Limit |
|---|---|---|
| `d3f:trades:{agentPubkey}` | `TradeRecord[]` JSON | 200 records |
| `d3f:openPositions:{agentPubkey}` | `Position[]` JSON | all open positions |

### PostgreSQL — authoritative (fire-and-forget)

```sql
CREATE TABLE agent_trades (
  id           TEXT    NOT NULL,
  agent_pubkey TEXT    NOT NULL,
  mint         TEXT    NOT NULL,
  symbol       TEXT    NOT NULL,
  name         TEXT,
  image_url    TEXT,
  side         TEXT    NOT NULL,     -- 'buy' | 'sell'
  amount_sol   FLOAT8  NOT NULL,
  price_usd    FLOAT8,
  pnl_pct      FLOAT8,
  pnl_sol      FLOAT8,
  sig          TEXT    NOT NULL,
  ts           BIGINT  NOT NULL,     -- Unix ms
  reason       TEXT,                 -- exit trigger label
  duration_ms  BIGINT,               -- hold time ms
  PRIMARY KEY (id, agent_pubkey)
);
CREATE INDEX idx_agent_trades_pubkey_ts ON agent_trades (agent_pubkey, ts DESC);

CREATE TABLE agent_positions (
  mint         TEXT    NOT NULL,
  agent_pubkey TEXT    NOT NULL,
  data         JSONB   NOT NULL,     -- full Position object
  PRIMARY KEY (mint, agent_pubkey)
);
```

**Load order on mount:**

```
1. localStorage   →  instant render
2. GET /trades    →  DB overwrites local cache if data found
3. GET /positions →  DB overwrites local cache if data found
```

---

## REST API

Routes mounted under `/api/agent/data/:pubkey`.

| Method | Path | Action |
|---|---|---|
| `GET` | `/trades` | All trades, `ts DESC` |
| `POST` | `/trades` | Upsert — `ON CONFLICT DO NOTHING` |
| `GET` | `/positions` | All open positions |
| `POST` | `/positions` | Replace-all (delete + insert) |
| `DELETE` | `/positions/:mint` | Remove single position |

---

## TypeScript Reference

<details>
<summary><strong>WalletSigner</strong></summary>

```ts
interface WalletSigner {
  publicKey: string;
  sendVersionedTx: (tx: VersionedTransaction) => Promise<string>;
}
```
</details>

<details>
<summary><strong>AgentSettings</strong></summary>

```ts
interface AgentSettings {
  maxTradeSol:          number;
  maxLossSol:           number;
  maxPositions:         number;
  takeProfitPct:        number;
  stopLossPct:          number;
  instantProfitPct:     number;
  trailingStopPct:      number;
  minMcapK:             number;
  maxMcapK:             number;
  minVolume1hK:         number;
  minLiquidityK:        number;
  maxAgeMin:            number;
  minBuyRatio:          number;
  minScore:             number;
  slippageBps:          number;
  priorityFeeLamports:  number;
  scanIntervalSec:      number;
  whaleFilterEnabled:   boolean;
  blacklistedMints:     string[];
}
```
</details>

<details>
<summary><strong>Position</strong></summary>

```ts
interface Position {
  id:              string;
  mint:            string;
  symbol:          string;
  name:            string;
  imageUrl?:       string;
  entryPriceUsd:   number;
  entryAmountSol:  number;
  tokenAmount:     number;
  openedAt:        number;
  currentPriceUsd: number;
  entryMcapUsd:    number;
  currentMcapUsd:  number;
  pnlPct:          number;
  pnlSol:          number;
  highPnlPct:      number;
  sig:             string;
}
```
</details>

<details>
<summary><strong>TradeRecord</strong></summary>

```ts
interface TradeRecord {
  id:          string;
  mint:        string;
  symbol:      string;
  name?:       string;
  imageUrl?:   string;
  side:        "buy" | "sell";
  amountSol:   number;
  priceUsd:    number;
  pnlPct?:     number;
  pnlSol?:     number;
  sig:         string;
  ts:          number;
  reason?:     "take_profit" | "stop_loss" | "instant_pump" | "trailing_stop" | "manual";
  durationMs?: number;
}
```
</details>

<details>
<summary><strong>EngineState</strong></summary>

```ts
interface EngineState {
  status:           "idle" | "running" | "error";
  scannerActive:    boolean;
  researcherActive: boolean;
  executorActive:   boolean;
  scannerLog:       PhaseLog[];
  researcherLog:    PhaseLog[];
  executorLog:      PhaseLog[];
  opportunities:    TokenOpportunity[];
  positions:        Position[];
  trades:           TradeRecord[];
  totalPnlSol:      number;
  buyingMint:       string | null;
  walletSol:        number;
  scannedCount:     number;
  approvedCount:    number;
  error?:           string;
}
```
</details>

---

## Setup

```bash
git clone https://github.com/d3faultlabs/D3FAULT-Trading-Agent.git
cd D3FAULT-Trading-Agent
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Description |
|---|---|---|
| `SOLANA_RPC_ENDPOINT` | ✓ | Primary Solana RPC (Helius recommended) |
| `SOLANA_RPC_ENDPOINT_2` | — | Fallback RPC endpoint |
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `VITE_PRIVY_APP_ID` | ✓ | Privy app ID for embedded wallet |

---

## Data Sources

| Source | Data |
|---|---|
| DexScreener `/token-profiles` | Boosted token list |
| DexScreener `/dex/tokens/{mint}` | Price, MCap, volume, liquidity, txns, age |
| pump.fun `/coins/latest` | Recent launches |
| pump.fun `/coins?sort=market_cap` | Top MCap |
| pump.fun `/coins/{mint}` | KOTH flag, socials, reserves |
| CoinGecko `/search/trending` | Globally trending Solana mints |
| Jupiter V6 `/quote` + `/swap` | Best-route execution |
| Solana RPC | Balance + transaction confirmation |

---

## Security

- All transactions are **signed client-side** — private keys never transmitted
- Swaps confirmed at `"confirmed"` commitment before any state update
- `SlippageToleranceExceeded` (error 6025) triggers retry; all other on-chain errors propagate immediately

Report vulnerabilities via [SECURITY.md](./SECURITY.md).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

[MIT](./LICENSE) — © 2026 D3FAULT Labs

---

<div align="center">

**[d3fault.sh](https://d3fault.sh)** · **[@d3fault_sh](https://x.com/d3fault_sh)**

*Trade in the shadows.*

</div>
