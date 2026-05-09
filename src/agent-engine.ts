import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { withRpcFallback } from "./connection";

/* ─── External API URLs (proxied through backend to avoid CORS/CSP blocks) ── */
const SOL_MINT       = "So11111111111111111111111111111111111111112";
const JUP_QUOTE      = "/api/agent/jup-quote";
const JUP_SWAP       = "/api/agent/jup-swap";
const DEX_TOKEN      = "/api/agent/dex-tokens/";
const DEX_PROFILES   = "/api/agent/dex-profiles";
const PUMP_LIST      = "/api/agent/pump-list";
const PUMP_TOP       = "/api/agent/pump-top";
const PUMP_COIN      = "/api/agent/pump-coin/";
const CG_TRENDING    = "/api/agent/cg-trending";

/* ─── Wallet Signer interface ───────────────────────────────────────────── */
export interface WalletSigner {
  publicKey: string;
  sendVersionedTx: (tx: VersionedTransaction) => Promise<string>;
}

/* ─── Phase log ─────────────────────────────────────────────────────────── */
export type PhaseLogKind = "info" | "success" | "warn" | "error" | "scan" | "exec";

export interface PhaseLog {
  id: string;
  kind: PhaseLogKind;
  msg: string;
  ts: number;
  token?: string;
}

/* ─── Data types ─────────────────────────────────────────────────────────── */
export interface TokenOpportunity {
  mint: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  score: number;
  priceUsd: number;
  mcapUsd: number;
  volume1h: number;
  liquidity: number;
  priceChange5m: number;
  priceChange1h: number;
  buys1h: number;
  sells1h: number;
  ageMin: number;
  topHolderPct: number;
  dexUrl: string;
  pumpUrl: string;
  discoveredAt: number;
  willBuy: boolean;
  skipReason?: string;
  researchNotes: string[];
}

export interface Position {
  id: string;
  mint: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  entryPriceUsd: number;
  entryAmountSol: number;
  tokenAmount: number;
  openedAt: number;
  currentPriceUsd: number;
  entryMcapUsd: number;
  currentMcapUsd: number;
  pnlPct: number;
  pnlSol: number;
  highPnlPct: number;
  sig: string;
}

export interface TradeRecord {
  id: string;
  mint: string;
  symbol: string;
  name?: string;
  imageUrl?: string;
  side: "buy" | "sell";
  amountSol: number;
  priceUsd: number;
  pnlPct?: number;
  pnlSol?: number;
  sig: string;
  ts: number;
  reason?: string;
  durationMs?: number;
}

export interface AgentSettings {
  /* Trade sizing */
  maxTradeSol: number;
  maxLossSol: number;
  maxPositions: number;
  /* Exit strategy */
  takeProfitPct: number;
  stopLossPct: number;
  instantProfitPct: number;
  trailingStopPct: number;
  /* Token filters */
  minMcapK: number;
  maxMcapK: number;
  minVolume1hK: number;
  minLiquidityK: number;
  maxAgeMin: number;
  minBuyRatio: number;
  /* Quality gate */
  minScore: number;
  /* Execution */
  slippageBps: number;
  priorityFeeLamports: number;
  scanIntervalSec: number;
  /* Protection */
  whaleFilterEnabled: boolean;
  blacklistedMints: string[];
}

export interface EngineState {
  status: "idle" | "running" | "error";
  scannerActive: boolean;
  researcherActive: boolean;
  executorActive: boolean;
  scannerLog: PhaseLog[];
  researcherLog: PhaseLog[];
  executorLog: PhaseLog[];
  opportunities: TokenOpportunity[];
  positions: Position[];
  trades: TradeRecord[];
  totalPnlSol: number;
  buyingMint: string | null;
  walletSol: number;
  scannedCount: number;
  approvedCount: number;
  error?: string;
}

export const DEFAULT_SETTINGS: AgentSettings = {
  maxTradeSol:          0.1,
  maxLossSol:           0.5,
  maxPositions:         2,
  takeProfitPct:        40,
  stopLossPct:          15,
  instantProfitPct:     70,
  trailingStopPct:      10,
  minMcapK:             10,
  maxMcapK:             500,
  minVolume1hK:         5,
  minLiquidityK:        2,
  maxAgeMin:            240,
  minBuyRatio:          1.2,
  minScore:             62,
  slippageBps:          800,
  priorityFeeLamports:  300_000,
  scanIntervalSec:      90,
  whaleFilterEnabled:   false,
  blacklistedMints:     [],
};

export const CONSERVATIVE_PRESET: AgentSettings = {
  maxTradeSol:          0.05,
  maxLossSol:           0.2,
  maxPositions:         1,
  takeProfitPct:        30,
  stopLossPct:          10,
  instantProfitPct:     50,
  trailingStopPct:      8,
  minMcapK:             20,
  maxMcapK:             200,
  minVolume1hK:         10,
  minLiquidityK:        5,
  maxAgeMin:            120,
  minBuyRatio:          1.5,
  minScore:             70,
  slippageBps:          600,
  priorityFeeLamports:  200_000,
  scanIntervalSec:      120,
  whaleFilterEnabled:   true,
  blacklistedMints:     [],
};

export const DEGEN_PRESET: AgentSettings = {
  maxTradeSol:          0.2,
  maxLossSol:           1.0,
  maxPositions:         4,
  takeProfitPct:        80,
  stopLossPct:          20,
  instantProfitPct:     120,
  trailingStopPct:      15,
  minMcapK:             5,
  maxMcapK:             1000,
  minVolume1hK:         2,
  minLiquidityK:        1,
  maxAgeMin:            480,
  minBuyRatio:          1.0,
  minScore:             45,
  slippageBps:          1500,
  priorityFeeLamports:  500_000,
  scanIntervalSec:      60,
  whaleFilterEnabled:   false,
  blacklistedMints:     [],
};

export const SNIPER_PRESET: AgentSettings = {
  maxTradeSol:          0.15,
  maxLossSol:           0.3,
  maxPositions:         2,
  takeProfitPct:        60,
  stopLossPct:          12,
  instantProfitPct:     80,
  trailingStopPct:      12,
  minMcapK:             10,
  maxMcapK:             100,
  minVolume1hK:         15,
  minLiquidityK:        8,
  maxAgeMin:            60,
  minBuyRatio:          2.0,
  minScore:             72,
  slippageBps:          1000,
  priorityFeeLamports:  400_000,
  scanIntervalSec:      45,
  whaleFilterEnabled:   true,
  blacklistedMints:     [],
};

