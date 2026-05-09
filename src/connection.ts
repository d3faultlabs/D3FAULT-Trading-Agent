import { Connection } from "@solana/web3.js";

const NETWORK = import.meta.env.VITE_SOLANA_NETWORK ?? "devnet";
const PRIMARY =
  import.meta.env.VITE_SOLANA_RPC_ENDPOINT ??
  (NETWORK === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");
// Optional secondary Helius (or any) endpoint — used as the first fallback
// before the public RPCs so we stay on a paid, fast endpoint as long as
// possible. Set VITE_SOLANA_RPC_ENDPOINT_2 to enable.
const SECONDARY = import.meta.env.VITE_SOLANA_RPC_ENDPOINT_2 as string | undefined;

const MAINNET_FALLBACKS = [
  PRIMARY,
  ...(SECONDARY ? [SECONDARY] : []),
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
];

export const RPC_LIST: string[] =
  NETWORK === "mainnet-beta"
    ? [...new Set(MAINNET_FALLBACKS)]
    : [PRIMARY];

export const connection = new Connection(RPC_LIST[0]!, "confirmed");

function isTransient(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("service unavailable") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("etimedout")
  );
}

/**
 * Tries `fn` with each RPC in RPC_LIST in order.
 * Falls back on transient errors (rate limits, connectivity issues).
 */
export async function withRpcFallback<T>(
  fn: (conn: Connection) => Promise<T>
): Promise<T> {
  let lastErr: unknown;
  for (const rpc of RPC_LIST) {
    try {
      return await fn(new Connection(rpc, "confirmed"));
    } catch (e) {
      lastErr = e;
      if (!isTransient(e)) throw e;
    }
  }
  throw lastErr;
}
