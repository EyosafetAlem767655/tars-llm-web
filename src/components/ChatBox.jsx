import { useContext, useState, useEffect, useRef } from "react";
import { ChatContext } from "@/context/ChatContext";
import axios from "axios";

export default function ChatBox() {
  const {
    messages, setMessages,
    humor, setHumor,
    honesty,
    sessionId, setSessionId,
    setStage
  } = useContext(ChatContext);

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  // 1) Instantiate the recognizer once
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;

    // When recognition ends (e.g. after stop()), only restart if listening is still true
    rec.onend = () => {
      if (listening) rec.start();
      else setListening(false);
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
  }, []); // run only on mount

  // 2) Handle each speech result
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
  }, [messages, humor, honesty, sessionId]); // update closure

  function addMessage(role, content) {
    const next = [...messages, { role, content }];
    setMessages(next);
    return next;
  }

  async function processCommand(text) {
    if (!text) return;

    // 3) Append the user’s message
    const updatedHistory = addMessage("user", text);

    // 4) Handle local commands
    if (/andromeda/i.test(text)) setStage(2);
    else if (/black hole/i.test(text)) setStage(3);
    else if (/humor/i.test(text)) setHumor(h => Math.min(h + 20, 100));
    else if (/serious/i.test(text)) setHumor(h => Math.max(h - 20, 0));

    try {
      // 5) Send the conversation to the API
      const { data } = await axios.post("/api/chat", {
        messages:  updatedHistory,
        humor,
        honesty,
        sessionId,
      });

      // 6) Save sessionId on first reply
      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
      }

      // 7) Append TARS’s reply
      addMessage("tars", data.reply.content);
      speak(data.reply.content);
    } catch (err) {
      console.error("Chat error:", err);
    }
  }

  function speak(text) {
    const rec = recognitionRef.current;
    // Stop listening before TTS
    if (rec) {
      rec.stop();
      setListening(false);
    }

    // Speak and resume on end
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.onend = () => {
      if (rec) {
        rec.start();
        setListening(true);
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
        style={{ padding: "8px 16px", fontSize: 16 }}
      >
        {listening ? "Pause Listening" : "Resume Listening"}
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