/* ─── DexScreener types ─────────────────────────────────────────────────── */
interface DexPair {
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
  volume?: { h1?: number; h24?: number };
  txns?: { h1?: { buys?: number; sells?: number } };
  priceChange?: { m5?: number; h1?: number };
  pairCreatedAt?: number;
  url?: string;
  baseToken?: { symbol?: string; name?: string; address?: string };
  info?: { imageUrl?: string; socials?: { type?: string; url?: string }[] };
}

interface PumpCoin {
  mint?: string;
  symbol?: string;
  name?: string;
  usd_market_cap?: number;
  virtual_sol_reserves?: number;
  created_timestamp?: number;
  king_of_the_hill_timestamp?: number;
  reply_count?: number;
}

/* ─── Scoring (optimised for 2-3x potential from current MCap) ──────────── */
function scoreToken(params: {
  ageMin: number;
  volume1h: number;
  liquidity: number;
  priceChange5m: number;
  priceChange1h: number;
  buys1h: number;
  sells1h: number;
  mcapUsd: number;
  topHolderPct: number;
  hasSocials: boolean;
  hasKOTH: boolean;
}): { score: number; notes: string[] } {
  const {
    ageMin, volume1h, liquidity, priceChange5m, priceChange1h,
    buys1h, sells1h, mcapUsd, topHolderPct, hasSocials, hasKOTH,
  } = params;
  let s = 0;
  const notes: string[] = [];

  /* ── Volume 1h (0-25 pts) ─── */
  if (volume1h > 200_000)      { s += 25; notes.push("Massive volume (>$200K/h)"); }
  else if (volume1h > 80_000)  { s += 20; notes.push("High volume (>$80K/h)"); }
  else if (volume1h > 30_000)  { s += 15; notes.push("Good volume (>$30K/h)"); }
  else if (volume1h > 10_000)  { s += 10; }
  else if (volume1h > 4_000)   { s += 5;  }
  else { notes.push("Low volume (<$4K/h)"); }

  /* ── Volume velocity vs MCap (0-15 pts) — key 2-3x signal ─── */
  if (mcapUsd > 0 && volume1h > 0) {
    const volMcapRatio = volume1h / mcapUsd;
    if (volMcapRatio > 1.5)      { s += 15; notes.push(`Hot vol/mcap ratio ${volMcapRatio.toFixed(1)}x`); }
    else if (volMcapRatio > 0.8) { s += 10; notes.push(`Strong vol/mcap ${volMcapRatio.toFixed(1)}x`); }
    else if (volMcapRatio > 0.4) { s += 6; }
    else if (volMcapRatio > 0.15){ s += 2; }
  }

  /* ── Liquidity (0-15 pts) ─── */
  if (liquidity > 80_000)      { s += 15; notes.push("Deep liquidity"); }
  else if (liquidity > 30_000) { s += 12; }
  else if (liquidity > 10_000) { s += 8; }
  else if (liquidity > 3_000)  { s += 4;  }
  else if (liquidity > 500)    { s += 1;  }
  else { notes.push("Thin liquidity (<$500)"); }

  /* ── MCap sweet spot for 2-3x (0-12 pts) ─── */
  const mcapK = mcapUsd / 1000;
  if (mcapK >= 15 && mcapK <= 100) {
    s += 12; notes.push(`Sweet spot MCap $${mcapK.toFixed(0)}K`);
  } else if (mcapK > 100 && mcapK <= 300) {
    s += 8; notes.push(`Mid MCap $${mcapK.toFixed(0)}K`);
  } else if (mcapK > 300 && mcapK <= 600) {
    s += 3;
  } else if (mcapK > 600) {
    notes.push(`High MCap $${mcapK.toFixed(0)}K — harder to 2x`);
  }

  /* ── Age bonus: 10-90 min is the prime entry window (0-12 pts) ─── */
  if (ageMin >= 10 && ageMin < 30)       { s += 12; notes.push("Prime entry window (10-30 min)"); }
  else if (ageMin >= 30 && ageMin < 60)  { s += 9;  notes.push("Early stage (30-60 min)"); }
  else if (ageMin >= 5  && ageMin < 10)  { s += 7;  }
  else if (ageMin >= 60 && ageMin < 90)  { s += 6;  }
  else if (ageMin >= 90 && ageMin < 180) { s += 3;  }
  else if (ageMin < 5)                    { s += 4;  notes.push("Very new — high risk"); }
  else if (ageMin > 720)                  { notes.push("Token >12h old"); }

  /* ── Price momentum 5m (0-12 pts) ─── */
  if (priceChange5m > 50)       { s += 12; notes.push("Very strong 5m momentum"); }
  else if (priceChange5m > 25)  { s += 9;  notes.push("Strong 5m momentum"); }
  else if (priceChange5m > 10)  { s += 6;  }
  else if (priceChange5m > 2)   { s += 3;  }
  else if (priceChange5m < -20) { s -= 10; notes.push("Negative 5m dump"); }
  else if (priceChange5m < -8)  { s -= 5;  }

  /* ── 1h price trend (0-8 pts) ─── */
  if (priceChange1h > 80)       { s += 8;  notes.push("Strong 1h uptrend"); }
  else if (priceChange1h > 40)  { s += 6;  }
  else if (priceChange1h > 15)  { s += 4;  }
  else if (priceChange1h > 5)   { s += 2;  }
  else if (priceChange1h < -30) { s -= 8;  notes.push("Downtrend 1h"); }
  else if (priceChange1h < -10) { s -= 3;  }

  /* ── Buy pressure (0-12 pts) ─── */
  if (buys1h > 0) {
    const ratio = buys1h / Math.max(sells1h, 1);
    if (ratio > 5)      { s += 12; notes.push(`High buy ratio ${ratio.toFixed(1)}x`); }
    else if (ratio > 3) { s += 8;  notes.push(`Buy ratio ${ratio.toFixed(1)}x`); }
    else if (ratio > 2) { s += 5;  }
    else if (ratio > 1.2) { s += 2; }
    else if (ratio < 0.6) { s -= 6;  notes.push("Heavy sell pressure"); }
    /* Honeypot: many buys, almost no sells after >30min */
    if (sells1h < 3 && buys1h > 40 && ageMin > 30) {
      s -= 18; notes.push("Honeypot flag: sells blocked?");
    }
  } else if (ageMin > 15) {
    notes.push("No buy activity");
  }

  /* ── Social presence (+5) ─── */
  if (hasSocials) { s += 5; notes.push("Has social links"); }

  /* ── King of the Hill (pump.fun) bonus (+6) ─── */
  if (hasKOTH) { s += 6; notes.push("King of the Hill on pump.fun"); }

  /* ── Scam deductions ─── */
  if (topHolderPct > 50)      { s -= 22; notes.push(`Top holder ${topHolderPct.toFixed(0)}% — rug risk`); }
  else if (topHolderPct > 30) { s -= 10; notes.push(`Top holder ${topHolderPct.toFixed(0)}% — concentrated`); }
  else if (topHolderPct > 0)  { notes.push(`Top holder ${topHolderPct.toFixed(0)}%`); }

  /* ── FDV/Liquidity sanity check ─── */
  if (mcapUsd > 0 && liquidity > 0) {
    const fdvLiqRatio = mcapUsd / liquidity;
    if (fdvLiqRatio > 1000) { s -= 12; notes.push("Extreme MCap/Liq ratio"); }
    else if (fdvLiqRatio > 300) { s -= 5; notes.push("High MCap/Liq ratio"); }
  }

  /* ── Extreme pump & dump signal ─── */
  if (priceChange5m > 500) { s -= 18; notes.push("500%+ 5m pump — dump likely"); }
  else if (priceChange5m > 200) { s -= 8; notes.push("200%+ 5m pump — caution"); }

  return { score: Math.max(0, Math.min(100, Math.round(s))), notes };
}

