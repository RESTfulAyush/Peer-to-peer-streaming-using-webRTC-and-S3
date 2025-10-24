"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SocketProvider } from "./providers/Socket";
import { useSocket } from "./providers/Socket";
import { Router } from "next/router";

export default function HomePage() {
  const router = useRouter();
  const { socket } = useSocket();
  const [email, setEmail] = useState();
  const [roomId, setRoomId] = useState();

  const handleRoomJoined = ({ roomId }) => {
    router.push(`/room/${roomId}`);
  };

  useEffect(() => {
    socket.on("joined-room", handleRoomJoined);
  }, [socket]);

  const handleJoinRoom = () => {
    socket.emit("join-room", { emailId: email, roomId: roomId });
  };

  return (
    <div className="homepage-container">
      <div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Enter email"
        />
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          type="text"
          placeholder="Enter Room Code"
        />
        <button onClick={handleJoinRoom}>Enter Room</button>
      </div>
    </div>
  );
}
