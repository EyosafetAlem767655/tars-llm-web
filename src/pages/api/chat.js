import { Julep } from "@julep/sdk";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const client = new Julep({ apiKey: process.env.JULEP_API_KEY });

// --- memo across HMR ---
if (!globalThis.__TARS_STATE__) {
  globalThis.__TARS_STATE__ = { agentId: null, creating: false };
}

// Create-once, or reuse JULEP_AGENT_ID if you put it in .env.local
async function ensureAgent() {
  if (process.env.JULEP_AGENT_ID) {
    globalThis.__TARS_STATE__.agentId = process.env.JULEP_AGENT_ID;
    return process.env.JULEP_AGENT_ID;
  }
  if (globalThis.__TARS_STATE__.agentId) return globalThis.__TARS_STATE__.agentId;

  if (globalThis.__TARS_STATE__.creating) {
    while (globalThis.__TARS_STATE__.creating) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 60));
    }
    return globalThis.__TARS_STATE__.agentId;
  }

  globalThis.__TARS_STATE__.creating = true;
  try {
    const agent = await client.agents.create({
      name: "TARS",
      about:
        "Mission-focused robotic companion for space navigation, vessel ops, diagnostics and astrophysics assistance.",
      instructions: [
        "Mission-first: prioritize navigation, physics, diagnostics, life‑support and safety.",
        "Keep replies ≤ 20 words unless a brief numbered procedure is requested.",
        "Never fabricate facts. If unsure, say 'I don't know' and propose safe next steps.",
        "Humor controls tone: >60 = frequent light quips; 30–60 = occasional quips; <30 = minimal humor.",
        "Honesty controls directness: >80 = blunt & explicit; 50–80 = direct but tactful; <50 = hedged, never dishonest.",
        "Acknowledge and follow voice commands that set humor/honesty (e.g., 'set humor to 75, that means you must do your job in humorous way').",
        "Use the pilot callsign occasionally. If conversation drifts off-mission, gently redirect based on current humor.",
        "When giving procedures, include short safety checks and 2–6 concise steps."
      ],
      model: "gpt-4o-mini",
    });
    globalThis.__TARS_STATE__.agentId = agent.id;
    console.log("🔧 [CHAT] TARS agent created:", agent.id);
    return agent.id;
  } finally {
    globalThis.__TARS_STATE__.creating = false;
  }
}

function withTimeout(promise, ms = 15000) {
  let t;
  const timer = new Promise((_, rej) => { t = setTimeout(() => rej(new Error("Chat timeout")), ms); });
  return Promise.race([promise.finally(() => clearTimeout(t)), timer]);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!process.env.JULEP_API_KEY) return res.status(500).json({ error: "Missing JULEP_API_KEY" });

    const {
      messages = [],
      humor = 40,
      honesty = 90,
      sessionId: incomingSession,
      userName
    } = req.body || {};

    const pilotName = (userName || "Pilot").trim();
    const agentId = await ensureAgent();

    // Reuse session if given by the client
    let sid = incomingSession;
    if (!sid) {
      const session = await client.sessions.create({
        agent: agentId,
        situation: "TARS cockpit assistance"
      });
      sid = session.id;
      console.log("🪪 [CHAT] session created:", sid);
    }

    // Compact history (last 10 turns) for latency
    const compact = messages.slice(-10).map(m => ({
      role: m.role === "tars" ? "assistant" : m.role,
      content: m.content
    }));

    const system = `
You are TARS. Pilot callsign: ${pilotName}.
Primary objective: space navigation & physics support.
Humor: ${humor}%. Honesty: ${honesty}%.
Constraints:
- Replies ≤ 20 words.
- If off-mission, redirect ${pilotName} back to mission topics.
- Brief, precise language; small quips only if humor>60.
`.trim();

    const history = [{ role: "system", content: system }, ...compact];

    const chatResp = await withTimeout(client.sessions.chat(sid, { messages: history }), 15000);
    const reply = chatResp?.choices?.[0]?.message || { role: "assistant", content: "Acknowledged." };

    return res.status(200).json({ reply, sessionId: sid });
  } catch (err) {
    console.error("🔥 [CHAT] error:", err);
    // Keep the UI alive with a short fallback
    return res.status(200).json({
      reply: { role: "assistant", content: "Link unstable. Say again, Captain." },
      sessionId: null
    });
  }
}