/* ─── Data fetchers ──────────────────────────────────────────────────────── */
async function fetchDex(mint: string): Promise<DexPair | null> {
  try {
    const r = await fetch(`${DEX_TOKEN}${mint}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.pairs ?? [])[0] ?? null;
  } catch { return null; }
}

async function fetchPumpCoin(mint: string): Promise<PumpCoin | null> {
  try {
    const r = await fetch(`${PUMP_COIN}${mint}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchPumpList(url: string): Promise<PumpCoin[]> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    return await r.json() as PumpCoin[];
  } catch { return []; }
}

async function fetchCGTrending(): Promise<string[]> {
  try {
    const r = await fetch(CG_TRENDING, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const d = await r.json();
    const coins: Array<{ item?: { platforms?: Record<string, string> } }> = d.coins ?? [];
    return coins
      .map(c => c.item?.platforms?.["solana"])
      .filter((a): a is string => !!a);
  } catch { return []; }
}

/* ─── helpers ────────────────────────────────────────────────────────────── */
function isSlippageError(err: unknown): boolean {
  const s = String(err).toLowerCase();
  return (
    s.includes("6025") ||
    s.includes("slippage") ||
    s.includes("0x1789") ||
    (s.includes("custom program error") && s.includes("1789"))
  );
}

function isSimulationError(err: unknown): boolean {
  const s = String(err).toLowerCase();
  return (
    s.includes("simulation failed") ||
    s.includes("simulatetransaction") ||
    (s.includes("custom program error") && !s.includes("1789"))
  );
}

async function confirmAndCheck(sig: string): Promise<void> {
  const result = await withRpcFallback(c => c.confirmTransaction(sig, "confirmed"));
  if (result.value.err) {
    const errStr = JSON.stringify(result.value.err);
    if (errStr.includes("6025") || errStr.includes("1789")) {
      throw new Error(`SlippageToleranceExceeded (6025): ${errStr}`);
    }
    throw new Error(`Transaction failed on-chain: ${errStr}`);
  }
}

/* ─── Jupiter swap ───────────────────────────────────────────────────────── */
async function jupiterBuy(
  signer: WalletSigner,
  mint: string,
  solAmount: number,
  slippageBps = 800,
  priorityFeeLamports = 300_000,
  _attempt = 0,
  _onRetry?: (attempt: number, bps: number) => void,
): Promise<{ sig: string; tokenAmount: number }> {
  const effectiveBps = Math.min(Math.round(slippageBps * Math.pow(1.6, _attempt)), 5000);
  const lamports = Math.floor(solAmount * 1e9);

  const qr = await fetch(
    `${JUP_QUOTE}?inputMint=${SOL_MINT}&outputMint=${mint}&amount=${lamports}&slippageBps=${effectiveBps}&onlyDirectRoutes=false`,
    { signal: AbortSignal.timeout(12000) },
  );
  if (!qr.ok) throw new Error(`Jupiter quote error: ${qr.status}`);
  const quote = await qr.json();
  if (quote.error) throw new Error(`Jupiter: ${quote.error}`);

  const sr = await fetch(JUP_SWAP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: signer.publicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: priorityFeeLamports,
      dynamicSlippage: { minBps: 50, maxBps: Math.min(effectiveBps * 2, 5000) },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!sr.ok) throw new Error(`Jupiter swap error: ${sr.status}`);
  const { swapTransaction } = await sr.json();

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));

  let sig: string;
  try {
    sig = await signer.sendVersionedTx(tx);
  } catch (e) {
    if ((isSimulationError(e) || isSlippageError(e)) && _attempt < 2) {
      const nextBps = Math.min(Math.round(slippageBps * Math.pow(1.6, _attempt + 1)), 5000);
      _onRetry?.(_attempt + 1, nextBps);
      return jupiterBuy(signer, mint, solAmount, slippageBps, priorityFeeLamports, _attempt + 1, _onRetry);
    }
    throw e;
  }

  try {
    await confirmAndCheck(sig);
  } catch (e) {
    if (isSlippageError(e) && _attempt < 2) {
      const nextBps = Math.min(Math.round(slippageBps * Math.pow(1.6, _attempt + 1)), 5000);
      _onRetry?.(_attempt + 1, nextBps);
      return jupiterBuy(signer, mint, solAmount, slippageBps, priorityFeeLamports, _attempt + 1, _onRetry);
    }
    throw e;
  }

  const outAmount = parseInt(quote.outAmount ?? "0");
  const decimals  = parseInt(quote.outputDecimals ?? "6");
  return { sig, tokenAmount: outAmount / Math.pow(10, decimals) };
}

