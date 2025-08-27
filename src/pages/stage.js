import { useContext } from "react";
import dynamic from "next/dynamic";
import { ChatContext } from "@/context/ChatContext";

// client-only components
const StageScene = dynamic(() => import("@/components/StageScene"), { ssr: false });
const ChatBox = dynamic(() => import("@/components/ChatBox"), { ssr: false });

function Stage() {
  const { humor, honesty, userName } = useContext(ChatContext);

  return (
    <div className="cockpit">
      <div className="cockpit-window">
        <StageScene />
        {/* TOP HUD – stays at the top; distinct class names to avoid collisions */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              background: "linear-gradient(180deg, rgba(8,18,28,.65), rgba(8,18,28,.35))",
              border: "1px solid rgba(102,224,255,.22)",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 12,
              color: "rgba(190,240,255,.9)",
              textShadow: "0 0 8px rgba(60,150,255,.25)",
            }}
          >
            TARS · Linked
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                pointerEvents: "auto",
                background: "linear-gradient(180deg, rgba(8,18,28,.65), rgba(8,18,28,.35))",
                border: "1px solid rgba(102,224,255,.22)",
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: 12,
                color: "rgba(190,240,255,.9)",
              }}
            >
              Pilot: {userName || "Captain"}
            </div>
            <div
              style={{
                pointerEvents: "auto",
                background: "linear-gradient(180deg, rgba(8,18,28,.65), rgba(8,18,28,.35))",
                border: "1px solid rgba(102,224,255,.22)",
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: 12,
                color: "rgba(190,240,255,.9)",
              }}
            >
              Humor {humor}%
            </div>
            <div
              style={{
                pointerEvents: "auto",
                background: "linear-gradient(180deg, rgba(8,18,28,.65), rgba(8,18,28,.35))",
                border: "1px solid rgba(102,224,255,.22)",
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: 12,
                color: "rgba(190,240,255,.9)",
              }}
            >
              Honesty {honesty}%
            </div>
          </div>
        </div>
      </div>

      {/* Subtitles/voice overlay */}
      <ChatBox />
    </div>
  );
}

// export the page as client-only so Next.js won't prerender it (avoids server-side document/window errors)
export default dynamic(() => Promise.resolve(Stage), { ssr: false });
