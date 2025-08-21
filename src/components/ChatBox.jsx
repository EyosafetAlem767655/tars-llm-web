import { useContext, useEffect, useRef, useState } from "react";
import { ChatContext } from "@/context/ChatContext";
import axios from "axios";

/** Pick a British male voice if available; otherwise any English male; never French. */
function chooseBritishMale(voices) {
  if (!voices?.length) return null;

  // 1) Strict British (en-GB) + male-ish names first
  const ukMale = voices.find(v =>
    /en-GB/i.test(v.lang) &&
    /(UK English Male|Daniel|George|Ryan|Brian|Oliver|Male)/i.test(v.name)
  );
  if (ukMale) return ukMale;

  // 2) Any “UK English” in name
  const ukName = voices.find(v => /(UK English)/i.test(v.name));
  if (ukName) return ukName;

  // 3) Any English voice with male-ish name (avoid fr/*)
  const enMale = voices.find(v =>
    /en-/i.test(v.lang) &&
    !/fr|french/i.test(v.lang + " " + v.name) &&
    /(Male|David|Mark|Daniel|Oliver|George|Ryan|Alex|Fred)/i.test(v.name)
  );
  if (enMale) return enMale;

  // 4) Any en-GB at all
  const anyUK = voices.find(v => /en-GB/i.test(v.lang));
  if (anyUK) return anyUK;

  // 5) Any English
  const anyEN = voices.find(v => /en-/i.test(v.lang));
  if (anyEN) return anyEN;

  // 6) Fallback: first voice (last resort)
  return voices[0];
}

