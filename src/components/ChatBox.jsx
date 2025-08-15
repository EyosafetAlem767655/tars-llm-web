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
  const greetedRef = useRef(false);

  const speakingRef = useRef(false);
  const ignoreUntilRef = useRef(0);
  const lastHeardRef = useRef("");

  const humorUpRegex   = /\b(more (playful|fun|humor)|lighter|joke more|increase humor|be more playful)\b/i;
  const humorDownRegex = /\b(more serious|less (playful|humor|jokes)|tone it down|decrease humor|be more serious)\b/i;
  const setHumorRegex  = /\b(?:set\s*humor\s*to|humor)\s*(\d{1,3})\b/i;

  const wantsWormhole = (t) =>
    /(go|enter|into|to|jump|through|travel).*(worm\s*hole|wormhole)/i.test(t) ||
    /\b(worm\s*hole|wormhole)\b/i.test(t);
  const wantsBlackhole = (t) =>
    /(go|enter|into|to|jump|through|dive).*black\s*hole/i.test(t) ||
    /\bblack\s*hole\b/i.test(t);

  // seed intro
  useEffect(() => {
    if (userName && messages.length === 0 && !greetedRef.current) {
      setMessages([{ role: "user", content: `My name is ${userName}. Ready to begin the mission.` }]);
      greetedRef.current = true;
    }
  }, [userName, messages.length, setMessages]);

  // recognizer
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onend = () => {
      if (listening) { try { rec.start(); } catch {} } else { setListening(false); }
    };
    rec.onerror = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
    setListening(true);

    return () => { rec.stop(); setListening(false); };
  }, []);

  // onresult
  useEffect(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    const handler = (e) => {
      if (speakingRef.current || Date.now() < ignoreUntilRef.current) return;
      const transcript = (e.results[e.results.length - 1][0].transcript || "").trim();
      if (!transcript) return;
      if (transcript === lastHeardRef.current) return;
      lastHeardRef.current = transcript;
      processCommand(transcript);
    };
    rec.onresult = handler;
    return () => { rec.onresult = null; };
  }, [messages, humor, honesty, sessionId, userName]);

  function addMessage(role, content) {
    const next = [...messages, { role, content }];
    setMessages(next);
    return next;
  }

  async function processCommand(text) {
    if (!text) return;
    const updatedHistory = addMessage("user", text);

    if (wantsWormhole(text)) setStage(2);
    else if (wantsBlackhole(text)) setStage(3);

    const setMatch = text.match(setHumorRegex);
    if (setMatch) {
      let target = parseInt(setMatch[1], 10);
      if (!Number.isFinite(target)) target = humor;
      target = Math.max(0, Math.min(100, target));
      setHumor(target);
      await sendToneAdjustment(updatedHistory, target);
      return;
    }
    if (humorUpRegex.test(text))  { const h = Math.min(humor + 20, 100); setHumor(h); await sendToneAdjustment(updatedHistory, h); return; }
    if (humorDownRegex.test(text)){ const h = Math.max(humor - 20, 0);   setHumor(h); await sendToneAdjustment(updatedHistory, h); return; }

    await sendToTars(updatedHistory, humor);
  }

  async function sendToTars(history, humorValue) {
    try {
      const { data } = await axios.post("/api/chat", {
        messages: history,
        humor: humorValue,
        honesty,
        sessionId,
        userName,
      });
      if (!sessionId && data.sessionId) setSessionId(data.sessionId);

      const replyText = (data.reply?.content || "").trim();
      addMessage("tars", replyText);
      speak(replyText);
    } catch (err) { console.error("Chat error:", err); }
  }

  async function sendToneAdjustment(history, newHumor) {
    const adjPrompt =
      `Adjust your tone to humor level ${newHumor}%. ` +
      `Acknowledge briefly using my name and continue the mission in ≤ 25 words.`;
    await sendToTars([...history, { role: "user", content: adjPrompt }], newHumor);
  }

  function speak(text) {
    const rec = recognitionRef.current;
    if (rec) { try { rec.stop(); } catch {} setListening(false); }
    speakingRef.current = true;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.onend = () => {
      speakingRef.current = false;
      ignoreUntilRef.current = Date.now() + 600;
      if (rec) { try { rec.start(); setListening(true); } catch {} }
    };
    window.speechSynthesis.speak(utter);
  }

  // only show the latest two lines like subtitles
  const lastTwo = messages.slice(-2);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* manual toggle (still useful) */}
      <div style={{ position: "absolute", left: 20, bottom: 20, pointerEvents: "auto" }}>
        <button
          onClick={() => {
            const rec = recognitionRef.current;
            if (!rec) return;
            if (listening) { try { rec.stop(); } catch {} }
            else { try { rec.start(); } catch {} }
            setListening((l) => !l);
          }}
          style={{
            padding: "8px 14px", fontSize: 14, borderRadius: 8,
            background: "rgba(10,20,30,0.8)", color: "#d9f1ff", border: "1px solid rgba(80,140,200,0.5)"
          }}
        >
          {listening ? "Pause Listening" : "Resume Listening"}
        </button>
      </div>

      {/* subtitle area */}
      <div style={{
        position: "absolute", left: "50%", transform: "translateX(-50%)",
        bottom: 16, width: "80%", maxWidth: 900, pointerEvents: "none"
      }}>
        {lastTwo.map((m, i) => (
          <div
            key={i}
            style={{
              marginTop: 6,
              background: "linear-gradient(180deg, rgba(0,8,12,0.20), rgba(0,8,12,0.55))",
              border: "1px solid rgba(90,140,180,0.35)",
              color: "#e9f7ff",
              padding: "8px 12px",
              borderRadius: 10,
              fontSize: 14,
              textShadow: "0 0 6px rgba(40,120,200,0.25)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              whiteSpace: "pre-wrap",
              backdropFilter: "blur(2px)"
            }}
          >
            <strong style={{ textTransform: "capitalize", marginRight: 6, color: "rgba(170,220,255,0.9)" }}>
              {m.role}:
            </strong>
            {m.content}
          </div>
        ))}
      </div>
    </div>
  );
}
