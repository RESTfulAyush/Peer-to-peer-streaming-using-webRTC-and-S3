"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSocket } from "./providers/Socket";

export default function HomePage() {
  const router = useRouter();
  const { socket } = useSocket();
  const [email, setEmail] = useState("");
  const [roomId, setRoomId] = useState();

  const handleRoomJoined = useCallback(
    ({ roomId }) => {
      router.push(`/room/${roomId}`);
    },
    [router]
  );

  useEffect(() => {
    socket.on("joined-room", handleRoomJoined);
    return () => {
      socket.off("joined-room", handleRoomJoined);
    };
  }, [socket, handleRoomJoined]);

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
