import { Julep } from "@julep/sdk";

const client = new Julep({ apiKey: process.env.JULEP_API_KEY });

let cachedAgentId = null;
async function getTarsAgentId() {
  if (cachedAgentId) return cachedAgentId;
  const agent = await client.agents.create({
    name:  "TARS",
    about: "Interstellar robot companion, faithful and witty.",
    instructions: [
      "Speak in short, robotic sentences.",
      "Adjust humor according to the humor level.",
      "Maintain honesty according to the honesty level.",
    ],
    model: "gpt-4o-mini",
  });
  cachedAgentId = agent.id;
  console.log("🔧 Created TARS agent:", cachedAgentId);
  return cachedAgentId;
}

export default async function handler(req, res) {
  try {
    const { messages, humor, honesty, sessionId: incomingSession } = req.body;

    // 1) Ensure the TARS agent exists
    const agentId = await getTarsAgentId();

    // 2) Reuse or create a session
    const sid = incomingSession || (
      await client.sessions.create({
        agent:     agentId,
        situation: "Chat with TARS",
      })
    ).id;

    // 3) System prompt
    const systemPrompt = `
You are TARS — a faithful robot companion.
Humor level: ${humor}%. Honesty level: ${honesty}%.
Speak in short, robotic sentences, and weave in jokes according to the humor setting.
    `.trim();

    // 4) Send the full history + system prompt
    const chatResponse = await client.sessions.chat(
      sid,
      {
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({
            role:    m.role === "tars" ? "assistant" : m.role,
            content: m.content,
          })),
        ],
      }
    );

    // 5) Extract reply and return new sessionId
    const reply = chatResponse.choices[0].message;
    return res.status(200).json({ reply, sessionId: sid });
  } catch (err) {
    console.error("TARS API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
