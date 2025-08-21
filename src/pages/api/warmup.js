// src/pages/api/warmup.js
import { Julep } from "@julep/sdk";

export const config = { api: { bodyParser: { sizeLimit: "256kb" } } };

if (!globalThis.__TARS_WARMUP__) {
  globalThis.__TARS_WARMUP__ = { agentId: null, creating: false, lastError: null };
}
const W = globalThis.__TARS_WARMUP__;

const client = new Julep({ apiKey: process.env.JULEP_API_KEY });

async function ensureAgent() {
  if (!process.env.JULEP_API_KEY) throw new Error("Missing JULEP_API_KEY");

  // If you already have a static agent id from Julep dashboard, you can set it in .env.local
  if (process.env.JULEP_AGENT_ID) {
    W.agentId = process.env.JULEP_AGENT_ID;
    return W.agentId;
  }

  if (W.agentId) return W.agentId;
  if (W.creating) {
    while (W.creating) await new Promise(r => setTimeout(r, 60));
    if (W.agentId) return W.agentId;
    throw W.lastError || new Error("Agent creation stalled");
  }

  W.creating = true;
  W.lastError = null;
  try {
    const agent = await client.agents.create({
      name: "TARS",
      about:
        "Interstellar robotic assistant. Mission-focused navigation, astrophysics, relativity, quantum effects, life support and vessel ops.",
      instructions: [
        "Stay mission-focused. Keep replies ≤ 25 words.",
        "Use pilot's callsign occasionally.",
        "If off-mission, redirect with tone based on humor level.",
        "Humor is secondary; small quips only when humor>60."
      ],
      model: "gpt-4o-mini",
    });
    W.agentId = agent.id;
    console.log("🔧 [WARMUP] TARS agent created:", agent.id);
    return agent.id;
  } catch (e) {
    W.lastError = e;
    console.error("❌ [WARMUP] Agent creation failed:", e?.message || e);
    throw e;
  } finally {
    W.creating = false;
  }
}

export default async function handler(req, res) {
  try {
    const id = await ensureAgent();
    res.status(200).json({ ok: true, agentId: id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
