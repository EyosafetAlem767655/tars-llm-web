import { createContext, useState } from "react";

export const ChatContext = createContext();

export function ChatProvider({ children }) {
  const [userName, setUserName]   = useState("");
  const [stage, setStage]         = useState(1);
  const [messages, setMessages]   = useState([]);
  const [humor, setHumor]         = useState(50);
  const [honesty]                 = useState(100);
  const [sessionId, setSessionId] = useState(null);

  return (
    <ChatContext.Provider value={{
      userName, setUserName,
      stage, setStage,
      messages, setMessages,
      humor, setHumor,
      honesty,
      sessionId, setSessionId,
    }}>
      {children}
    </ChatContext.Provider>
  );
}
