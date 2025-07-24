// src/pages/api/chat.js

import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  // ⚙️ Only use your JULEP key here
  apiKey: process.env.JULEP_API_KEY,
});

const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  try {
    const { messages, humor, honesty } = req.body;

    const systemPrompt = `
You are TARS — a faithful robot companion. 
Humor level: ${humor}%. Honesty level: ${honesty}%.
Speak in short, robotic sentences, and weave in jokes according to the humor setting.
    `;

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const reply = completion.data.choices[0].message;
    res.status(200).json({ reply });
  } catch (error) {
    console.error("TARS API error:", error);
    res.status(500).json({ error: error.message });
  }
}
