import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChatContext } from "@/context/ChatContext";
import axios from "axios";

/* ---------- Voice selection helpers ---------- */
function chooseBritishMale(voices) {
  if (!voices?.length) return null;
  // 1) Obvious UK male names on Chrome / Edge / macOS
  const nameHit = voices.find(v =>
    /(Daniel|Oliver|George|Ryan|Brian|UK English Male|Microsoft George|Microsoft Ryan|Microsoft Daniel|Alex|Fred)/i.test(v.name)
    && /en-GB|English/gi.test(`${v.lang} ${v.name}`)
    && !/fr|french/i.test(`${v.lang} ${v.name}`)
  );
  if (nameHit) return nameHit;
  // 2) Any en-GB voice
  const ukLang = voices.find(v => /en-GB/i.test(v.lang));
  if (ukLang) return ukLang;
  // 3) Any English non-French
  const en = voices.find(v => /en-/i.test(v.lang) && !/fr|french/i.test(`${v.lang} ${v.name}`));
  if (en) return en;
  // 4) Fallback
  return voices[0];
}

/* ---------- Init overlay via portal (always clickable) ---------- */
function InitOverlay({ open, busy, onStart }) {
  if (!open) return null;
  const node = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(3px)",
        zIndex: 9999,
        pointerEvents: "auto",
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStart?.();
        }
      }}
      tabIndex={0}
    >
      <div
        style={{
          background: "rgba(8,15,22,0.95)",
          border: "1px solid rgba(90,140,180,0.55)",
          color: "#e9f7ff",
          padding: "18px 22px",
          borderRadius: 12,
          textAlign: "center",
          width: 360,
          boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ fontSize: 18, marginBottom: 8, letterSpacing: 0.5 }}>
          Initialize Comms
        </div>
        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 14 }}>
          Set voice and begin the mission.
        </div>
        <button
          onClick={onStart}
          disabled={busy}
          style={{
            pointerEvents: "auto",
            padding: "10px 14px",
            fontSize: 14,
            borderRadius: 8,
            background: busy
              ? "linear-gradient(180deg,#1a2e40,#122333)"
              : "linear-gradient(180deg,#13324a,#0b2133)",
            color: "#d9f1ff",
            border: "1px solid rgba(90,140,180,0.6)",
            cursor: busy ? "default" : "pointer",
            width: "100%",
          }}
        >
          {busy ? "Loading voice…" : "Initialize"}
        </button>
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.75 }}>
          Tip: press <b>Enter</b> to start.
        </div>
      </div>
    </div>
  );
  return createPortal(node, document.body);
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

  /* ---------- UI state ---------- */
  const [showInit, setShowInit] = useState(true);
  const [initBusy, setInitBusy] = useState(false);

  /* ---------- SR / TTS refs ---------- */
  const recRef = useRef(null);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const ignoreUntilRef = useRef(0);
  const lastHeardRef = useRef("");

  const voicesReadyRef = useRef(false);
  const chosenVoiceRef = useRef(null);

  const greetedRef = useRef(false);
  const inflightRef = useRef(false);

  /* ---------- regex helpers ---------- */
  const humorUpRegex   = /\b(more (playful|fun|humor)|lighter|joke more|increase humor|be more playful)\b/i;
  const humorDownRegex = /\b(more serious|less (playful|humor|jokes)|tone it down|decrease humor|be more serious)\b/i;
  const setHumorRegex  = /\b(?:set\s*humor\s*to|humor)\s*(\d{1,3})\b/i;

  const wantsWormhole = (t) =>
    /(go|enter|into|to|jump|through|travel).*(worm\s*hole|wormhole)/i.test(t) ||
    /\b(worm\s*hole|wormhole)\b/i.test(t);
  const wantsBlackhole = (t) =>
    /(go|enter|into|to|jump|through|dive).*black\s*hole/i.test(t) ||
    /\bblack\s*hole\b/i.test(t);

  /* ---------- history helpers ---------- */
  function addMessage(role, content) {
    const next = [...messages, { role, content }];
    setMessages(next);
    try { sessionStorage.setItem("tars_messages", JSON.stringify(next)); } catch {}
    return next;
  }

  // restore session + history (once)
  useEffect(() => {
    try {
      const sid = sessionStorage.getItem("tars_sessionId");
      if (sid && !sessionId) setSessionId(sid);
      const saved = sessionStorage.getItem("tars_messages");
      if (saved && messages.length === 0) {
        const parsed = JSON.parse(saved);
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

  /* ---------- voice prewarm (non-blocking on mount) ---------- */
  useEffect(() => {
    // Don’t block UI; just prep voices in the background
    const prewarm = async () => {
      try {
        const got = window.speechSynthesis?.getVoices?.() || [];
        if (got.length) {
          chosenVoiceRef.current = chooseBritishMale(got);
          voicesReadyRef.current = true;
          return;
        }
        const wait = new Promise(resolve => {
          const handler = () => {
            const v = window.speechSynthesis?.getVoices?.() || [];
            if (v.length) {
              window.speechSynthesis.onvoiceschanged = null;
              resolve(v);
            }
          };
          window.speechSynthesis.onvoiceschanged = handler;
          setTimeout(() => resolve(window.speechSynthesis?.getVoices?.() || []), 2500);
        });
        const v = await wait;
        chosenVoiceRef.current = chooseBritishMale(v);
        voicesReadyRef.current = true;
      } catch { /* ignore */ }
    };
    prewarm();
  }, []);

  /* ---------- TTS ---------- */
  function primeOnce() {
    return new Promise((resolve) => {
      const pick = chosenVoiceRef.current;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.rate = 1;
      u.pitch = 1;
      u.lang = pick && /en-GB/i.test(pick.lang) ? "en-GB" : "en-GB"; // force UK if possible
      if (pick) u.voice = pick;
      u.onend = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  }

  async function speak(text) {
    window.speechSynthesis.cancel();
    stopSR();
    speakingRef.current = true;

    const v = chosenVoiceRef.current;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = v && /en-GB/i.test(v.lang) ? "en-GB" : "en-GB";
    u.rate = 0.98;
    u.pitch = 0.82;
    u.volume = 1;
    if (v) u.voice = v;

    u.onend = () => {
      speakingRef.current = false;
      ignoreUntilRef.current = Date.now() + 650;
      startSR();
    };
    window.speechSynthesis.speak(u);
  }

  /* ---------- SR (single-utterance) ---------- */
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

    recRef.current = rec;
    try { rec.start(); } catch {}
  }

  function stopSR() {
    const rec = recRef.current;
    if (!rec) return;
    try { rec.stop(); } catch {}
    listeningRef.current = false;
  }

  /* ---------- Chat flow ---------- */
  async function sendToTars(history, humorValue) {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
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

  /* ---------- Initialize (button) ---------- */
  async function initComms() {
    if (initBusy) return;
    setInitBusy(true);
    // ensure overlay hides quickly even if some async steps lag or events are blocked
    let hideHandled = false;
    const hideAndMaybeStartSR = () => {
      if (hideHandled) return;
      hideHandled = true;
      setShowInit(false);
      if (!speakingRef.current) startSR();
    };
    const fallback = setTimeout(() => {
      hideAndMaybeStartSR();
      setInitBusy(false);
    }, 3000);

    try {
      // prewarm voices if available
      if (!voicesReadyRef.current) {
        const v = window.speechSynthesis?.getVoices?.();
        if (v?.length) {
          chosenVoiceRef.current = chooseBritishMale(v);
          voicesReadyRef.current = true;
        }
      }

      // Primer (zero volume) then greet — hide overlay as soon as primer completes
      await primeOnce().catch(() => {});
      hideAndMaybeStartSR();

      const name = (userName || "Pilot").trim();
      const seeded = (() => { try { return sessionStorage.getItem("tars_seeded") === "1"; } catch { return false; } })();

      if (!seeded && messages.length === 0 && !greetedRef.current) {
        const seededMsgs = addMessage("user", `My call sign is ${name}. Begin mission support.`);
        greetedRef.current = true;
        try { sessionStorage.setItem("tars_seeded", "1"); } catch {}
        await speak(`Comms online, Captain ${name}.`);
        await sendToTars(seededMsgs, humor);
      } else {
        await speak(`Comms online, Captain ${name}.`);
        // if speak didn't start or finish for some reason, ensure SR runs
        if (!speakingRef.current) startSR();
      }
    } finally {
      clearTimeout(fallback);
      setInitBusy(false);
    }
  }

  /* ---------- Cleanup ---------- */
  useEffect(() => {
    return () => {
      stopSR();
      window.speechSynthesis.cancel();
    };
  }, []);

  /* ---------- subtitles (last two) ---------- */
  const lastTwo = messages.slice(-2);

  return (
    <>
      <InitOverlay open={showInit} busy={initBusy} onStart={initComms} />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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

        {/* subtitles */}
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
    </>
  );
}