export default function ChatBox() {
  const {
    userName,
    messages, setMessages,
    humor, setHumor,
    honesty,
    sessionId, setSessionId,
    setStage,
  } = useContext(ChatContext);

  const [showInit, setShowInit] = useState(true);

  // SR/voice refs
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const ignoreUntilRef = useRef(0);
  const lastHeardRef = useRef("");

  // voice setup
  const voiceReadyRef = useRef(false);
  const chosenVoiceRef = useRef(null);

  // guards
  const greetedRef = useRef(false);
  const inflightRef = useRef(false);

  // ---------- helpers ----------
  const humorUpRegex   = /\b(more (playful|fun|humor)|lighter|joke more|increase humor|be more playful)\b/i;
  const humorDownRegex = /\b(more serious|less (playful|humor|jokes)|tone it down|decrease humor|be more serious)\b/i;
  const setHumorRegex  = /\b(?:set\s*humor\s*to|humor)\s*(\d{1,3})\b/i;

  const wantsWormhole = (t) =>
    /(go|enter|into|to|jump|through|travel).*(worm\s*hole|wormhole)/i.test(t) ||
    /\b(worm\s*hole|wormhole)\b/i.test(t);
  const wantsBlackhole = (t) =>
    /(go|enter|into|to|jump|through|dive).*black\s*hole/i.test(t) ||
    /\bblack\s*hole\b/i.test(t);

  function addMessage(role, content) {
    const next = [...messages, { role, content }];
    setMessages(next);
    try { sessionStorage.setItem("tars_messages", JSON.stringify(next)); } catch {}
    return next;
  }

  // ---------- restore session + history on mount ----------
  useEffect(() => {
    try {
      const savedSid = sessionStorage.getItem("tars_sessionId");
      if (savedSid && !sessionId) setSessionId(savedSid);

      const savedMsgs = sessionStorage.getItem("tars_messages");
      if (savedMsgs && messages.length === 0) {
        const parsed = JSON.parse(savedMsgs);
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionId) {
      try { sessionStorage.setItem("tars_sessionId", sessionId); } catch {}
    }
  }, [sessionId]);

  // ---------- voice: load & pre-warm BEFORE first speak ----------
  async function loadVoices() {
    const waitVoices = () => new Promise((resolve) => {
      const v0 = window.speechSynthesis.getVoices?.() || [];
      if (v0.length) return resolve(v0);
      const handler = () => {
        const v = window.speechSynthesis.getVoices?.() || [];
        if (v.length) {
          window.speechSynthesis.onvoiceschanged = null;
          resolve(v);
        }
      };
      window.speechSynthesis.onvoiceschanged = handler;
      setTimeout(() => resolve(window.speechSynthesis.getVoices?.() || []), 2500);
    });

    const voices = await waitVoices();
    // filter out French entirely
    const filtered = voices.filter(v => !/fr|french/i.test((v.lang || "") + " " + (v.name || "")));
    const pick = chooseBritishMale(filtered.length ? filtered : voices);
    chosenVoiceRef.current = pick || null;

    // Pre-warm: mute 1-char utterance *with that voice*, then cancel queue
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    u.lang = pick && /en-GB/i.test(pick.lang) ? "en-GB" : "en-US";
    if (pick) u.voice = pick;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);

    voiceReadyRef.current = true;
  }

  async function speak(text) {
    if (!voiceReadyRef.current) {
      await loadVoices();
    }

    window.speechSynthesis.cancel();
    stopSR(); // SR fully off during TTS
    speakingRef.current = true;

    const v = chosenVoiceRef.current;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = v && /en-GB/i.test(v.lang) ? "en-GB" : "en-US";
    u.rate = 0.98;
    u.pitch = 0.82;
    u.volume = 1;
    if (v) u.voice = v;

    u.onend = () => {
      speakingRef.current = false;
      ignoreUntilRef.current = Date.now() + 650;
      startSR(); // resume SR after voice ends
    };

    window.speechSynthesis.speak(u);
  }

  // ---------- SR lifecycle: single-utterance mode ----------
  function startSR() {
    if (speakingRef.current || listeningRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => { listeningRef.current = true; };
    rec.onerror = () => {
      listeningRef.current = false;
      setTimeout(() => { if (!speakingRef.current) startSR(); }, 400);
    };
    rec.onend = () => {
      listeningRef.current = false;
      setTimeout(() => { if (!speakingRef.current) startSR(); }, 350);
    };
    rec.onresult = (e) => {
      const text = (e.results?.[0]?.[0]?.transcript || "").trim();
      if (!text) return;
      if (Date.now() < ignoreUntilRef.current) return;
      if (text === lastHeardRef.current) return;
      lastHeardRef.current = text;
      processCommand(text);
    };

    recognitionRef.current = rec;
    try { rec.start(); } catch {}
  }

  function stopSR() {
    const rec = recognitionRef.current;
    if (!rec) return;
    try { rec.stop(); } catch {}
    listeningRef.current = false;
  }

  // ---------- chat flow ----------
  async function sendToTars(history, humorValue) {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      // Always send whatever sid we have (from state OR sessionStorage)
      const sid =
        sessionId ||
        (() => { try { return sessionStorage.getItem("tars_sessionId"); } catch { return null; } })() ||
        null;

      const { data } = await axios.post("/api/chat", {
        messages: history,
        humor: humorValue,
        honesty,
        sessionId: sid,
        userName,
      });

      // Persist sid immediately
      if (data.sessionId) {
        setSessionId(data.sessionId);
        try { sessionStorage.setItem("tars_sessionId", data.sessionId); } catch {}
      }

      const replyText = (data.reply?.content || "").trim();
      addMessage("tars", replyText);
      await speak(replyText);
    } catch (err) {
      console.error("Chat error:", err);
      const fallback = "Link unstable. Say again, Captain.";
      addMessage("tars", fallback);
      await speak(fallback);
    } finally {
      inflightRef.current = false;
    }
  }

  async function sendToneAdjustment(history, newHumor) {
    const adj = `Adjust humor to ${newHumor}%. Acknowledge briefly with my callsign; continue the mission in ≤ 20 words.`;
    await sendToTars([...history, { role: "user", content: adj }], newHumor);
  }

  async function processCommand(text) {
    const updated = addMessage("user", text);

    if (wantsWormhole(text)) setStage(2);
    else if (wantsBlackhole(text)) setStage(3);

    // humor controls
    const setMatch = text.match(setHumorRegex);
    if (setMatch) {
      let target = parseInt(setMatch[1], 10);
      if (!Number.isFinite(target)) target = humor;
      target = Math.max(0, Math.min(100, target));
      setHumor(target);
      await sendToneAdjustment(updated, target);
      return;
    }
    if (humorUpRegex.test(text))  { const h = Math.min(humor + 20, 100); setHumor(h); await sendToneAdjustment(updated, h); return; }
    if (humorDownRegex.test(text)){ const h = Math.max(humor - 20, 0);   setHumor(h); await sendToneAdjustment(updated, h); return; }

    await sendToTars(updated, humor);
  }

  // ---------- Initialize (user click; allows audio & mic) ----------
  async function initComms() {
    setShowInit(false);

    // Load & lock voice first so the first line uses it.
    await loadVoices();

    // Seed once only if no history exists
    const seeded = sessionStorage.getItem("tars_seeded") === "1";
    if (!seeded && messages.length === 0 && !greetedRef.current) {
      const name = (userName || "Pilot").trim();
      const seededMsgs = addMessage("user", `My call sign is ${name}. Begin mission support.`);
      greetedRef.current = true;
      try { sessionStorage.setItem("tars_seeded", "1"); } catch {}
      await sendToTars(seededMsgs, humor);
      return;
    }

    // If already chatting, just confirm systems and start SR
    await speak(`Systems online, Captain ${(userName || "Pilot").trim()}.`);
  }

  // ---------- Cleanup ----------
  useEffect(() => {
    return () => {
      stopSR();
      window.speechSynthesis.cancel();
    };
  }, []);

  // display last two as subtitles
  const lastTwo = messages.slice(-2);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* one-time init overlay */}
      {showInit && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", pointerEvents: "auto", zIndex: 30
        }}>
          <div style={{
            background: "rgba(8,15,22,0.8)", border: "1px solid rgba(90,140,180,0.4)",
            color: "#e9f7ff", padding: "18px 22px", borderRadius: 12, textAlign: "center", width: 360
          }}>
            <div style={{ fontSize: 18, marginBottom: 8, letterSpacing: 0.5 }}>Initialize Comms</div>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 14 }}>
              Set voice and begin the mission.
            </div>
            <button
              onClick={initComms}
              style={{
                pointerEvents: "auto",
                padding: "10px 14px", fontSize: 14, borderRadius: 8,
                background: "linear-gradient(180deg,#13324a,#0b2133)", color: "#d9f1ff",
                border: "1px solid rgba(90,140,180,0.6)", cursor: "pointer", width: "100%"
              }}
            >
              Initialize
            </button>
          </div>
        </div>
      )}

      {/* manual SR toggle (debug) */}
      <div style={{ position: "absolute", left: 20, bottom: 20, pointerEvents: "auto", zIndex: 15 }}>
        <button
          onClick={() => {
            if (speakingRef.current) return;
            if (listeningRef.current) { stopSR(); }
            else { startSR(); }
          }}
          style={{
            padding: "8px 14px", fontSize: 14, borderRadius: 8,
            background: "rgba(10,20,30,0.8)", color: "#d9f1ff",
            border: "1px solid rgba(80,140,200,0.5)", cursor: "pointer"
          }}
        >
          {listeningRef.current ? "Pause Listening" : "Resume Listening"}
        </button>
      </div>

      {/* subtitles (last two lines) */}
      <div style={{
        position: "absolute", left: "50%", transform: "translateX(-50%)",
        bottom: 16, width: "80%", maxWidth: 900, pointerEvents: "none", zIndex: 10
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
