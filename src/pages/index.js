import { useContext, useState } from "react";
import { useRouter } from "next/router";
import { ChatContext } from "@/context/ChatContext";

export default function Home() {
  const { setUserName } = useContext(ChatContext);
  const [name, setName] = useState("");
  const router = useRouter();

  function handleSubmit(e) {
    e.preventDefault();
    setUserName(name);
    router.push("/stage");
  }

  return (
    <main style={{ padding: 20, textAlign: "center" }}>
      <h1>Welcome aboard, Captain.</h1>
      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        <input
          type="text"
          placeholder="What’s your call sign?"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={{ padding: 8, fontSize: 16 }}
        />
        <button type="submit" style={{ marginLeft: 10, padding: "8px 16px", fontSize: 16 }}>
          Enter the ship
        </button>
      </form>
    </main>
  );
}
