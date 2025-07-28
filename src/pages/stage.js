// src/pages/stage.js
import { useEffect, useContext } from "react";
import dynamic from "next/dynamic";
import { ChatContext } from "@/context/ChatContext";

// Dynamically import both heavy/browser‑only components
const StageScene = dynamic(() => import("@/components/StageScene"), {
  ssr: false,
});
const ChatBox = dynamic(() => import("@/components/ChatBox"), {
  ssr: false,
});

export default function Stage() {
  const { stage } = useContext(ChatContext);

  // Play the correct background music (only runs in browser)
  useEffect(() => {
    const audio = document.getElementById("bgm");
    audio.src = `/audio/stage${stage}.mp3`;
    audio.play();
  }, [stage]);

  return (
    <>
      <audio id="bgm" loop />
      <StageScene stage={stage} />
      <ChatBox />
    </>
  );
}
