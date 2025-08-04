import { useContext, useState, useEffect, useRef } from "react";
import { ChatContext } from "@/context/ChatContext";
import axios from "axios";

export default function ChatBox() {
  const {
    userName,
    messages, setMessages,
    humor, setHumor,
    honesty,
    sessionId, setSessionId,
    setStage
  } = useContext(ChatContext);

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const greetedRef = useRef(false); // to avoid seeding multiple times

  // Regexes for tone adjustment
  const humorUpRegex = /\b(more (playful|fun|humor)|lighter|joke more|increase humor|be more playful)\b/i;
  const humorDownRegex = /\b(more serious|less (playful|humor|jokes)|tone it down|decrease humor|be more serious)\b/i;
  const setHumorRegex = /\b(?:set\s+humor\s+to|humor)\s*(\d{1,3})\b/i;

  // 1) Seed initial introduction once
  useEffect(() => {
    if (userName && messages.length === 0 && !greetedRef.current) {
      setMessages([{ role: "user", content: `My name is ${userName}. Ready to begin the mission.` }]);
      greetedRef.current = true;
    }
  }, [userName, messages.length, setMessages]);

  // 2) Instantiate recognizer once
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onend = () => {
      if (listening) {
        try {
          rec.start();
        } catch {}
      } else {
        setListening(false);
      }
    };
    rec.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);

    return () => {
      rec.stop();
      setListening(false);
    };
  }, []); // mount only

  // 3) Attach result handler with latest closure
  useEffect(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    const handler = (e) => {
      const transcript = e.results[e.results.length - 1][0].transcript.trim();
      processCommand(transcript);
    };
    rec.onresult = handler;
    return () => {
      rec.onresult = null;
    };
  }, [messages, humor, honesty, sessionId, userName]);

  function addMessage(role, content) {
    const next = [...messages, { role, content }];
    setMessages(next);
    return next;
  }

  async function processCommand(text) {
    if (!text) return;

    // Append user's message
    const updatedHistory = addMessage("user", text);

    // Stage navigation
    if (/andromeda/i.test(text)) setStage(2);
    else if (/black hole/i.test(text)) setStage(3);

    // Tone/humor direct set (e.g., "humor 70" or "set humor to 30")
    const setMatch = text.match(setHumorRegex);
    if (setMatch) {
      let target = parseInt(setMatch[1], 10);
      if (isNaN(target)) target = humor;
      target = Math.max(0, Math.min(100, target));
      setHumor(target);
      await sendToneAdjustment(updatedHistory, target);
      return;
    }

    // Relative adjustments
    if (humorUpRegex.test(text)) {
      const newHumor = Math.min(humor + 20, 100);
      setHumor(newHumor);
      await sendToneAdjustment(updatedHistory, newHumor);
      return;
    } else if (humorDownRegex.test(text)) {
      const newHumor = Math.max(humor - 20, 0);
      setHumor(newHumor);
      await sendToneAdjustment(updatedHistory, newHumor);
      return;
    }

    // Regular mission query
    try {
      const { data } = await axios.post("/api/chat", {
        messages: updatedHistory,
        humor,
        honesty,
        sessionId,
        userName,
      });

      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
      }

      addMessage("tars", data.reply.content);
      speak(data.reply.content);
    } catch (err) {
      console.error("Chat error:", err);
    }
  }

  // Explicit tone adjustment helper
  async function sendToneAdjustment(history, newHumor) {
    try {
      const adjPrompt = `Adjust your tone to humor level ${newHumor}%. Acknowledge the change briefly using my name and continue assisting with the mission.`;
      const payloadHistory = [
        ...history,
        { role: "user", content: adjPrompt },
      ];

      const { data } = await axios.post("/api/chat", {
        messages: payloadHistory,
        humor: newHumor,
        honesty,
        sessionId,
        userName,
      });

      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
      }

      addMessage("tars", data.reply.content);
      speak(data.reply.content);
    } catch (err) {
      console.error("Tone adjust error:", err);
    }
  }

  function speak(text) {
    const rec = recognitionRef.current;
    if (rec) {
      rec.stop();
      setListening(false);
    }

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.onend = () => {
      if (rec) {
        try {
          rec.start();
          setListening(true);
        } catch {}
      }
    };
    window.speechSynthesis.speak(utter);
  }

  return (
    <div style={{
      position: "absolute", bottom: 20, width: "100%", textAlign: "center"
    }}>
      <button
        onClick={() => {
          const rec = recognitionRef.current;
          if (!rec) return;
          if (listening) rec.stop();
          else rec.start();
          setListening(l => !l);
        }}
        style={{ padding: "8px 16px", fontSize: 16, marginBottom: 8 }}
      >
        {listening ? "Pause Listening" : "Resume Listening"}
      </button>

      <div style={{
        maxHeight: 200,
        overflowY: "auto",
        marginTop: 10,
        background: "rgba(0,0,0,0.6)",
        color: "white",
        padding: 10,
        fontSize: 14,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            <strong style={{ textTransform: "capitalize" }}>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>
    </div>
  );
}