async function jupiterSell(
  signer: WalletSigner,
  mint: string,
  tokenAmount: number,
  decimals = 6,
  slippageBps = 1200,
  priorityFeeLamports = 300_000,
  _attempt = 0,
  _onRetry?: (attempt: number, bps: number) => void,
): Promise<{ sig: string; solReceived: number }> {
  const effectiveBps = Math.min(Math.round(slippageBps * Math.pow(1.6, _attempt)), 5000);
  const amountRaw = Math.floor(tokenAmount * Math.pow(10, decimals));

  const qr = await fetch(
    `${JUP_QUOTE}?inputMint=${mint}&outputMint=${SOL_MINT}&amount=${amountRaw}&slippageBps=${effectiveBps}`,
    { signal: AbortSignal.timeout(12000) },
  );
  if (!qr.ok) throw new Error(`Jupiter quote error: ${qr.status}`);
  const quote = await qr.json();
  if (quote.error) throw new Error(`Jupiter: ${quote.error}`);

  const sr = await fetch(JUP_SWAP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: signer.publicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: priorityFeeLamports,
      dynamicSlippage: { minBps: 50, maxBps: Math.min(effectiveBps * 2, 5000) },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!sr.ok) throw new Error(`Jupiter swap error: ${sr.status}`);
  const { swapTransaction } = await sr.json();

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));

  let sig: string;
  try {
    sig = await signer.sendVersionedTx(tx);
  } catch (e) {
    if ((isSimulationError(e) || isSlippageError(e)) && _attempt < 2) {
      const nextBps = Math.min(Math.round(slippageBps * Math.pow(1.6, _attempt + 1)), 5000);
      _onRetry?.(_attempt + 1, nextBps);
      return jupiterSell(signer, mint, tokenAmount, decimals, slippageBps, priorityFeeLamports, _attempt + 1, _onRetry);
    }
    throw e;
  }

  try {
    await confirmAndCheck(sig);
  } catch (e) {
    if (isSlippageError(e) && _attempt < 2) {
      const nextBps = Math.min(Math.round(slippageBps * Math.pow(1.6, _attempt + 1)), 5000);
      _onRetry?.(_attempt + 1, nextBps);
      return jupiterSell(signer, mint, tokenAmount, decimals, slippageBps, priorityFeeLamports, _attempt + 1, _onRetry);
    }
    throw e;
  }

  return { sig, solReceived: parseInt(quote.outAmount ?? "0") / 1e9 };
}

/* ─── AgentEngine ────────────────────────────────────────────────────────── */
export class AgentEngine {
  private signer: WalletSigner;
  private settings: AgentSettings;
  private onUpdate: (state: EngineState) => void;

  private _status: EngineState["status"] = "idle";
  private _scannerActive    = false;
  private _researcherActive = false;
  private _executorActive   = false;
  private _scannerLog:    PhaseLog[] = [];
  private _researcherLog: PhaseLog[] = [];
  private _executorLog:   PhaseLog[] = [];
  private _opportunities:  TokenOpportunity[] = [];
  private _positions:      Map<string, Position> = new Map();
  private _trades:         TradeRecord[] = [];
  private _walletSol       = 0;
  private positionsKey     = "";
  private tradesKey        = "";
  private _buyingMint:     string | null = null;
  private _error?:         string;
  private _scannedCount    = 0;
  private _approvedCount   = 0;
  private buyLock          = false;
  private totalLostSol     = 0;
  private startedAt:       number | null = null;
  private monitorTimer:    ReturnType<typeof setInterval> | null = null;
  private scanTimer:       ReturnType<typeof setInterval> | null = null;
  private balanceTimer:    ReturnType<typeof setInterval> | null = null;

  constructor(
    signer: WalletSigner,
    settings: AgentSettings,
    onUpdate: (s: EngineState) => void,
  ) {
    this.signer      = signer;
    this.settings    = settings;
    this.onUpdate    = onUpdate;
    this.positionsKey = `d3f:openPositions:${signer.publicKey}`;
    this.tradesKey    = `d3f:trades:${signer.publicKey}`;
    /* Restore positions + trade history that survived a page refresh */
    try {
      const raw = localStorage.getItem(this.positionsKey);
      if (raw) {
        const arr: Position[] = JSON.parse(raw);
        arr.forEach(p => this._positions.set(p.mint, p));
      }
    } catch {}
    try {
      const raw = localStorage.getItem(this.tradesKey);
      if (raw) this._trades = JSON.parse(raw);
    } catch {}
  }

