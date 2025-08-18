import { useContext, useState, useEffect, useRef } from "react";
import { ChatContext } from "@/context/ChatContext";
import axios from "axios";

const COOLDOWN_AFTER_TTS_MS = 1100;
const BUTTON_DEBOUNCE_MS = 300;

export default function ChatBox() {
  const {
    userName,
    messages, setMessages,
    humor, setHumor,
    honesty,
    sessionId, setSessionId,
    setStage
  } = useContext(ChatContext);

  /** ---------------- STT / Recognizer ---------------- */
  const recognitionRef    = useRef(null);
  const [listening, setListening] = useState(false);
  const shouldListenRef   = useRef(true);
  const startPendingRef   = useRef(false);
  const stopPendingRef    = useRef(false);

  /** ---------------- TTS / Voice ---------------- */
  const [voices, setVoices] = useState([]);
  const voicesReadyRef = useRef(false);
  const lockedVoiceNameRef = useRef(
    (typeof window !== "undefined" && localStorage.getItem("tarsLockedVoice")) || ""
  );
  const speakingRef = useRef(false);
  const ignoreUntilRef = useRef(0);
  const lastAssistantRef = useRef(""); // normalized last assistant sentence
  const lastHeardRef = useRef("");     // last transcript fed to LLM

  /** ---------------- Button debounce ---------------- */
  const [btnBusy, setBtnBusy] = useState(false);

  /** ---------------- Helpers ---------------- */
  const PREFERRED = [
    "Google US English Male",
    "Microsoft Mark",
    "Microsoft David",
    "Microsoft Guy",
    "Google US English",
    "Alex"
  ];
  function pickBestUSMale(vs) {
    if (!vs?.length) return null;
    for (const pref of PREFERRED) {
      const v = vs.find(x => x.name.toLowerCase().includes(pref.toLowerCase()));
      if (v) return v;
    }
    const enUS = vs.filter(v => /en[-_]?US/i.test(v.lang));
    if (enUS.length) {
      const maleHint = enUS.find(v => /male|mark|david|guy|alex/i.test(v.name));
      return maleHint || enUS[0];
    }
    const en = vs.filter(v => /en/i.test(v.lang));
    if (en.length) {
      const maleHint = en.find(v => /male|mark|david|guy|alex/i.test(v.name));
      return maleHint || en[0];
    }
    return vs[0];
  }
  function selectedVoice() {
    const list = window.speechSynthesis?.getVoices?.() || voices;
    if (!list.length) return null;
    const locked = lockedVoiceNameRef.current && list.find(v => v.name === lockedVoiceNameRef.current);
    return locked || pickBestUSMale(list);
  }
  function normalize(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function isEcho(transcript) {
    const t = normalize(transcript);
    const a = lastAssistantRef.current;
    if (!t || !a) return false;
    const wc = t.split(" ").filter(Boolean).length;
    if (wc < 3) return false;
    if (a.includes(t)) return true;
    const tSet = new Set(t.split(" "));
    const aSet = new Set(a.split(" "));
    let overlap = 0; for (const w of tSet) if (aSet.has(w)) overlap++;
    return overlap / Math.max(1, tSet.size) >= 0.8;
  }

  /** ---------------- Voice warmup ---------------- */
  useEffect(() => {
    const load = () => {
      try { window.speechSynthesis?.getVoices?.(); } catch {}
      const v = window.speechSynthesis?.getVoices?.() || [];
      if (!v.length) return;
      setVoices(v);
      voicesReadyRef.current = true;
      if (!lockedVoiceNameRef.current) {
        const pick = pickBestUSMale(v);
        if (pick) {
          lockedVoiceNameRef.current = pick.name;
          localStorage.setItem("tarsLockedVoice", pick.name);
        }
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    const r1 = setTimeout(load, 250);
    const r2 = setTimeout(load, 800);
    return () => { window.speechSynthesis.onvoiceschanged = null; clearTimeout(r1); clearTimeout(r2); };
  }, []);

  /** ---------------- Safe start/stop wrappers ---------------- */
  const safeStart = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (startPendingRef.current || listening) return;
    if (!shouldListenRef.current) return;
    startPendingRef.current = true;
    stopPendingRef.current = false;
    // small delay helps avoid 'already started' races
    setTimeout(() => {
      try { rec.start(); } catch {}
    }, 120);
  };
  const safeStop = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (stopPendingRef.current || !listening) return;
    stopPendingRef.current = true;
    startPendingRef.current = false;
    try { rec.stop(); } catch {}
  };

  /** ---------------- Recognizer init ---------------- */
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    if (recognitionRef.current) return;

    const rec = new SpeechRec();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onstart = () => {
      startPendingRef.current = false;
      setListening(true);
    };
    rec.onend = () => {
      setListening(false);
      stopPendingRef.current = false;
      // If we *should* be listening, restart safely
      if (shouldListenRef.current && !speakingRef.current) {
        safeStart();
      }
    };
    rec.onerror = () => {
      setListening(false);
      stopPendingRef.current = false;
      // Try to recover after brief delay
      if (shouldListenRef.current && !speakingRef.current) {
        setTimeout(() => safeStart(), 400);
      }
    };
    rec.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      const transcript = (result && result[0] && result[0].transcript || "").trim();
      if (!transcript) return;
      if (speakingRef.current) return;
      if (Date.now() < ignoreUntilRef.current) return;
      if (isEcho(transcript)) return;
      if (transcript === lastHeardRef.current) return;

      lastHeardRef.current = transcript;
      processCommand(transcript);
    };

    recognitionRef.current = rec;
    shouldListenRef.current = true;
    safeStart();

    return () => {
      shouldListenRef.current = false;
      safeStop();
      recognitionRef.current = null;
    };
  }, []); // mount once

  /** ---------------- Initial seed / intro ---------------- */
  const seededRef = useRef(false);
  useEffect(() => {
    if (!userName || seededRef.current) return;
    seededRef.current = true;

    const introUser = `My name is ${userName}. Ready to begin the mission.`;
    setMessages([{ role: "user", content: introUser }]);

    (async () => {
      try {
        const { data } = await axios.post("/api/chat", {
          messages: [{ role: "user", content: introUser }],
          humor, honesty, sessionId, userName,
        });
        if (!sessionId && data.sessionId) setSessionId(data.sessionId);
        const replyText = (data.reply?.content || "").trim();
        setMessages(prev => [...prev, { role: "tars", content: replyText }]);
        lastAssistantRef.current = normalize(replyText);
        speak(replyText); // pauses STT, cooldown, then safeStart()
      } catch (err) {
        console.error("Initial chat error:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  /** ---------------- Commands / Tone ---------------- */
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
    if (humorUpRegex.test(text)) {
      const h = Math.min(humor + 20, 100);
      setHumor(h);
      await sendToneAdjustment(updatedHistory, h);
      return;
    }
    if (humorDownRegex.test(text)) {
      const h = Math.max(humor - 20, 0);
      setHumor(h);
      await sendToneAdjustment(updatedHistory, h);
      return;
    }

    await sendToTars(updatedHistory, humor);
  }

  async function sendToneAdjustment(history, newHumor) {
    const adjPrompt = `Adjust your tone to humor level ${newHumor}%. Acknowledge briefly using my name and continue the mission in ≤ 25 words.`;
    await sendToTars([...history, { role: "user", content: adjPrompt }], newHumor);
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
      lastAssistantRef.current = normalize(replyText);
      speak(replyText);
    } catch (err) {
      console.error("Chat error:", err);
    }
  }

  /** ---------------- Speak: pause STT → talk → cooldown → safeStart ---------------- */
  function speak(text) {
    const synthOK = typeof window !== "undefined" && "speechSynthesis" in window;
    if (!synthOK) return;

    try { window.speechSynthesis.cancel(); } catch {}

    const rec = recognitionRef.current;
    shouldListenRef.current = false;     // prevent onend auto-restart while we’re speaking
    safeStop();                          // stop recognizer cleanly

    const v = selectedVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.92;
    u.pitch = 0.78;
    if (v) u.voice = v;

    speakingRef.current = true;

    const resume = () => {
      speakingRef.current = false;
      ignoreUntilRef.current = Date.now() + COOLDOWN_AFTER_TTS_MS;
      shouldListenRef.current = true;
      safeStart(); // restart listening once, through the guarded path
    };

    const watchdog = setTimeout(resume, 9000); // safety in case onend never fires
    u.onend = () => { clearTimeout(watchdog); resume(); };
    u.onerror = () => { clearTimeout(watchdog); resume(); };

    window.speechSynthesis.speak(u);
  }

  /** ---------------- UI (last two lines like subtitles) ---------------- */
  const lastTwo = messages.slice(-2);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Mic toggle (debounced) */}
      <div style={{ position: "absolute", left: 20, bottom: 20, pointerEvents: "auto" }}>
        <button
          disabled={btnBusy}
          onClick={() => {
            if (btnBusy) return;
            setBtnBusy(true);
            setTimeout(() => setBtnBusy(false), BUTTON_DEBOUNCE_MS);

            if (listening) {
              shouldListenRef.current = false;
              safeStop();
            } else {
              // If currently speaking, cancel and then start
              if (speakingRef.current) {
                try { window.speechSynthesis.cancel(); } catch {}
                speakingRef.current = false;
                ignoreUntilRef.current = Date.now() + 200;
              }
              shouldListenRef.current = true;
              safeStart();
            }
          }}
          style={{
            padding: "8px 14px", fontSize: 14, borderRadius: 8,
            background: btnBusy ? "rgba(10,20,30,0.5)" : "rgba(10,20,30,0.8)",
            color: "#d9f1ff", border: "1px solid rgba(80,140,200,0.5)",
            cursor: btnBusy ? "not-allowed" : "pointer"
          }}
        >
          {listening ? "Pause Listening" : "Resume Listening"}
        </button>
      </div>

      {/* Subtitles */}
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
