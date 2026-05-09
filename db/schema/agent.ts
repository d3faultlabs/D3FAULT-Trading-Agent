import {
  pgTable, text, doublePrecision, bigint, jsonb, primaryKey, index,
} from "drizzle-orm/pg-core";

export const agentTrades = pgTable("agent_trades", {
  id:          text("id").notNull(),
  agentPubkey: text("agent_pubkey").notNull(),
  mint:        text("mint").notNull(),
  symbol:      text("symbol").notNull(),
  name:        text("name"),
  imageUrl:    text("image_url"),
  side:        text("side").notNull(),
  amountSol:   doublePrecision("amount_sol").notNull(),
  priceUsd:    doublePrecision("price_usd"),
  pnlPct:      doublePrecision("pnl_pct"),
  pnlSol:      doublePrecision("pnl_sol"),
  sig:         text("sig").notNull(),
  ts:          bigint("ts", { mode: "number" }).notNull(),
  reason:      text("reason"),
  durationMs:  bigint("duration_ms", { mode: "number" }),
}, (t) => [
  primaryKey({ columns: [t.id, t.agentPubkey] }),
  index("idx_agent_trades_pubkey_ts").on(t.agentPubkey, t.ts),
]);

export const agentPositions = pgTable("agent_positions", {
  mint:        text("mint").notNull(),
  agentPubkey: text("agent_pubkey").notNull(),
  data:        jsonb("data").notNull(),
}, (t) => [
  primaryKey({ columns: [t.mint, t.agentPubkey] }),
  index("idx_agent_positions_pubkey").on(t.agentPubkey),
]);

export type AgentTrade    = typeof agentTrades.$inferSelect;
export type AgentPosition = typeof agentPositions.$inferSelect;
