"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");

  const joinRoom = () => {
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim()}`);
    }
  };

  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h1>🔗 Join Video Room</h1>
      <p>Enter the same room ID on two devices/tabs to connect</p>

      <input
        type="text"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="Enter Room ID (e.g. 123)"
        style={{
          padding: "10px",
          fontSize: "16px",
          borderRadius: "6px",
          border: "1px solid #ccc",
          width: "200px",
          marginRight: "10px",
        }}
      />

      <button
        onClick={joinRoom}
        style={{
          padding: "10px 20px",
          backgroundColor: "#0070f3",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        🚪 Join Room
      </button>
    </div>
  );
}
