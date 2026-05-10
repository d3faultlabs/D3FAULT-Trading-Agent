import { Router, Request, Response } from "express";
import { db } from "../../db/client";
import { agentTrades, agentPositions } from "../../db/schema";

const router = Router();

/* ── GET /api/agent/data/:pubkey/trades ──────────────────────────────────── */
router.get("/agent/data/:pubkey/trades", async (req: Request, res: Response) => {
  try {
    const pubkey = req.params.pubkey as string;
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(agentTrades)
      .where(eq(agentTrades.agentPubkey, pubkey));
    // Sort by ts descending and map to TradeRecord shape
    rows.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
    const trades = rows.map(r => ({
      id:         r.id,
      mint:       r.mint,
      symbol:     r.symbol,
      name:       r.name ?? undefined,
      imageUrl:   r.imageUrl ?? undefined,
      side:       r.side,
      amountSol:  r.amountSol,
      priceUsd:   r.priceUsd ?? undefined,
      pnlPct:     r.pnlPct ?? undefined,
      pnlSol:     r.pnlSol ?? undefined,
      sig:        r.sig,
      ts:         r.ts,
      reason:     r.reason ?? undefined,
      durationMs: r.durationMs ?? undefined,
    }));
    res.json(trades);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ── POST /api/agent/data/:pubkey/trades ─────────────────────────────────── */
router.post("/agent/data/:pubkey/trades", async (req: Request, res: Response) => {
  try {
    const pubkey = req.params.pubkey as string;
    const trades: Array<Record<string, unknown>> = req.body;
    if (!Array.isArray(trades) || trades.length === 0) { res.json({ ok: true }); return; }

    const { sql } = await import("drizzle-orm");

    // Upsert all trades (ignore conflicts — existing data is kept)
    await db
      .insert(agentTrades)
      .values(trades.map(t => ({
        id:          String(t.id ?? t.sig),
        agentPubkey: pubkey,
        mint:        String(t.mint),
        symbol:      String(t.symbol),
        name:        t.name != null ? String(t.name) : null,
        imageUrl:    t.imageUrl != null ? String(t.imageUrl) : null,
        side:        String(t.side),
        amountSol:   Number(t.amountSol),
        priceUsd:    t.priceUsd != null ? Number(t.priceUsd) : null,
        pnlPct:      t.pnlPct != null ? Number(t.pnlPct) : null,
        pnlSol:      t.pnlSol != null ? Number(t.pnlSol) : null,
        sig:         String(t.sig),
        ts:          Number(t.ts),
        reason:      t.reason != null ? String(t.reason) : null,
        durationMs:  t.durationMs != null ? Number(t.durationMs) : null,
      })))
      .onConflictDoNothing();

    res.json({ ok: true, count: trades.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ── GET /api/agent/data/:pubkey/positions ───────────────────────────────── */
router.get("/agent/data/:pubkey/positions", async (req: Request, res: Response) => {
  try {
    const pubkey = req.params.pubkey as string;
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(agentPositions)
      .where(eq(agentPositions.agentPubkey, pubkey));
    res.json(rows.map(r => r.data));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ── POST /api/agent/data/:pubkey/positions ──────────────────────────────── */
router.post("/agent/data/:pubkey/positions", async (req: Request, res: Response) => {
  try {
    const pubkey = req.params.pubkey as string;
    const positions: Array<Record<string, unknown>> = req.body;
    if (!Array.isArray(positions)) { res.json({ ok: true }); return; }

    const { eq } = await import("drizzle-orm");

    // Delete all existing positions for this pubkey, then insert fresh
    await db.delete(agentPositions).where(eq(agentPositions.agentPubkey, pubkey));

    if (positions.length > 0) {
      await db.insert(agentPositions).values(
        positions.map(p => ({
          mint:        String(p.mint),
          agentPubkey: pubkey,
          data:        p,
        }))
      );
    }
    res.json({ ok: true, count: positions.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/* ── DELETE /api/agent/data/:pubkey/positions/:mint ─────────────────────── */
router.delete("/agent/data/:pubkey/positions/:mint", async (req: Request, res: Response) => {
  try {
    const pubkey = req.params.pubkey as string;
    const mint = req.params.mint as string;
    const { and, eq } = await import("drizzle-orm");
    await db.delete(agentPositions).where(
      and(eq(agentPositions.agentPubkey, pubkey), eq(agentPositions.mint, mint))
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
