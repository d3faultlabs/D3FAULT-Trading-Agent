# D3FAULT Trading Agent

> Autonomous Solana memecoin trading agent — fully on-chain, non-custodial, privacy-first.  
> Built on top of the D3FAULT protocol. Runs in the browser. Zero backend custody of funds.

---

## Table of Contents

1. [Overview](#overview)  
2. [Architecture](#architecture)  
3. [Three-Phase Pipeline](#three-phase-pipeline)  
   - [Phase 1 — Scanner](#phase-1--scanner)  
   - [Phase 2 — Researcher](#phase-2--researcher)  
   - [Phase 3 — Executor](#phase-3--executor)  
4. [Scoring Model](#scoring-model)  
5. [Exit Strategy](#exit-strategy)  
6. [Risk Controls](#risk-controls)  
7. [Presets](#presets)  
8. [Persistence Layer](#persistence-layer)  
9. [API Reference](#api-reference)  
10. [TypeScript Reference](#typescript-reference)  
11. [Configuration Reference](#configuration-reference)  
12. [Data Sources](#data-sources)  
13. [Execution Engine Internals](#execution-engine-internals)  

---

## Overview

The D3FAULT Trading Agent is a fully client-side, autonomous trading engine written in TypeScript.  
It runs entirely inside the user's browser — no private keys ever leave the device.

Key properties:

| Property | Detail |
|---|---|
| **Chain** | Solana Mainnet |
| **Swap Router** | Jupiter Aggregator V6 |
| **Wallet** | Privy embedded wallet (non-custodial, browser-side signing) |
| **Persistence** | PostgreSQL (Drizzle ORM) + localStorage fast-path |
| **Scan sources** | DexScreener, pump.fun, CoinGecko |
| **Strategy** | Momentum + MCap sweet-spot (targeting 2–3× from entry) |
| **Scan interval** | Configurable, default 90 s |
| **Position monitor** | Every 6 s (real-time price feed via DexScreener) |
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
│   │ CoinGecko │    │  0-100 model │    │  confirmAndCheck│ │
│   └───────────┘    └──────────────┘    └────────────────┘  │
│         │                 │                    │            │
│         ▼                 ▼                    ▼            │
│   scannerLog[]     researcherLog[]       executorLog[]      │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │                 Position Monitor (6 s)               │  │
│   │  Take Profit · Stop Loss · Instant Pump · Trailing   │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │           Persistence (emit() on every state change) │  │
│   │  localStorage (sync) → PostgreSQL (fire-and-forget)  │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

The engine is instantiated per-user and per-agent-wallet. It takes a `WalletSigner` — a thin interface wrapping Privy's embedded wallet — and calls `onUpdate(EngineState)` after every meaningful state transition.

```ts
const engine = new AgentEngine(signer, settings, (state) => {
  setEngineState(state);
});
engine.start();
```

---

## Three-Phase Pipeline

### Phase 1 — Scanner

Runs on a configurable interval (default 90 s). Fetches token candidates from three independent sources concurrently, deduplicates by mint address, and pushes the unified candidate list to the Researcher queue.

```
SCAN_CYCLE_START
    │
    ├── DexScreener /token-profiles  → boosted Solana tokens (paid promotions = attention signal)
    ├── pump.fun /coins/latest       → most-recent launches
    ├── pump.fun /coins?sort=market_cap → top MCap on pump.fun
    └── CoinGecko /search/trending   → Solana mints trending globally
    │
    ▼
Dedup by mint → unified candidate[]
    │
    ▼
Researcher (sequential, 180 ms spacing to respect rate limits)
```

**Concurrency guard** — the scanner sets `_scannerActive = true` on entry and returns immediately if another scan cycle is already in-flight. This prevents overlapping scans from doubling API calls during slow network conditions.

---

### Phase 2 — Researcher

For each candidate mint, the Researcher performs a parallel data fetch and runs the scoring model:

```
mint
 │
 ├── fetchDex(mint)       — DexScreener pair data (price, MCap, volume, txns, liquidity, age)
 └── fetchPumpCoin(mint)  — pump.fun coin metadata (KOTH flag, socials, reserves)
 │
 ▼
scoreToken(12 factors) → { score: 0-100, notes: string[] }
 │
 ├── Blacklist check
 ├── Age, MCap, volume, liquidity, buy ratio gate (user-configurable)
 ├── Whale filter gate (optional)
 ├── Max positions gate
 ├── Daily loss limit gate
 ├── Honeypot detection
 ├── Rug risk (top holder concentration)
 └── Extreme pump signal (500%+ 5 m)
 │
 ├── SKIP  → log skipReason, add to opportunities[] as willBuy: false
 └── PASS  → add to opportunities[] as willBuy: true → executeBuy()
```

**5-minute forced-entry mode** — if the agent has been running for more than 5 minutes with zero open positions, non-safety filters are relaxed for any token scoring ≥ 30. Hard stops (loss limit, insufficient balance, honeypot, rug) are never relaxed.

---

### Phase 3 — Executor

#### Buy

```
executeBuy(opp)
 │
 ├── buyLock guard (prevents double-buy race condition)
 ├── fetchBalance() — refresh SOL balance before sizing
 ├── solAmount = min(maxTradeSol, walletSol − KEEP_SOL)
 │     KEEP_SOL = 0.013 SOL (0.010 low-balance floor + 0.003 sell-fee buffer)
 │
 ├── jupiterBuy(mint, solAmount, slippageBps, priorityFeeLamports)
 │     ├── GET /quote  → Jupiter V6 quote API
 │     ├── POST /swap  → build VersionedTransaction
 │     ├── signer.sendVersionedTx(tx)
 │     ├── confirmAndCheck(sig) — on-chain confirmation at "confirmed" commitment
 │     └── Slippage retry: bps × 1.6^attempt, max 3 attempts, ceil 5000 bps
 │
 └── Position opened → _positions.set(mint, Position)
                     → _trades.unshift({ side: "buy" })
                     → emit() → persist()
```

#### Sell

```
executeSell(pos, reason)
 │
 ├── _positions.delete(mint) — immediately remove (optimistic update)
 ├── jupiterSell(mint, tokenAmount, decimals, slippageBps × 1.5, priorityFeeLamports)
 │     └── same retry logic as buy
 │
 ├── pnlSol = solReceived − entryAmountSol
 ├── pnlPct = pnlSol / entryAmountSol × 100
 ├── if pnlSol < 0: totalLostSol += |pnlSol|
 │
 └── _trades.unshift({ side: "sell", pnlSol, pnlPct, reason, durationMs })
       → emit() → persist()

On swap failure: _positions.set(mint, pos) — position restored, user can retry
```

---

## Scoring Model

The scorer returns an integer in `[0, 100]`. A token must reach the configured `minScore` threshold (default 62) to be approved for purchase.

| Factor | Max pts | Signal |
|---|---|---|
| **1h Volume** | 25 | Primary liquidity signal. >$200K = max. |
| **Vol / MCap ratio** | 15 | Key 2-3× momentum signal. >1.5× vol/mcap = max. |
| **Liquidity** | 15 | Prevents thin-book slippage. >$80K = max. |
| **MCap sweet spot** | 12 | $15K–$100K = max (2× from here is realistic). |
| **Age window** | 12 | 10–30 min = max ("prime entry window"). |
| **5m price momentum** | 12 | >50% 5 m = max. Negative momentum penalised. |
| **1h price trend** | 8 | >80% 1 h = max. |
| **Buy/Sell ratio** | 12 | >5× = max. Honeypot flag at <3 sells after >30 min. |
| **Social presence** | 5 | Twitter, Telegram, website presence. |
| **King of the Hill** | 6 | pump.fun KOTH status. |
| **Top holder concentration** | −22 max | >50% → −22 pts ("rug risk"). |
| **MCap/Liquidity ratio** | −12 max | >1000× → extreme penalty. |
| **Extreme pump** | −18 max | >500% 5 m pump → "dump likely". |

Score is clamped to `[0, 100]` after all factors are applied.

---

## Exit Strategy

The position monitor runs every **6 seconds**, polling DexScreener for live price. All four exit conditions are checked in priority order:

```
pnlPct = (currentPrice − entryPrice) / entryPrice × 100
highPnlPct = max(historical pnlPct for this position)

Priority 1 — Instant Pump TP:   pnlPct ≥ instantProfitPct  AND  ageMin < 12
Priority 2 — Take Profit:        pnlPct ≥ takeProfitPct
Priority 3 — Trailing Stop:      highPnlPct > 20  AND  pnlPct < highPnlPct − trailingStopPct
Priority 4 — Stop Loss:          pnlPct ≤ −stopLossPct
```

Default thresholds:

| Exit trigger | Default | Description |
|---|---|---|
| `instantProfitPct` | 70% | Immediate exit on early spike |
| `takeProfitPct` | 40% | Standard take profit |
| `trailingStopPct` | 10% | Trail from peak (activates after +20%) |
| `stopLossPct` | 15% | Hard floor |

Sell slippage is automatically set to `slippageBps × 1.5` to maximise fill probability on exit.

---

## Risk Controls

| Control | Mechanism |
|---|---|
| **KEEP_SOL reserve** | 0.013 SOL always kept in wallet (fees + low-balance floor) |
| **Low balance auto-pause** | Agent pauses if `walletSol < 0.010` and no open positions |
| **Max positions** | Configurable (default 2). Researcher skips if at cap. |
| **Daily loss limit** | `totalLostSol ≥ maxLossSol` → all new buys skipped |
| **Minimum balance gate** | Researcher skips if `walletSol ≤ 0.018` |
| **Buy lock** | Single mutex (`buyLock`) prevents concurrent buys |
| **Honeypot detection** | `sells1h < 3 AND buys1h > 40 AND ageMin > 30` → −18 pts + skip |
| **Rug detection** | Top holder >50% → −22 pts + "rug risk" skip |
| **Extreme pump guard** | +500% 5 m → −18 pts + skip |
| **Whale filter** | Optional. Skips if `sells1h > buys1h × 2 AND sells1h > 20` |
| **Blacklist** | User-defined mint address blacklist |
| **Sell failure recovery** | On swap failure, position is restored to map — no silent loss |

---

## Presets

Four built-in strategy presets are provided. All parameters are user-overridable.

### Conservative

Minimum risk. Smaller positions, tighter stops, stricter filters. Best for users new to memecoin trading.

```ts
maxTradeSol: 0.05,  maxPositions: 1,   takeProfitPct: 30,  stopLossPct: 10,
instantProfitPct: 50,  trailingStopPct: 8,  minScore: 70,
minMcapK: 20,  maxMcapK: 200,  minVolume1hK: 10,  minLiquidityK: 5,
maxAgeMin: 120,  minBuyRatio: 1.5,  whaleFilterEnabled: true,
slippageBps: 600,  priorityFeeLamports: 200_000,  scanIntervalSec: 120,
```

### Default

Balanced risk/reward. Recommended starting point.

```ts
maxTradeSol: 0.10,  maxPositions: 2,   takeProfitPct: 40,  stopLossPct: 15,
instantProfitPct: 70,  trailingStopPct: 10,  minScore: 62,
minMcapK: 10,  maxMcapK: 500,  minVolume1hK: 5,  minLiquidityK: 2,
maxAgeMin: 240,  minBuyRatio: 1.2,  whaleFilterEnabled: false,
slippageBps: 800,  priorityFeeLamports: 300_000,  scanIntervalSec: 90,
```

### Sniper

Targets micro-cap, high-momentum tokens in their first hour. Very selective. High priority fees for fast inclusion.

```ts
maxTradeSol: 0.15,  maxPositions: 2,   takeProfitPct: 60,  stopLossPct: 12,
instantProfitPct: 80,  trailingStopPct: 12,  minScore: 72,
minMcapK: 10,  maxMcapK: 100,  minVolume1hK: 15,  minLiquidityK: 8,
maxAgeMin: 60,  minBuyRatio: 2.0,  whaleFilterEnabled: true,
slippageBps: 1000,  priorityFeeLamports: 400_000,  scanIntervalSec: 45,
```

### Degen

Maximum aggression. Large positions, loose filters, wide slippage. Not recommended unless you understand the risks.

```ts
maxTradeSol: 0.20,  maxPositions: 4,   takeProfitPct: 80,  stopLossPct: 20,
instantProfitPct: 120,  trailingStopPct: 15,  minScore: 45,
minMcapK: 5,  maxMcapK: 1000,  minVolume1hK: 2,  minLiquidityK: 1,
maxAgeMin: 480,  minBuyRatio: 1.0,  whaleFilterEnabled: false,
slippageBps: 1500,  priorityFeeLamports: 500_000,  scanIntervalSec: 60,
```

---

## Persistence Layer

State is persisted at two layers on every `emit()` call.

### Fast path — localStorage

Synchronous write. Available immediately on next page load.

| Key | Value | Limit |
|---|---|---|
| `d3f:trades:{agentPubkey}` | `TradeRecord[]` JSON | 200 records |
| `d3f:openPositions:{agentPubkey}` | `Position[]` JSON | all open positions |

### Slow path — PostgreSQL

Fire-and-forget `fetch()` after every localStorage write. Never blocks the UI thread. Falls back silently if the API is unreachable.

**Schema** (Drizzle ORM):

```sql
-- agent_trades
CREATE TABLE agent_trades (
  id           TEXT        NOT NULL,
  agent_pubkey TEXT        NOT NULL,
  mint         TEXT        NOT NULL,
  symbol       TEXT        NOT NULL,
  name         TEXT,
  image_url    TEXT,
  side         TEXT        NOT NULL,          -- 'buy' | 'sell'
  amount_sol   FLOAT8      NOT NULL,
  price_usd    FLOAT8,
  pnl_pct      FLOAT8,
  pnl_sol      FLOAT8,
  sig          TEXT        NOT NULL,
  ts           BIGINT      NOT NULL,          -- Unix ms
  reason       TEXT,                          -- exit trigger
  duration_ms  BIGINT,                        -- hold duration
  PRIMARY KEY (id, agent_pubkey)
);
CREATE INDEX idx_agent_trades_pubkey_ts ON agent_trades (agent_pubkey, ts DESC);

-- agent_positions
CREATE TABLE agent_positions (
  mint         TEXT        NOT NULL,
  agent_pubkey TEXT        NOT NULL,
  data         JSONB       NOT NULL,          -- full Position object
  PRIMARY KEY (mint, agent_pubkey)
);
CREATE INDEX idx_agent_positions_pubkey ON agent_positions (agent_pubkey);
```

**Upsert strategy for trades** — `ON CONFLICT DO NOTHING`. Existing records are never overwritten. Only the newest trade (index 0 of the sorted array) is sent per `persistTrades()` call to minimise API surface.

**Replace-all strategy for positions** — on every `persistPositions()` call, the full positions array is sent. The server `DELETE`s all existing rows for the agent pubkey, then re-inserts. This ensures the DB always reflects the exact in-memory state.

### Load order on page mount

```
1. localStorage (sync, instant)  →  render with cached state
2. GET /api/agent/data/{pubkey}/trades    (async)
3. GET /api/agent/data/{pubkey}/positions (async)
   → if DB has data, overwrite localStorage cache + re-render
```

This gives instant perceived load time (localStorage) with eventual consistency from the authoritative DB source.

---

## API Reference

All routes are mounted under `/api/agent/data/:pubkey`.

### `GET /api/agent/data/:pubkey/trades`

Returns all trade records for the given agent wallet, sorted by timestamp descending.

**Response** `200 TradeRecord[]`

```jsonc
[
  {
    "id": "5Ksq…",
    "mint": "63zbTAAc…pump",
    "symbol": "PEPE",
    "side": "sell",
    "amountSol": 0.0941,
    "priceUsd": 0.000142,
    "pnlPct": 38.4,
    "pnlSol": 0.0341,
    "sig": "5Ksq…",
    "ts": 1746789123456,
    "reason": "take_profit",
    "durationMs": 842000
  }
]
```

---

### `POST /api/agent/data/:pubkey/trades`

Upserts one or more trade records. Conflicts on `(id, agent_pubkey)` are ignored.

**Body** `TradeRecord[]`  
**Response** `{ ok: true, count: number }`

---

### `GET /api/agent/data/:pubkey/positions`

Returns all open positions for the agent as raw `Position` objects (stored as JSONB).

**Response** `200 Position[]`

---

### `POST /api/agent/data/:pubkey/positions`

Replaces all open positions for the agent (delete-then-insert).

**Body** `Position[]`  
**Response** `{ ok: true, count: number }`

---

### `DELETE /api/agent/data/:pubkey/positions/:mint`

Removes a single position by mint address.

**Response** `{ ok: true }`

---

## TypeScript Reference

### `WalletSigner`

Thin interface over any Solana wallet that can sign versioned transactions.

```ts
interface WalletSigner {
  publicKey: string;
  sendVersionedTx: (tx: VersionedTransaction) => Promise<string>;
}
```

The D3FAULT implementation wraps Privy's `useSolanaWallets()` hook.

---

### `AgentSettings`

```ts
interface AgentSettings {
  // Trade sizing
  maxTradeSol:          number;   // SOL per trade
  maxLossSol:           number;   // daily cumulative loss cap

  // Position limits
  maxPositions:         number;

  // Exit thresholds (%)
  takeProfitPct:        number;
  stopLossPct:          number;
  instantProfitPct:     number;   // fast-exit on early spike (ageMin < 12)
  trailingStopPct:      number;   // trail from peak (activates after +20%)

  // Token filters
  minMcapK:             number;   // USD thousands
  maxMcapK:             number;
  minVolume1hK:         number;
  minLiquidityK:        number;
  maxAgeMin:            number;
  minBuyRatio:          number;   // buys1h / sells1h

  // Quality gate
  minScore:             number;   // 0-100

  // Execution
  slippageBps:          number;   // buy slippage; sell = × 1.5
  priorityFeeLamports:  number;
  scanIntervalSec:      number;

  // Protection
  whaleFilterEnabled:   boolean;
  blacklistedMints:     string[];
}
```

---

### `Position`

```ts
interface Position {
  id:              string;   // buy tx sig (unique per position)
  mint:            string;
  symbol:          string;
  name:            string;
  imageUrl?:       string;
  entryPriceUsd:   number;
  entryAmountSol:  number;
  tokenAmount:     number;
  openedAt:        number;   // Unix ms
  currentPriceUsd: number;
  entryMcapUsd:    number;
  currentMcapUsd:  number;
  pnlPct:          number;   // live, updated every 6 s
  pnlSol:          number;
  highPnlPct:      number;   // peak PnL seen (trailing stop anchor)
  sig:             string;
}
```

---

### `TradeRecord`

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
  pnlPct?:     number;   // sell only
  pnlSol?:     number;   // sell only
  sig:         string;
  ts:          number;   // Unix ms
  reason?:     string;   // "take_profit" | "stop_loss" | "instant_pump" | "trailing_stop" | "manual"
  durationMs?: number;   // sell only
}
```

---

### `EngineState`

The complete snapshot emitted by `onUpdate` after every state change.

```ts
interface EngineState {
  status:           "idle" | "running" | "error";
  scannerActive:    boolean;
  researcherActive: boolean;
  executorActive:   boolean;
  scannerLog:       PhaseLog[];     // last 80 entries
  researcherLog:    PhaseLog[];
  executorLog:      PhaseLog[];
  opportunities:    TokenOpportunity[];  // last 50 candidates, scored
  positions:        Position[];
  trades:           TradeRecord[];  // last 50 records
  totalPnlSol:      number;         // realised PnL (sell trades only)
  buyingMint:       string | null;  // in-progress buy
  walletSol:        number;
  scannedCount:     number;
  approvedCount:    number;
  error?:           string;
}
```

---

## Configuration Reference

| Parameter | Type | Default | Description |
|---|---|---|---|
| `maxTradeSol` | `number` | `0.10` | SOL allocated per buy |
| `maxLossSol` | `number` | `0.50` | Session loss cap in SOL |
| `maxPositions` | `number` | `2` | Concurrent open positions |
| `takeProfitPct` | `number` | `40` | % gain to trigger take profit |
| `stopLossPct` | `number` | `15` | % loss to trigger stop loss |
| `instantProfitPct` | `number` | `70` | % gain for instant exit (< 12 min hold) |
| `trailingStopPct` | `number` | `10` | Trail distance from peak (activates at +20%) |
| `minMcapK` | `number` | `10` | Minimum market cap in $K |
| `maxMcapK` | `number` | `500` | Maximum market cap in $K |
| `minVolume1hK` | `number` | `5` | Minimum 1h volume in $K |
| `minLiquidityK` | `number` | `2` | Minimum pool liquidity in $K |
| `maxAgeMin` | `number` | `240` | Maximum token age in minutes |
| `minBuyRatio` | `number` | `1.2` | Minimum buys/sells ratio (last 1h) |
| `minScore` | `number` | `62` | Minimum score out of 100 |
| `slippageBps` | `number` | `800` | Base slippage tolerance (bps) |
| `priorityFeeLamports` | `number` | `300_000` | Priority fee per transaction |
| `scanIntervalSec` | `number` | `90` | Scanner cycle period in seconds |
| `whaleFilterEnabled` | `boolean` | `false` | Enable whale sell-pressure detection |
| `blacklistedMints` | `string[]` | `[]` | Mints permanently excluded from trading |

---

## Data Sources

| Source | Endpoint | Data |
|---|---|---|
| **DexScreener** | `/token-profiles/latest/v1` | Boosted token list |
| **DexScreener** | `/dex/tokens/{mint}` | Price, MCap, volume, liquidity, txn counts, age |
| **pump.fun** | `/coins?sort=last_trade_timestamp` | Recent launches |
| **pump.fun** | `/coins?sort=market_cap` | Top MCap coins |
| **pump.fun** | `/coins/{mint}` | KOTH flag, social links, reserves |
| **CoinGecko** | `/search/trending` | Trending Solana mints |
| **Jupiter V6** | `/quote` | Swap routing & price impact |
| **Jupiter V6** | `/swap` | Serialised `VersionedTransaction` |
| **Solana RPC** | `getBalance` | Wallet SOL balance |
| **Solana RPC** | `confirmTransaction` | On-chain confirmation |

All external calls are proxied through the D3FAULT API server to avoid CORS/CSP restrictions and to enable caching at the edge.

---

## Execution Engine Internals

### Jupiter slippage escalation

Both `jupiterBuy` and `jupiterSell` implement automatic slippage escalation across up to 3 attempts:

```
attempt 0: effectiveBps = slippageBps
attempt 1: effectiveBps = slippageBps × 1.6
attempt 2: effectiveBps = slippageBps × 1.6² = slippageBps × 2.56
ceiling:   5000 bps (50%)
```

Sells start at `slippageBps × 1.5` (higher baseline) because:
- Token liquidity is typically lower after the buy-driven price spike.
- A failed sell leaving the position open is a worse outcome than accepting more slippage.

### Dynamic slippage (Jupiter API feature)

In addition to the static `slippageBps`, the swap request enables Jupiter's `dynamicSlippage`:

```json
{
  "dynamicSlippage": {
    "minBps": 50,
    "maxBps": min(effectiveBps × 2, 5000)
  }
}
```

This allows Jupiter to apply a tighter slippage bound when the route is safe to do so, reducing unnecessary value loss on liquid pairs.

### Confirmation commitment level

Transactions are confirmed at `"confirmed"` (not `"finalized"`) for latency reasons. The engine checks `result.value.err` immediately after confirmation and throws on any on-chain error, including:

- `6025` / `0x1789` — `SlippageToleranceExceeded`
- Any other custom program error

Slippage errors trigger the retry loop. All other errors propagate.

### Balance management

```
KEEP_SOL = 0.013
│
├── 0.010  Low-balance auto-pause floor
└── 0.003  Priority fee buffer for the sell transaction

solAmount = min(settings.maxTradeSol, walletSol − KEEP_SOL)

If solAmount < 0.005 → skip (not enough to buy meaningfully)
```

The agent fetches the wallet balance:
- At the start of every scan cycle (accurate sizing)
- Before every `executeBuy()` (final guard)
- After every buy/sell
- On a 15-second background timer (UI accuracy)

### Concurrent scan guard

```ts
private async runScan() {
  if (this._scannerActive) return;   // ← guard
  this._scannerActive = true;
  // ...
}
```

This prevents a slow scan cycle (long Researcher queue) from overlapping with the next timer-triggered cycle.

### Trade history storage

- In-memory: `_trades[]`, unlimited during session
- `state.trades`: last 50 records exposed to UI
- localStorage: last 200 records serialised as JSON
- PostgreSQL: full history, upserted with `ON CONFLICT DO NOTHING`

---

*D3FAULT — trade in the shadows.*
