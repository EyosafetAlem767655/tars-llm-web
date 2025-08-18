// src/pages/api/tts.js

// 🔹 very small in-memory cache for repeated lines (best-effort; not persistent)
const TTS_CACHE = new Map();
const MAX_CACHE_ENTRIES = 32;

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text, voiceName = "Alnilam" } = req.body || {};
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing in .env.local" });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "No text provided" });
    }

    const cacheKey = `${voiceName}::${text}`;
    if (TTS_CACHE.has(cacheKey)) {
      const cached = TTS_CACHE.get(cacheKey);
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "no-store");
      return res.end(cached);
    }

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";

    const payload = {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }, // default "Alnilam"
          },
        },
      },
      model: "gemini-2.5-flash-preview-tts",
    };

    const resp = await fetch(url + `?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Connection hint (some environments ignore this; harmless if so)
      // "Connection": "keep-alive",
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      return res.status(resp.status).json({ error: `Gemini TTS error: ${errTxt}` });
    }

    const json = await resp.json();
    const base64 = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64) {
      return res.status(500).json({ error: "No audio data from Gemini" });
    }

    const pcm = Buffer.from(base64, "base64");
    const wav = pcm16ToWav(pcm, 24000, 1);

    // cache it (simple FIFO)
    try {
      TTS_CACHE.set(cacheKey, wav);
      if (TTS_CACHE.size > MAX_CACHE_ENTRIES) {
        const firstKey = TTS_CACHE.keys().next().value;
        TTS_CACHE.delete(firstKey);
      }
    } catch {}

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    res.end(wav);
  } catch (e) {
    console.error("TTS route error:", e);
    res.status(500).json({ error: e.message });
  }
}

function pcm16ToWav(pcmBuf, sampleRate = 24000, numChannels = 1) {
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuf.length;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuf]);
}
