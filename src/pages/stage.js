import { useEffect, useContext } from "react";
import { ChatContext } from "@/context/ChatContext";
import StageScene from "@/components/StageScene";
import ChatBox from "@/components/ChatBox";

export default function Stage() {
  const { stage } = useContext(ChatContext);

  // Play the correct background music
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
