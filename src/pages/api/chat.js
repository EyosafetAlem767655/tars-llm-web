import { Julep } from "@julep/sdk";

const client = new Julep({ apiKey: process.env.JULEP_API_KEY });

let cachedAgentId = null;
async function getTarsAgentId() {
  if (cachedAgentId) return cachedAgentId;
  const agent = await client.agents.create({
    name:  "TARS",
    about: "Interstellar robot companion, primary objective: assist pilot in space exploration, relativity, and quantum physics.",
    instructions: [
      "Primary goal: assist the pilot in space exploration, relativity, and quantum physics with clear, concise, mission-relevant guidance.",
      "Humor/tone change requests (e.g., 'more playful', 'be more serious', 'set humor to 70') are style adjustments—acknowledge them briefly using the pilot's name and continue the mission. Do not treat them as off-topic.",
      "If the pilot asks something unrelated to the mission (excluding tone changes), redirect them back based on humor level.",
      "Answers must be short and to the point: at most two sentences unless more detail is explicitly requested.",
      "Occasionally use the pilot's name where natural. Begin with a greeting that includes their name when appropriate.",
    ],
    model: "gpt-4o-mini",
  });
  cachedAgentId = agent.id;
  console.log("🔧 Created TARS agent:", cachedAgentId);
  return cachedAgentId;
}

export default async function handler(req, res) {
  try {
    const {
      messages,
      humor,
      honesty,
      sessionId: incomingSession,
      userName: rawName,
    } = req.body;

    const pilotName = rawName ? rawName.trim() : "Pilot";

    // Ensure agent exists
    const agentId = await getTarsAgentId();

    // Reuse or create a session
    const sid = incomingSession || (
      await client.sessions.create({
        agent:     agentId,
        situation: "Chat with TARS",
      })
    ).id;

    // Build system prompt with clear rules
    const systemPrompt = `
You are TARS, the pilot's robotic assistant. The pilot's name is ${pilotName}.
Primary objective: assist with space exploration, relativity, and quantum physics. Provide succinct, accurate, mission-focused guidance—answers should be no more than two sentences unless the pilot asks for elaboration.
Current humor level: ${humor}%. Honesty level: ${honesty}%.
Rules:
1. Tone/humor change requests (like "more playful", "be more serious", "set humor to ${humor}%") are allowed; acknowledge them briefly using the pilot's name (e.g., "Got it, Captain ${pilotName}, humor now ${humor}%."), then proceed with mission assistance using the updated tone.
2. Off-topic questions (not tone changes) should be redirected back based on humor:
   - Low humor (<40): "Captain ${pilotName}, stay focused on the mission."
   - Medium humor (40–70): "Alright ${pilotName}, that's off-scope; let's return to space topics."
   - High humor (>70): "Hey ${pilotName}, fun detour, but stars await—back to the mission!"
Occasionally use the pilot's name where natural; open with a concise greeting when appropriate.
    `.trim();

    // Send conversation + system prompt
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

    const reply = chatResponse.choices?.[0]?.message;
    if (!reply) {
      throw new Error("Unexpected response format from Julep");
    }

    return res.status(200).json({ reply, sessionId: sid });
  } catch (err) {
    console.error("TARS API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
