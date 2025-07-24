import { useContext, useState, useEffect, useRef } from "react";
import { ChatContext } from "@/context/ChatContext";
import axios from "axios";

export default function ChatBox() {
  const { messages, setMessages, humor, honesty, setStage, setHumor } = useContext(ChatContext);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition once
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.lang = "en-US";
      rec.continuous = false;
      rec.onresult = async (e) => {
        const text = e.results[0][0].transcript;
        await processCommand(text);
      };
      recognitionRef.current = rec;
    }
  }, []);

  // Add a message to state
  function addMessage(role, content) {
    const updated = [...messages, { role, content }];
    setMessages(updated);
    return updated;
  }

  // Handle voice/text commands
  async function processCommand(text) {
    addMessage("user", text);

    // Stage changes
    if (/andromeda/i.test(text)) setStage(2);
    else if (/black hole/i.test(text)) setStage(3);

    // Humor adjustments
    else if (/humor/i.test(text)) setHumor(h => Math.min(h + 20, 100));
    else if (/serious/i.test(text)) setHumor(h => Math.max(h - 20, 0));

    // Call the API
    const convo = [...messages, { role: "user", content: text }];
    const { data } = await axios.post("/api/chat", {
      messages: convo,
      humor,
      honesty,
    });

    addMessage("tars", data.reply.content);
    speak(data.reply.content);
  }

  // Text‑to‑speech
  function speak(txt) {
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = "en-US";
    window.speechSynthesis.speak(u);
  }

  return (
    <div style={{
      position: "absolute",
      bottom: 20,
      width: "100%",
      textAlign: "center",
    }}>
      <button
        onClick={() => {
          if (recognitionRef.current) {
            setListening(!listening);
            listening ? recognitionRef.current.stop() : recognitionRef.current.start();
          }
        }}
        style={{ padding: "8px 16px", fontSize: 16 }}
      >
        {listening ? "Stop 📵" : "Talk to TARS 🎤"}
      </button>

      <div style={{
        maxHeight: 200,
        overflowY: "auto",
        marginTop: 10,
        background: "rgba(0,0,0,0.6)",
        color: "white",
        padding: 10
      }}>
        {messages.map((m, i) => (
          <div key={i}>
            <strong style={{ textTransform: "capitalize" }}>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>
    </div>
  );
}
