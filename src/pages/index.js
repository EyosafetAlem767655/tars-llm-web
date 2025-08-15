import { useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { ChatContext } from "@/context/ChatContext";

export default function Home() {
  const { userName, setUserName, setStage, setMessages, setSessionId } = useContext(ChatContext);
  const [localName, setLocalName] = useState(userName || "");
  const router = useRouter();
  const canvasRef = useRef(null);

  // Starfield background (2D canvas – lightweight)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w, h, stars;
    const DPR = Math.min(2, window.devicePixelRatio || 1);

    function resize() {
      w = canvas.width = window.innerWidth * DPR;
      h = canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      stars = new Array(400).fill(0).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.7 + 0.3,
        r: Math.random() * 1.8 + .2
      }));
    }
    resize();
    window.addEventListener("resize", resize);

    let raf;
    function tick() {
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle = "#06141b";
      ctx.fillRect(0,0,w,h);

      for (const s of stars) {
        s.x += 0.3 * s.z; if (s.x > w) s.x = 0;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${150+80*s.z|0}, ${210+30*s.z|0}, 255, ${0.5 + 0.5*s.z})`;
        ctx.arc(s.x, s.y, s.r*s.z, 0, Math.PI*2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  function enterShip(e) {
    e.preventDefault();
    if (!localName.trim()) return;
    setUserName(localName.trim());
    setMessages([]); setSessionId(null);
    setStage(1);
    router.push("/stage");
  }

  return (
    <div className="landing-wrap">
      <canvas ref={canvasRef} className="starfield" />

      <div className="landing-card">
        <div className="landing-title glow">Mission Control · TARS Interface</div>
        <h1 className="landing-h1">Welcome aboard, Pilot.</h1>
        <p className="landing-sub">
          You&apos;re viewing from the **flight deck**. Choose a <strong>call sign</strong> and
          step into the cockpit. TARS is calibrated for short, mission-focused responses.
        </p>

        <form onSubmit={enterShip} className="call-row">
          <input
            className="call-input"
            placeholder="Enter your call sign (e.g., Endurance-01)"
            value={localName}
            onChange={(e)=>setLocalName(e.target.value)}
            maxLength={32}
          />
          <button className="call-btn glow" type="submit">Enter the Ship</button>
        </form>

        <div className="footer-mini">Tip: say “let’s go into a wormhole” or “let’s go into a black hole”.</div>
      </div>
    </div>
  );
}