  private persistPositions(): void {
    try {
      const arr = [...this._positions.values()];
      if (arr.length === 0) localStorage.removeItem(this.positionsKey);
      else localStorage.setItem(this.positionsKey, JSON.stringify(arr));
      /* Fire-and-forget DB sync */
      void fetch(`/api/agent/data/${this.signer.publicKey}/positions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arr),
      }).catch(() => {});
    } catch {}
  }

  private persistTrades(): void {
    try {
      const slice = this._trades.slice(0, 200);
      if (slice.length === 0) localStorage.removeItem(this.tradesKey);
      else localStorage.setItem(this.tradesKey, JSON.stringify(slice));
      /* Fire-and-forget DB sync — only push the newest trade (index 0) */
      if (slice.length > 0) {
        void fetch(`/api/agent/data/${this.signer.publicKey}/trades`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slice.slice(0, 1)),
        }).catch(() => {});
      }
    } catch {}
  }

  get state(): EngineState {
    return {
      status:           this._status,
      scannerActive:    this._scannerActive,
      researcherActive: this._researcherActive,
      executorActive:   this._executorActive,
      scannerLog:       this._scannerLog.slice(-80),
      researcherLog:    this._researcherLog.slice(-80),
      executorLog:      this._executorLog.slice(-80),
      opportunities:    this._opportunities.slice(0, 50),
      positions:        [...this._positions.values()],
      trades:           this._trades.slice(0, 50),
      totalPnlSol:      this._trades
        .filter(t => t.side === "sell" && t.pnlSol !== undefined)
        .reduce((s, t) => s + (t.pnlSol ?? 0), 0),
      walletSol:     this._walletSol,
      buyingMint:    this._buyingMint,
      scannedCount:  this._scannedCount,
      approvedCount: this._approvedCount,
      error:         this._error,
    };
  }

  updateSettings(s: AgentSettings) {
    this.settings = s;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = setInterval(() => { void this.runScan(); }, s.scanIntervalSec * 1000);
    }
  }
  updateSigner(s: WalletSigner) { this.signer = s; }

  start() {
    this._status        = "running";
    this._error         = undefined;
    this._scannedCount  = 0;
    this._approvedCount = 0;
    this.startedAt      = Date.now();
    this.phaseLog("scanner",  "info", "▶ Scanner started — querying DexScreener + pump.fun + CoinGecko…");
    this.phaseLog("researcher","info", "▶ Researcher ready — scoring model: 2-3x MCap momentum filter.");
    this.phaseLog("executor", "info", "▶ Executor online — Jupiter swaps with configurable slippage.");
    this.emit();
    /* Fetch balance first, then kick off the first scan once we know the wallet SOL */
    void this.fetchBalance().then(() => {
      if (this._status !== "running") return;
      void this.runScan();
    });
    this.scanTimer    = setInterval(() => { void this.runScan(); }, this.settings.scanIntervalSec * 1000);
    this.monitorTimer = setInterval(() => { void this.monitorPositions(); }, 6_000);
    this.balanceTimer = setInterval(() => { void this.fetchBalance(); }, 15_000);
  }

  stop() {
    this._status           = "idle";
    this._scannerActive    = false;
    this._researcherActive = false;
    this._executorActive   = false;
    this._buyingMint       = null;
    if (this.scanTimer)    { clearInterval(this.scanTimer);    this.scanTimer    = null; }
    if (this.monitorTimer) { clearInterval(this.monitorTimer); this.monitorTimer = null; }
    if (this.balanceTimer) { clearInterval(this.balanceTimer); this.balanceTimer = null; }
    this.phaseLog("executor", "warn", "■ Agent stopped by operator.");
    this.emit();
  }

  /* ─── Helpers ─────────────────────────────────────────────────── */
  private phaseLog(
    phase: "scanner" | "researcher" | "executor",
    kind: PhaseLogKind,
    msg: string,
    token?: string,
  ) {
    const entry: PhaseLog = { id: crypto.randomUUID(), kind, msg, ts: Date.now(), token };
    if (phase === "scanner") {
      this._scannerLog.push(entry);
      if (this._scannerLog.length > 100) this._scannerLog = this._scannerLog.slice(-100);
    } else if (phase === "researcher") {
      this._researcherLog.push(entry);
      if (this._researcherLog.length > 100) this._researcherLog = this._researcherLog.slice(-100);
    } else {
      this._executorLog.push(entry);
      if (this._executorLog.length > 100) this._executorLog = this._executorLog.slice(-100);
    }
  }

  private emit() { this.persistPositions(); this.persistTrades(); this.onUpdate(this.state); }

  private async fetchBalance(): Promise<void> {
    try {
      const b = await withRpcFallback(c => c.getBalance(new PublicKey(this.signer.publicKey)));
      this._walletSol = b / 1e9;
      this.emit();
      /* Auto-pause if balance drops critically low — but NEVER while a
         position is open; let the position monitor sell first. */
      if (this._status === "running" && this._walletSol < 0.01 && this._positions.size === 0) {
        this.phaseLog("executor", "warn",
          `⚠ LOW_BALANCE PAUSE ── wallet ${this._walletSol.toFixed(4)} SOL < 0.01 threshold — agent paused. Fund to resume.`);
        this.stop();
      }
    } catch {}
  }

  /* ─── Phase 1: Scanner ─────────────────────────────────────────── */
  private async runScan() {
    if (this._status !== "running") return;
    if (this._scannerActive) return;           /* prevent concurrent scan cycles */
    this._scannerActive = true;
    this.emit();

    /* Refresh balance at the start of every scan cycle so the researcher
       skip-guard and executor have an accurate wallet balance */
    await this.fetchBalance();
    if (this._status !== "running") { this._scannerActive = false; this.emit(); return; }

    this.phaseLog("scanner", "scan", "SCAN_CYCLE_START ─── fetching DEX profiles…");

    let dexMints: string[] = [];
    try {
      const r = await fetch(DEX_PROFILES, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const profiles = await r.json() as Array<{ chainId?: string; tokenAddress?: string }>;
        dexMints = profiles
          .filter(p => p.chainId === "solana" && p.tokenAddress)
          .map(p => p.tokenAddress as string);
        this.phaseLog("scanner", "info", `DEX_SCREENER ── ${dexMints.length} boosted Solana tokens found`);
      }
    } catch { this.phaseLog("scanner", "warn", "DEX_SCREENER ── profiles endpoint unavailable"); }

    this.phaseLog("scanner", "scan", "PUMP_FUN ─── fetching recent + top launches…");
    const [recentPump, topPump] = await Promise.all([
      fetchPumpList(PUMP_LIST),
      fetchPumpList(PUMP_TOP),
    ]);
    this.phaseLog("scanner", "info", `PUMP_FUN ── ${recentPump.length} recent + ${topPump.length} top MCap coins`);

    this.phaseLog("scanner", "scan", "COINGECKO ─── fetching trending Solana tokens…");
    const cgMints = await fetchCGTrending();
    if (cgMints.length > 0) {
      this.phaseLog("scanner", "info", `COINGECKO ── ${cgMints.length} trending Solana mints`);
    } else {
      this.phaseLog("scanner", "info", "COINGECKO ── no trending Solana results");
    }

    const seen = new Set<string>();
    const candidates: Array<{ mint: string; coin?: PumpCoin }> = [];

    for (const mint of [...dexMints, ...cgMints]) {
      if (mint && !seen.has(mint)) { seen.add(mint); candidates.push({ mint }); }
    }
    for (const coin of [...recentPump, ...topPump]) {
      if (coin.mint && !seen.has(coin.mint)) {
        seen.add(coin.mint); candidates.push({ mint: coin.mint, coin });
      }
    }

    this.phaseLog("scanner", "scan", `PIPELINE ─── ${candidates.length} unique candidates → Researcher queue`);
    this._scannerActive = false;
    this.emit();

    for (const c of candidates) {
      if (this._status !== "running") break;
      this._scannedCount++;
      await this.runResearch(c.mint, c.coin);
      await new Promise(r => setTimeout(r, 180));
    }

    if (this._status === "running") {
      this.phaseLog("scanner", "info", `SCAN_CYCLE_END ─── ${this._scannedCount} total scanned, ${this._approvedCount} approved`);
    }
  }

  /* ─── Phase 2: Researcher ──────────────────────────────────────── */
  private async runResearch(mint: string, pumpHint?: PumpCoin) {
    if (this._status !== "running") return;
    this._researcherActive = true;
    this.emit();

    const [dex, pump] = await Promise.all([
      fetchDex(mint),
      (!pumpHint?.symbol) ? fetchPumpCoin(mint).catch(() => null) : Promise.resolve(pumpHint),
    ]);

    const symbol   = pumpHint?.symbol || pump?.symbol || dex?.baseToken?.symbol || mint.slice(0, 6).toUpperCase();
    const name     = pumpHint?.name   || pump?.name   || dex?.baseToken?.name   || symbol;
    const imageUrl = dex?.info?.imageUrl;

    /* Blacklist check */
    if (this.settings.blacklistedMints.includes(mint)) {
      this.phaseLog("researcher", "warn", `BLACKLISTED ── ${symbol} skipped (user blacklist)`);
      this._researcherActive = false; this.emit(); return;
    }

    const priceUsd      = parseFloat(dex?.priceUsd ?? "0") || 0;
    const mcapUsd       = dex?.marketCap ?? dex?.fdv ?? pumpHint?.usd_market_cap ?? 0;
    const volume1h      = dex?.volume?.h1 ?? 0;
    const liquidity     = dex?.liquidity?.usd ?? (
      pumpHint?.virtual_sol_reserves ? pumpHint.virtual_sol_reserves / 1e9 * 160 : 0
    );
    const priceChange5m = dex?.priceChange?.m5 ?? 0;
    const priceChange1h = dex?.priceChange?.h1 ?? 0;
    const buys1h        = dex?.txns?.h1?.buys ?? 0;
    const sells1h       = dex?.txns?.h1?.sells ?? 0;

    const createdTs = pumpHint?.created_timestamp
      ? pumpHint.created_timestamp * 1000
      : (dex?.pairCreatedAt ?? Date.now());
    const ageMin = (Date.now() - createdTs) / 60_000;

    /* Quick reject — dead token */
    if (liquidity === 0 && volume1h === 0) { this._researcherActive = false; this.emit(); return; }

    const hasSocials = (dex?.info?.socials?.length ?? 0) > 0;
    const hasKOTH    = !!pumpHint?.king_of_the_hill_timestamp || !!(pump as PumpCoin | null)?.king_of_the_hill_timestamp;
    const topHolderPct = 0;

    const { score, notes } = scoreToken({
      ageMin, volume1h, liquidity, priceChange5m, priceChange1h,
      buys1h, sells1h, mcapUsd, topHolderPct, hasSocials, hasKOTH,
    });

    const mcapK   = mcapUsd / 1000;
    const volK    = volume1h / 1000;
    const liqK    = liquidity / 1000;
    const buyRatio = buys1h / Math.max(sells1h, 1);

    this.phaseLog(
      "researcher",
      score >= this.settings.minScore ? "success" : "info",
      `${symbol.padEnd(8)} │ score:${score.toString().padStart(3)} │ mcap:$${mcapK.toFixed(0)}K │ vol:$${volK.toFixed(0)}K/h │ liq:$${liqK.toFixed(0)}K │ B/S:${buyRatio.toFixed(1)}x`,
      symbol,
    );

    /* Determine skip reason using all configured filters */
    /* Whale filter — heavy sell pressure = whale dumping signal */
    const whaleSellPressure = sells1h > buys1h * 2 && sells1h > 20;

    let skipReason: string | undefined;
    if (ageMin < 3)                                             skipReason = `Too new (${ageMin.toFixed(1)}min)`;
    else if (ageMin > this.settings.maxAgeMin)                  skipReason = `Too old (${(ageMin / 60).toFixed(1)}h)`;
    else if (score < this.settings.minScore)                    skipReason = `Score ${score} < ${this.settings.minScore} threshold`;
    else if (mcapK < this.settings.minMcapK)                   skipReason = `MCap $${mcapK.toFixed(1)}K < min $${this.settings.minMcapK}K`;
    else if (mcapK > this.settings.maxMcapK)                   skipReason = `MCap $${mcapK.toFixed(1)}K > max $${this.settings.maxMcapK}K`;
    else if (volume1h < this.settings.minVolume1hK * 1000)     skipReason = `Vol $${volK.toFixed(1)}K/h < min $${this.settings.minVolume1hK}K`;
    else if (liquidity < this.settings.minLiquidityK * 1000)   skipReason = `Liq $${liqK.toFixed(1)}K < min $${this.settings.minLiquidityK}K`;
    else if (buyRatio < this.settings.minBuyRatio && buys1h > 5) skipReason = `Buy ratio ${buyRatio.toFixed(1)}x < ${this.settings.minBuyRatio}x`;
    else if (this.settings.whaleFilterEnabled && whaleSellPressure) skipReason = `Whale dump signal (${sells1h}s vs ${buys1h}b)`;
    else if (this._positions.size >= this.settings.maxPositions) skipReason = `Max ${this.settings.maxPositions} positions reached`;
    else if (this.totalLostSol >= this.settings.maxLossSol)    skipReason = "Daily loss limit reached";
    else if (this._walletSol <= 0.018)                         skipReason = "Insufficient wallet balance";
    else if (notes.some(n => n.includes("Honeypot")))          skipReason = "Honeypot flag";
    else if (notes.some(n => n.includes("rug risk")))          skipReason = "Rug risk — top holder";
    else if (notes.some(n => n.includes("500%+")))             skipReason = "Extreme pump — dump likely";

    /* ── 5-min first-entry relaxation: if no position after 5 min, soften filters ── */
    if (skipReason && this._positions.size === 0 && this.startedAt && (Date.now() - this.startedAt) > 300_000) {
      const hardStop = [
        "Daily loss limit reached", "Insufficient wallet balance",
        `Max ${this.settings.maxPositions} positions reached`,
      ];
      const isSafety = hardStop.includes(skipReason)
        || notes.some(n => n.includes("Honeypot") || n.includes("rug risk") || n.includes("500%+"));
      if (!isSafety && score >= 30) {
        this.phaseLog("researcher", "warn",
          `FORCED_ENTRY ── ${symbol} │ 5min no-position mode │ score:${score} │ was: ${skipReason}`, symbol);
        skipReason = undefined;
      }
    }

    const opp: TokenOpportunity = {
      mint, symbol, name, imageUrl, score, priceUsd, mcapUsd, volume1h, liquidity,
      priceChange5m, priceChange1h, buys1h, sells1h, ageMin, topHolderPct,
      dexUrl:  dex?.url ?? `https://dexscreener.com/solana/${mint}`,
      pumpUrl: `https://pump.fun/coin/${mint}`,
      discoveredAt: Date.now(),
      willBuy: !skipReason,
      skipReason,
      researchNotes: notes,
    };

    this._opportunities = [opp, ...this._opportunities.filter(o => o.mint !== mint)].slice(0, 60);
    this._researcherActive = false;
    this.emit();

    if (!skipReason) {
      this._approvedCount++;
      this.phaseLog("researcher", "success", `✓ ${symbol} APPROVED → Executor | score:${score} | ${notes.slice(0, 2).join(" · ")}`, symbol);
      await this.executeBuy(opp);
    }
  }

  /* ─── Phase 3: Executor — Buy ──────────────────────────────────── */
  private async executeBuy(opp: TokenOpportunity) {
    if (this.buyLock || this._positions.has(opp.mint)) return;
    this.buyLock     = true;
    this._buyingMint = opp.mint;
    this._executorActive = true;
    this.emit();

    try {
      await this.fetchBalance();
      /* Reserve 0.013 SOL (0.01 LOW_BALANCE floor + 0.003 sell-fee buffer)
         so the post-buy balance always stays above the pause threshold and
         there's always enough SOL to pay sell priority fees. */
      const KEEP_SOL   = 0.013;
      const solAmount  = Math.min(this.settings.maxTradeSol, Math.max(0, this._walletSol - KEEP_SOL));
      if (solAmount < 0.005) {
        this.phaseLog("executor", "error", `INSUFFICIENT_SOL ── skipping ${opp.symbol} (${this._walletSol.toFixed(4)} SOL available, need >${KEEP_SOL + 0.005} SOL)`);
        return;
      }

      this.phaseLog("executor", "exec",
        `BUY_ORDER ── ${opp.symbol} │ ${solAmount.toFixed(4)} SOL │ slippage:${this.settings.slippageBps}bps+dynamic │ routing via Jupiter…`,
        opp.symbol);

      const { sig, tokenAmount } = await jupiterBuy(
        this.signer, opp.mint, solAmount,
        this.settings.slippageBps, this.settings.priorityFeeLamports, 0,
        (attempt, bps) => this.phaseLog("executor", "warn",
          `SLIPPAGE_RETRY #${attempt} ── ${opp.symbol} │ escalating to ${bps}bps…`, opp.symbol),
      );

      const position: Position = {
        id: sig, mint: opp.mint, symbol: opp.symbol, name: opp.name,
        imageUrl: opp.imageUrl,
        entryPriceUsd: opp.priceUsd, entryAmountSol: solAmount, tokenAmount,
        openedAt: Date.now(), currentPriceUsd: opp.priceUsd,
        entryMcapUsd: opp.mcapUsd, currentMcapUsd: opp.mcapUsd,
        pnlPct: 0, pnlSol: 0, highPnlPct: 0, sig,
      };
      this._positions.set(opp.mint, position);
      this._trades.unshift({
        id: sig, mint: opp.mint, symbol: opp.symbol, name: opp.name,
        imageUrl: opp.imageUrl, side: "buy",
        amountSol: solAmount, priceUsd: opp.priceUsd, sig, ts: Date.now(),
      });

      this.phaseLog("executor", "success",
        `✓ FILLED ── ${opp.symbol} │ ${tokenAmount.toFixed(2)} tokens @ $${opp.priceUsd.toFixed(6)} │ TX:${sig.slice(0, 12)}…`,
        opp.symbol);
      this.emit();
    } catch (e) {
      this.phaseLog("executor", "error", `BUY_FAILED ── ${opp.symbol}: ${String(e).slice(0, 120)}`);
    } finally {
      this.buyLock     = false;
      this._buyingMint = null;
      this._executorActive = false;
      this.fetchBalance();
      this.emit();
    }
  }

  /* ─── Phase 3: Executor — Sell ─────────────────────────────────── */
  private async executeSell(pos: Position, reason: string) {
    this._positions.delete(pos.mint);
    this._executorActive = true;
    this.emit();

    const reasonLabel: Record<string, string> = {
      take_profit:    "TAKE_PROFIT",
      stop_loss:      "STOP_LOSS",
      instant_pump:   "INSTANT_TP",
      trailing_stop:  "TRAILING_STOP",
      manual:         "MANUAL",
    };

    try {
      this.phaseLog("executor", "exec",
        `SELL_ORDER ── ${pos.symbol} │ reason:${reasonLabel[reason] ?? reason} │ pnl:${pos.pnlPct >= 0 ? "+" : ""}${pos.pnlPct.toFixed(1)}%…`,
        pos.symbol);

      const { sig, solReceived } = await jupiterSell(
        this.signer, pos.mint, pos.tokenAmount, 6,
        Math.round(this.settings.slippageBps * 1.5), this.settings.priorityFeeLamports, 0,
        (attempt, bps) => this.phaseLog("executor", "warn",
          `SLIPPAGE_RETRY #${attempt} ── ${pos.symbol} │ escalating to ${bps}bps…`, pos.symbol),
      );
      const pnlSol = solReceived - pos.entryAmountSol;
      const pnlPct = (pnlSol / pos.entryAmountSol) * 100;
      if (pnlSol < 0) this.totalLostSol += Math.abs(pnlSol);

      this._trades.unshift({
        id: sig, mint: pos.mint, symbol: pos.symbol, name: pos.name,
        imageUrl: pos.imageUrl, side: "sell",
        amountSol: solReceived, priceUsd: pos.currentPriceUsd,
        pnlPct, pnlSol, sig, ts: Date.now(), reason,
        durationMs: Date.now() - pos.openedAt,
      });

      this.phaseLog("executor",
        pnlSol >= 0 ? "success" : "warn",
        `${pnlSol >= 0 ? "✓" : "✗"} CLOSED ── ${pos.symbol} │ ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% │ ${pnlSol >= 0 ? "+" : ""}${pnlSol.toFixed(4)} SOL │ TX:${sig.slice(0, 12)}…`,
        pos.symbol);
      this.emit();
    } catch (e) {
      this.phaseLog("executor", "error", `SELL_FAILED ── ${pos.symbol}: ${String(e).slice(0, 120)}`);
      this._positions.set(pos.mint, pos);
      this.emit();
    } finally {
      this._executorActive = false;
      this.fetchBalance();
      this.emit();
    }
  }

  /* ─── Position monitor (trailing stop + TP/SL) ────────────────── */
  private async monitorPositions() {
    if (this._positions.size === 0) return;
    for (const pos of [...this._positions.values()]) {
      try {
        const dex = await fetchDex(pos.mint);
        if (!dex) continue;
        const currentPrice = parseFloat(dex.priceUsd ?? "0");
        if (!currentPrice || !pos.entryPriceUsd) continue;

        const pnlPct   = ((currentPrice - pos.entryPriceUsd) / pos.entryPriceUsd) * 100;
        const pnlSol   = pos.entryAmountSol * (pnlPct / 100);
        const ageMin   = (Date.now() - pos.openedAt) / 60_000;
        const highPnl  = Math.max(pos.highPnlPct, pnlPct);
        const currentMcapUsd = dex.marketCap ?? dex.fdv ?? pos.currentMcapUsd ?? 0;
        const updated  = { ...pos, currentPriceUsd: currentPrice, currentMcapUsd, pnlPct, pnlSol, highPnlPct: highPnl };
        this._positions.set(pos.mint, updated);

        const isInstantPump  = pnlPct >= this.settings.instantProfitPct && ageMin < 12;
        const isTakeProfit   = pnlPct >= this.settings.takeProfitPct;
        const isStopLoss     = pnlPct <= -this.settings.stopLossPct;
        const isTrailingStop = highPnl > 20 && pnlPct < highPnl - this.settings.trailingStopPct;

        if      (isInstantPump)  await this.executeSell(updated, "instant_pump");
        else if (isTakeProfit)   await this.executeSell(updated, "take_profit");
        else if (isTrailingStop) await this.executeSell(updated, "trailing_stop");
        else if (isStopLoss)     await this.executeSell(updated, "stop_loss");
      } catch {}
    }
    this.emit();
  }

  /* ─── Manual commands ───────────────────────────────────────────── */
  async manualBuy(mint: string, solAmount: number): Promise<string> {
    if (this.buyLock) throw new Error("Buy already in progress.");
    this.buyLock = true;
    this._executorActive = true;
    this.emit();
    try {
      const [dex, pump] = await Promise.all([fetchDex(mint), fetchPumpCoin(mint).catch(() => null)]);
      const symbol   = pump?.symbol || dex?.baseToken?.symbol || mint.slice(0, 6).toUpperCase();
      const priceUsd = parseFloat(dex?.priceUsd ?? "0") || 0;
      this.phaseLog("executor", "exec", `MANUAL_BUY ── ${solAmount} SOL → ${symbol}…`, symbol);
      const { sig, tokenAmount } = await jupiterBuy(
        this.signer, mint, solAmount, this.settings.slippageBps, this.settings.priorityFeeLamports,
      );
      const mcapUsd = dex?.marketCap ?? dex?.fdv ?? 0;
      this._positions.set(mint, {
        id: sig, mint, symbol, name: pump?.name || symbol,
        entryPriceUsd: priceUsd, entryAmountSol: solAmount, tokenAmount,
        openedAt: Date.now(), currentPriceUsd: priceUsd,
        entryMcapUsd: mcapUsd, currentMcapUsd: mcapUsd,
        pnlPct: 0, pnlSol: 0, highPnlPct: 0, sig,
      });
      this._trades.unshift({ id: sig, mint, symbol, side: "buy", amountSol: solAmount, priceUsd, sig, ts: Date.now() });
      this.phaseLog("executor", "success", `✓ MANUAL_FILLED ── ${tokenAmount.toFixed(2)} ${symbol} | TX:${sig.slice(0, 12)}…`, symbol);
      this.fetchBalance();
      this.emit();
      return sig;
    } finally {
      this.buyLock = false;
      this._executorActive = false;
      this.emit();
    }
  }

  async manualSell(mintOrSymbol: string): Promise<string> {
    const pos = this._positions.get(mintOrSymbol)
      ?? [...this._positions.values()].find(p => p.symbol.toLowerCase() === mintOrSymbol.toLowerCase());
    if (!pos) throw new Error(`No open position for "${mintOrSymbol}".`);
    /* Do NOT delete from _positions yet — only remove after confirmed sell.
       If the swap fails the card stays visible and the user can retry. */
    this._executorActive = true;
    this.emit();
    try {
      this.phaseLog("executor", "exec", `MANUAL_SELL ── ${pos.symbol}…`, pos.symbol);
      const { sig, solReceived } = await jupiterSell(
        this.signer, pos.mint, pos.tokenAmount, 6,
        Math.round(this.settings.slippageBps * 1.5), this.settings.priorityFeeLamports, 0,
        (attempt, bps) => this.phaseLog("executor", "warn",
          `SLIPPAGE_RETRY #${attempt} ── ${pos.symbol} │ escalating to ${bps}bps…`, pos.symbol),
      );
      /* Sell confirmed on-chain — now remove the position */
      this._positions.delete(pos.mint);
      const pnlSol = solReceived - pos.entryAmountSol;
      const pnlPct = pos.entryAmountSol > 0 ? (pnlSol / pos.entryAmountSol) * 100 : 0;
      if (pnlSol < 0) this.totalLostSol += Math.abs(pnlSol);
      this._trades.unshift({
        id: sig, mint: pos.mint, symbol: pos.symbol, name: pos.name,
        imageUrl: pos.imageUrl, side: "sell",
        amountSol: solReceived, priceUsd: pos.currentPriceUsd,
        pnlPct, pnlSol, sig, ts: Date.now(), reason: "manual",
        durationMs: Date.now() - pos.openedAt,
      });
      this.phaseLog("executor", pnlSol >= 0 ? "success" : "warn",
        `${pnlSol >= 0 ? "✓" : "✗"} MANUAL_CLOSED ── ${pos.symbol} │ ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% │ TX:${sig.slice(0, 12)}…`, pos.symbol);
      this.fetchBalance();
      this.emit();
      return sig;
    } catch (e) {
      this.phaseLog("executor", "error",
        `MANUAL_SELL_FAILED ── ${pos.symbol}: ${String(e).slice(0, 120)}`);
      throw e;
    } finally {
      this._executorActive = false;
      this.emit();
    }
  }
}
